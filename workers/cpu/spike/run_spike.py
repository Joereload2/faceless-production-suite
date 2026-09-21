from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import time
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(SRC))

from assemble.captions_style import subtitles_filter
from assemble.concat import write_concat_txt
from assemble.segments import split_segments
from ffmpeg_argv import (
    captions_cmd,
    color_png_cmd,
    concat_cmd,
    ffprobe_cmd,
    loudnorm_cmd,
    mix_cmd,
    piper_cmd,
    still_seg_cmd,
)
from process_kill import spawn

REPO = Path(__file__).resolve().parents[3]
SPIKE_DIR = Path(__file__).resolve().parent
CLIP_A = "#1a1a2e"
CLIP_B = "#16213e"


def fail_config(message: str) -> None:
    print(json.dumps({"errorCode": "config", "message": message}))
    raise SystemExit(2)


def resolve_bin(raw: str) -> str | None:
    p = Path(raw)
    if p.is_file():
        return str(p.resolve())
    return shutil.which(raw)


def fsync_replace(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with open(src, "rb") as f:
        os.fsync(f.fileno())
    os.replace(src, dest)


def load_contract() -> dict:
    env = os.environ.get("CONTRACT_JSON")
    path = Path(env) if env else REPO / "packages" / "schema" / "contract.json"
    return json.loads(path.read_text(encoding="utf-8"))


def probe_file(ffprobe_bin: str, path: Path, timeout_sec: int) -> dict:
    r = spawn(ffprobe_cmd(ffprobe_bin, str(path)), timeout_sec=timeout_sec)
    if r.returncode != 0:
        return {"hasVideo": False, "hasAudio": False, "durationSec": 0.0}
    data = json.loads(r.stdout.decode("utf-8") or "{}")
    types = {s.get("codec_type") for s in (data.get("streams") or [])}
    dur = float((data.get("format") or {}).get("duration") or 0)
    return {"hasVideo": "video" in types, "hasAudio": "audio" in types, "durationSec": dur}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", default=str(REPO / "data" / "projects" / "spike"))
    args = parser.parse_args()

    piper_bin = resolve_bin(os.environ.get("PIPER_BIN", "piper"))
    ffmpeg_bin = resolve_bin(os.environ.get("FFMPEG_BIN", "ffmpeg"))
    ffprobe_bin = resolve_bin(os.environ.get("FFPROBE_BIN", "ffprobe"))
    voice = Path(os.environ.get("PIPER_VOICE", ""))

    if not piper_bin:
        fail_config("piper missing")
    if not voice.is_file():
        fail_config("piper voice missing")
    if not ffmpeg_bin:
        fail_config("ffmpeg missing")
    if not ffprobe_bin:
        fail_config("ffprobe missing")

    contract = load_contract()
    tts_timeout = int(contract["modules"]["tts"])
    assemble_timeout = int(contract["modules"]["assemble"])

    data_dir = Path(args.data_dir)
    tts_dir = data_dir / "tts"
    stock_dir = data_dir / "stock"
    assemble_dir = data_dir / "assemble"
    tmp_dir = assemble_dir / "tmp"
    export_dir = data_dir / "export"
    for d in (tts_dir, stock_dir, tmp_dir, export_dir):
        d.mkdir(parents=True, exist_ok=True)

    script = (SPIKE_DIR / "fixtures" / "script.txt").read_text(encoding="utf-8")
    srt = SPIKE_DIR / "fixtures" / "captions.srt"

    steps: list[dict] = []
    t0 = time.perf_counter()
    started = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())

    def mark(name: str, started_perf: float) -> None:
        steps.append({"name": name, "ms": int((time.perf_counter() - started_perf) * 1000)})

    raw_wav = tts_dir / "raw.wav"
    voice_wav = tts_dir / "voice.wav"
    png_a = stock_dir / "clip-a.png"
    png_b = stock_dir / "clip-b.png"

    t = time.perf_counter()
    r = spawn(
        piper_cmd(piper_bin, str(voice.resolve()), str(raw_wav)),
        timeout_sec=tts_timeout,
        stdin_bytes=(script.strip() + "\n").encode("utf-8"),
    )
    if r.returncode != 0:
        fail_config("piper failed")
    mark("piper", t)

    t = time.perf_counter()
    r = spawn(loudnorm_cmd(ffmpeg_bin, str(raw_wav), str(voice_wav)), timeout_sec=tts_timeout)
    if r.returncode != 0:
        fail_config("loudnorm failed")
    mark("loudnorm", t)

    audio = probe_file(ffprobe_bin, voice_wav, 30)
    duration = float(audio["durationSec"])
    if duration <= 0:
        fail_config("voice duration")

    t = time.perf_counter()
    r = spawn(color_png_cmd(str(png_a), CLIP_A, ffmpeg_bin=ffmpeg_bin), timeout_sec=60)
    if r.returncode != 0:
        fail_config("still a failed")
    r = spawn(color_png_cmd(str(png_b), CLIP_B, ffmpeg_bin=ffmpeg_bin), timeout_sec=60)
    if r.returncode != 0:
        fail_config("still b failed")
    mark("stills", t)

    mid = duration / 2.0
    clips = [
        (0.0, mid, png_a),
        (mid, duration, png_b),
    ]
    windows = split_segments(duration)
    seg_paths: list[Path] = []
    for i, (start, end) in enumerate(windows):
        t = time.perf_counter()
        pieces: list[Path] = []
        for c_start, c_end, img in clips:
            o0 = max(c_start, start)
            o1 = min(c_end, end)
            if o1 - o0 <= 1e-6:
                continue
            piece = tmp_dir / f"piece-{i:03d}-{len(pieces)}.mp4"
            r = spawn(
                still_seg_cmd(ffmpeg_bin, str(img), o1 - o0, str(piece)),
                timeout_sec=assemble_timeout,
            )
            if r.returncode != 0:
                fail_config("segment failed")
            pieces.append(piece)
        dest = assemble_dir / f"seg-{i:03d}.mp4"
        if len(pieces) == 1:
            fsync_replace(pieces[0], dest)
        else:
            piece_list = tmp_dir / f"concat-piece-{i:03d}.txt"
            piece_list.write_text(
                "\n".join(f"file '{p.resolve().as_posix()}'" for p in pieces) + "\n",
                encoding="utf-8",
            )
            merged = tmp_dir / f"seg-{i:03d}.mp4"
            r = spawn(concat_cmd(ffmpeg_bin, str(piece_list), str(merged)), timeout_sec=assemble_timeout)
            if r.returncode != 0:
                fail_config("segment concat failed")
            fsync_replace(merged, dest)
        seg_paths.append(dest)
        mark(f"seg-{i:03d}", t)

    write_concat_txt(assemble_dir / "concat.txt", len(seg_paths))
    concat_video = assemble_dir / "concat_video.mp4"
    t = time.perf_counter()
    prev = Path.cwd()
    os.chdir(assemble_dir)
    try:
        r = spawn(concat_cmd(ffmpeg_bin, "concat.txt", str(concat_video)), timeout_sec=assemble_timeout)
    finally:
        os.chdir(prev)
    if r.returncode != 0:
        fail_config("concat failed")
    mark("concat", t)

    with_audio = assemble_dir / "with_audio.mp4"
    t = time.perf_counter()
    r = spawn(
        mix_cmd(ffmpeg_bin, str(concat_video), str(voice_wav), str(with_audio)),
        timeout_sec=assemble_timeout,
    )
    if r.returncode != 0:
        fail_config("mix failed")
    mark("mix_audio", t)

    tmp_master = tmp_dir / "master_16x9.mp4"
    master = export_dir / "master_16x9.mp4"
    t = time.perf_counter()
    r = spawn(
        captions_cmd(ffmpeg_bin, str(with_audio), subtitles_filter(srt), str(tmp_master)),
        timeout_sec=assemble_timeout,
    )
    if r.returncode != 0:
        fail_config("captions failed")
    fsync_replace(tmp_master, master)
    mark("captions", t)

    shutil.rmtree(tmp_dir, ignore_errors=True)

    probe = probe_file(ffprobe_bin, master, 30)
    if not probe["hasVideo"] or not probe["hasAudio"] or probe["durationSec"] <= 0:
        fail_config("probe failed")

    total_ms = int((time.perf_counter() - t0) * 1000)
    steps.append({"name": "total", "ms": total_ms})
    timing = {
        "host": "windows" if os.name == "nt" else "posix",
        "startedAt": started,
        "piperBin": piper_bin,
        "voice": "en_US-lessac-medium",
        "steps": steps,
        "audioDurationSec": duration,
        "masterBytes": master.stat().st_size,
        "probe": probe,
    }
    (data_dir / "timing.json").write_text(json.dumps(timing, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "master": str(master), "timing": str(data_dir / "timing.json")}))


if __name__ == "__main__":
    main()
