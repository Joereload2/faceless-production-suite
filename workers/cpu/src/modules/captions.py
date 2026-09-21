from __future__ import annotations

import json
from pathlib import Path

from claim import complete_job, fail_job, utc_iso
from config import Settings
from paths import job_dir


def transcribe(wav_path: str) -> list[tuple[float, float, str]]:
    try:
        from faster_whisper import WhisperModel
    except ImportError as e:
        raise RuntimeError("whisper missing") from e
    model = WhisperModel("small", device="cpu", compute_type="int8")
    segments, _info = model.transcribe(wav_path)
    out: list[tuple[float, float, str]] = []
    for seg in segments:
        out.append((float(seg.start), float(seg.end), str(seg.text).strip()))
    return out


def _fmt_ts(sec: float) -> str:
    ms = int(round(sec * 1000))
    h, rem = divmod(ms, 3_600_000)
    m, rem = divmod(rem, 60_000)
    s, milli = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{milli:03d}"


def write_srt(path: Path, cues: list[tuple[float, float, str]]) -> None:
    lines: list[str] = []
    for i, (start, end, text) in enumerate(cues, start=1):
        lines.append(str(i))
        lines.append(f"{_fmt_ts(start)} --> {_fmt_ts(end)}")
        lines.append(text)
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def process_captions(conn, contract: dict, settings: Settings, job: dict) -> None:
    owner = settings.WORKER_OWNER
    job_id = str(job["id"])
    project_id = str(job["project_id"])
    payload = json.loads(job["input_json"])
    audio_id = str(payload["audioJobId"])
    wav = job_dir(settings.DATA_DIR, project_id, "tts", audio_id) / "voice.wav"
    if not wav.is_file():
        fail_job(conn, contract, job_id, owner, "io", "voice.wav missing", utc_iso())
        return
    try:
        cues = transcribe(str(wav))
    except RuntimeError as e:
        if "whisper missing" in str(e):
            fail_job(conn, contract, job_id, owner, "config", "whisper missing", utc_iso())
            return
        raise
    root = job_dir(settings.DATA_DIR, project_id, "captions", job_id)
    root.mkdir(parents=True, exist_ok=True)
    srt = root / "captions.srt"
    write_srt(srt, cues)
    bytes_out = srt.stat().st_size
    output = json.dumps(
        {
            "files": [
                {
                    "kind": "captions",
                    "path": f"captions/{job_id}/captions.srt",
                    "mime": "application/x-subrip",
                    "bytes": bytes_out,
                }
            ],
            "meta": {"language": "en", "model": "small"},
        },
        separators=(",", ":"),
    )
    complete_job(conn, contract, job_id, project_id, owner, output, bytes_out, utc_iso())
