from __future__ import annotations

import json
import os
import shutil
import threading
import time
from pathlib import Path
from subprocess import TimeoutExpired

from claim import complete_job, fail_job, utc_iso
from config import Settings
from ffmpeg_argv import ffprobe_cmd, loudnorm_cmd, piper_cmd
from paths import job_dir
from process_kill import kill_tree, spawn


def resolve_voice(settings: Settings, piper_voice_id: str) -> Path:
    if settings.PIPER_VOICE.strip():
        return Path(settings.PIPER_VOICE)
    return Path(settings.DATA_DIR) / "voices" / f"{piper_voice_id}.onnx"


def _heartbeat_loop(stop: threading.Event, conn, contract: dict, job_id: str, owner: str, pid_box: list[int | None]) -> None:
    interval = int(contract["limits"]["HEARTBEAT_MS"]) / 1000
    while not stop.wait(interval):
        now_ms = int(time.time() * 1000)
        lease = utc_iso(now_ms + int(contract["limits"]["LEASE_MS"]))
        rows = conn.execute(
            contract["sql"]["heartbeat"],
            {"now": utc_iso(now_ms), "lease_until": lease, "id": job_id, "owner": owner},
        ).fetchall()
        if not rows:
            pid = pid_box[0]
            if pid:
                kill_tree(pid)
            return
        row0 = rows[0]
        cancel = row0["cancel_requested"] if "cancel_requested" in row0.keys() else row0[0]
        if int(cancel) == 1:
            pid = pid_box[0]
            if pid:
                kill_tree(pid)
            conn.execute(
                contract["sql"]["cancelRunning"],
                {"now": utc_iso(), "id": job_id, "owner": owner},
            ).fetchall()
            return


def process_tts(conn, contract: dict, settings: Settings, job: dict, piper_voice_id: str = "en_US-lessac-medium") -> None:
    owner = settings.WORKER_OWNER
    job_id = str(job["id"])
    project_id = str(job["project_id"])
    timeout_sec = int(job["timeout_sec"])
    voice = resolve_voice(settings, piper_voice_id)
    if not voice.is_file():
        fail_job(conn, contract, job_id, owner, "config", "piper voice missing", utc_iso())
        return

    root = job_dir(settings.DATA_DIR, project_id, "tts", job_id)
    tmp = root / "tmp"
    tmp.mkdir(parents=True, exist_ok=True)
    raw = tmp / "raw.wav"
    dest = root / "voice.wav"
    stop = threading.Event()
    pid_box: list[int | None] = [None]
    hb = threading.Thread(
        target=_heartbeat_loop,
        args=(stop, conn, contract, job_id, owner, pid_box),
        daemon=True,
    )
    hb.start()
    try:
        text = json.loads(job["input_json"]).get("text", "")
        argv = piper_cmd(settings.PIPER_BIN, str(voice), str(raw))
        if not isinstance(argv, list) or "cmd.exe" in argv:
            raise RuntimeError("bad piper argv")
        try:
            spawn(argv, timeout_sec=timeout_sec, stdin_bytes=(str(text).strip() + "\n").encode("utf-8"))
        except TimeoutExpired:
            fail_job(conn, contract, job_id, owner, "timeout", "deadline exceeded", utc_iso())
            return
        ln = loudnorm_cmd(settings.FFMPEG_BIN, str(raw), str(tmp / "voice.wav"))
        if not isinstance(ln, list) or "cmd.exe" in ln:
            raise RuntimeError("bad ffmpeg argv")
        r = spawn(ln, timeout_sec=timeout_sec)
        if r.returncode != 0:
            fail_job(conn, contract, job_id, owner, "io", "loudnorm failed", utc_iso())
            return
        probe = spawn(ffprobe_cmd(settings.FFPROBE_BIN, str(tmp / "voice.wav")), timeout_sec=30)
        data = json.loads(probe.stdout.decode("utf-8") or "{}")
        types = {s.get("codec_type") for s in (data.get("streams") or [])}
        if "audio" not in types:
            fail_job(conn, contract, job_id, owner, "io", "no audio", utc_iso())
            return
        final_tmp = tmp / "voice.wav"
        os.replace(final_tmp, dest)
        with open(dest, "r+b") as f:
            os.fsync(f.fileno())
        bytes_out = dest.stat().st_size
        output = json.dumps(
            {
                "files": [
                    {
                        "kind": "audio",
                        "path": f"tts/{job_id}/voice.wav",
                        "mime": "audio/wav",
                        "bytes": bytes_out,
                    }
                ],
                "meta": {"lufsTarget": -14, "voice": piper_voice_id},
            },
            separators=(",", ":"),
        )
        complete_job(conn, contract, job_id, project_id, owner, output, bytes_out, utc_iso())
    except TimeoutExpired:
        fail_job(conn, contract, job_id, owner, "timeout", "deadline exceeded", utc_iso())
    except Exception as e:
        fail_job(conn, contract, job_id, owner, "internal", str(e)[:200], utc_iso())
    finally:
        stop.set()
        hb.join(timeout=2)
        shutil.rmtree(tmp, ignore_errors=True)
