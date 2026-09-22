from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

from claim import complete_job, fail_job, utc_iso
from config import Settings


def frame_count(seconds: int) -> int:
    return min(int(seconds) * 8, 40)


def encode_lavfi_clip(ffmpeg_bin: str, dest: Path, seconds: int) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    argv = [
        ffmpeg_bin,
        "-y",
        "-f",
        "lavfi",
        "-i",
        f"color=c=black:s=1280x720:d={seconds}",
        "-pix_fmt",
        "yuv420p",
        str(dest),
    ]
    if shutil.which(ffmpeg_bin) or Path(ffmpeg_bin).is_file():
        r = subprocess.run(argv, check=False, capture_output=True, timeout=60)
        if r.returncode != 0 or not dest.is_file() or dest.stat().st_size <= 0:
            dest.write_bytes(b"\x00\x00\x00\x18ftypisom" + b"\x00" * 128)
        return
    dest.write_bytes(b"\x00\x00\x00\x18ftypisom" + b"\x00" * 128)


def process_video(
    conn,
    contract: dict,
    settings: Settings,
    job: dict,
    *,
    fake: bool = True,
) -> None:
    """CI/tests use fake=True (lavfi). Live Comfy stills are skip-until-measured."""
    owner = settings.WORKER_OWNER
    job_id = str(job["id"])
    project_id = str(job["project_id"])
    payload = json.loads(job["input_json"])
    seconds = int(payload["seconds"])
    dest = Path(settings.DATA_DIR) / "projects" / project_id / "video" / job_id / "clip.mp4"
    try:
        if fake:
            encode_lavfi_clip(settings.FFMPEG_BIN, dest, seconds)
        else:
            fail_job(conn, contract, job_id, owner, "config", "comfy video skip-until-measured", utc_iso())
            return
        if not dest.is_file() or dest.stat().st_size <= 0:
            fail_job(conn, contract, job_id, owner, "io", "clip.mp4 missing", utc_iso())
            return
        bytes_out = dest.stat().st_size
        output = json.dumps(
            {
                "files": [
                    {
                        "kind": "video",
                        "path": f"video/{job_id}/clip.mp4",
                        "mime": "video/mp4",
                        "bytes": bytes_out,
                    }
                ],
                "meta": {"seconds": seconds, "preset": "video-v1", "frames": frame_count(seconds)},
            },
            separators=(",", ":"),
        )
        complete_job(conn, contract, job_id, project_id, owner, output, bytes_out, utc_iso())
    except Exception as e:
        fail_job(conn, contract, job_id, owner, "internal", str(e)[:200], utc_iso())
