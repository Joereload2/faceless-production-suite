from __future__ import annotations

import json
import os
import shutil
from pathlib import Path

from assemble.captions_style import subtitles_filter
from assemble.concat import write_concat_txt
from assemble.segments import split_segments
from claim import complete_job, fail_job, utc_iso
from config import Settings
from ffmpeg_argv import captions_cmd, concat_cmd, ffprobe_cmd, mix_cmd, still_seg_cmd
from paths import job_dir, project_dir
from process_kill import spawn as default_spawn


def fsync_replace(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    os.replace(src, dest)
    with open(dest, "r+b") as f:
        os.fsync(f.fileno())


def probe(ffprobe_bin: str, path: Path, spawn) -> dict:
    r = spawn(ffprobe_cmd(ffprobe_bin, str(path)), timeout_sec=30)
    data = json.loads(r.stdout.decode("utf-8") or "{}")
    types = {s.get("codec_type") for s in (data.get("streams") or [])}
    dur = float((data.get("format") or {}).get("duration") or 0)
    return {"hasVideo": "video" in types, "hasAudio": "audio" in types, "durationSec": dur}


def _asset(data_dir: str, project_id: str, module: str, file_job_id: str, file_name: str) -> Path:
    p = job_dir(data_dir, project_id, module, file_job_id) / file_name
    root = project_dir(data_dir, project_id)
    resolved = p.resolve()
    if not str(resolved).startswith(str(root.resolve())):
        raise ValueError("traversal")
    return resolved


def run_assemble(settings: Settings, job: dict, spawn=default_spawn) -> dict:
    """Render master_16x9.mp4. Does not claim. Returns argv log + master path."""
    project_id = str(job["project_id"])
    job_id = str(job["id"])
    spec = json.loads(job["input_json"])["spec"]
    timeout_sec = int(job.get("timeout_sec") or 600)
    ffmpeg = settings.FFMPEG_BIN
    ffprobe = settings.FFPROBE_BIN
    argv_log: list[list[str]] = []

    def run(cmd: list[str]) -> None:
        argv_log.append(list(cmd))
        r = spawn(cmd, timeout_sec=timeout_sec)
        if r.returncode != 0:
            err = (r.stderr or b"").decode("utf-8", "replace")[:400]
            raise RuntimeError(f"ffmpeg failed: {err}")

    wav = _asset(settings.DATA_DIR, project_id, "tts", spec["audioJobId"], "voice.wav")
    if not wav.is_file():
        raise RuntimeError("voice.wav missing")
    audio = probe(ffprobe, wav, spawn)
    duration = float(audio["durationSec"])
    clips = spec["clips"]
    last_end = max(float(c["timelineEndSec"]) for c in clips)
    if abs(last_end - duration) > 0.5:
        raise ValueError("clip coverage vs audio duration")

    assemble_dir = job_dir(settings.DATA_DIR, project_id, "assemble", job_id)
    tmp = assemble_dir / "tmp"
    tmp.mkdir(parents=True, exist_ok=True)
    windows = split_segments(duration)
    n = 0
    for i, (start, end) in enumerate(windows):
        pieces: list[Path] = []
        for clip in clips:
            o0 = max(float(clip["timelineStartSec"]), start)
            o1 = min(float(clip["timelineEndSec"]), end)
            if o1 - o0 <= 1e-6:
                continue
            kind = clip["fileKind"]
            img = _asset(settings.DATA_DIR, project_id, kind, clip["fileJobId"], clip["fileName"])
            piece = tmp / f"piece-{i:03d}-{len(pieces)}.mp4"
            cmd = still_seg_cmd(ffmpeg, str(img), o1 - o0, str(piece))
            run(cmd)
            pieces.append(piece)
        dest = assemble_dir / f"seg-{i:03d}.mp4"
        if len(pieces) == 1:
            fsync_replace(pieces[0], dest)
        else:
            lst = tmp / f"concat-piece-{i:03d}.txt"
            lst.write_text("\n".join(f"file '{p.resolve().as_posix()}'" for p in pieces) + "\n", encoding="utf-8")
            merged = tmp / f"seg-{i:03d}.mp4"
            run(concat_cmd(ffmpeg, str(lst), str(merged)))
            fsync_replace(merged, dest)
        n += 1

    write_concat_txt(assemble_dir / "concat.txt", n)
    concat_video = assemble_dir / "concat_video.mp4"
    prev = Path.cwd()
    os.chdir(assemble_dir)
    try:
        run(concat_cmd(ffmpeg, "concat.txt", str(concat_video)))
    finally:
        os.chdir(prev)

    with_audio = assemble_dir / "with_audio.mp4"
    run(mix_cmd(ffmpeg, str(concat_video), str(wav), str(with_audio)))

    export_dir = project_dir(settings.DATA_DIR, project_id) / "export"
    tmp_master = tmp / "master_16x9.mp4"
    master = export_dir / "master_16x9.mp4"
    captions_id = spec.get("captionsJobId")
    if captions_id:
        srt = _asset(settings.DATA_DIR, project_id, "captions", captions_id, "captions.srt")
        run(captions_cmd(ffmpeg, str(with_audio), subtitles_filter(srt), str(tmp_master)))
    else:
        shutil.copy2(with_audio, tmp_master)
    fsync_replace(tmp_master, master)
    shutil.rmtree(tmp, ignore_errors=True)
    info = probe(ffprobe, master, spawn)
    if not info["hasVideo"] or not info["hasAudio"] or info["durationSec"] <= 0:
        raise RuntimeError("probe failed")
    return {"master": master, "argv": argv_log, "probe": info}


def process_assemble(conn, contract: dict, settings: Settings, job: dict, spawn=default_spawn) -> None:
    owner = settings.WORKER_OWNER
    job_id = str(job["id"])
    project_id = str(job["project_id"])
    try:
        result = run_assemble(settings, job, spawn=spawn)
    except ValueError as e:
        fail_job(conn, contract, job_id, owner, "validation", str(e)[:200], utc_iso())
        return
    except Exception as e:
        fail_job(conn, contract, job_id, owner, "io", str(e)[:200], utc_iso())
        return
    master: Path = result["master"]
    bytes_out = master.stat().st_size
    output = json.dumps(
        {
            "files": [
                {
                    "kind": "video",
                    "path": "export/master_16x9.mp4",
                    "mime": "video/mp4",
                    "bytes": bytes_out,
                }
            ],
            "meta": {"durationSec": result["probe"]["durationSec"]},
        },
        separators=(",", ":"),
    )
    complete_job(conn, contract, job_id, project_id, owner, output, bytes_out, utc_iso())
