from __future__ import annotations

import json
import struct
import wave
from pathlib import Path
from subprocess import CompletedProcess, TimeoutExpired

from claim import claim_oldest
from ffmpeg_argv import loudnorm_cmd, piper_cmd
from modules.tts import process_tts
from conftest import insert_tts


def _silence_wav(path: Path, seconds: float = 0.2) -> None:
    rate = 48000
    n = int(rate * seconds)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(struct.pack("<" + "h" * n, *([0] * n)))


def test_e3_u1_argv_are_lists() -> None:
    p = piper_cmd("piper", "voice.onnx", "raw.wav")
    f = loudnorm_cmd("ffmpeg", "raw.wav", "voice.wav")
    assert isinstance(p, list) and isinstance(f, list)
    assert "cmd.exe" not in p and "cmd.exe" not in f
    assert "&&" not in " ".join(p)


def test_e3_c1_missing_voice(conn, contract, settings) -> None:
    insert_tts(conn)
    job = claim_oldest(conn, contract, ["tts"], settings.WORKER_OWNER, 1_000)
    assert job
    process_tts(conn, contract, settings, job)
    row = conn.execute("SELECT status, error_code, error FROM jobs WHERE id='j1'").fetchone()
    assert row["status"] == "error"
    assert row["error_code"] == "config"
    assert row["error"] == "piper voice missing"


def test_e3_i1_fake_piper_writes_wav(conn, contract, settings, monkeypatch) -> None:
    voice = Path(settings.DATA_DIR) / "voices" / "en_US-lessac-medium.onnx"
    voice.parent.mkdir(parents=True)
    voice.write_bytes(b"onnx")
    settings.PIPER_VOICE = str(voice)
    insert_tts(conn)

    def fake_spawn(argv, *, timeout_sec, stdin_bytes=None):
        joined = " ".join(str(a) for a in argv)
        if "--output_file" in argv:
            out = Path(argv[argv.index("--output_file") + 1])
            _silence_wav(out)
            return CompletedProcess(argv, 0, b"", b"")
        if "-af" in argv and "loudnorm" in joined:
            dest = Path(argv[-1])
            src = Path(argv[argv.index("-i") + 1])
            dest.write_bytes(src.read_bytes() if src.is_file() else b"")
            if dest.stat().st_size == 0:
                _silence_wav(dest)
            return CompletedProcess(argv, 0, b"", b"")
        if "-of" in argv and "json" in argv:
            payload = json.dumps(
                {"streams": [{"codec_type": "audio", "codec_name": "pcm_s16le"}], "format": {"duration": "0.2"}}
            )
            return CompletedProcess(argv, 0, payload.encode(), b"")
        raise AssertionError(joined)

    monkeypatch.setattr("modules.tts.spawn", fake_spawn)
    job = claim_oldest(conn, contract, ["tts"], settings.WORKER_OWNER, 1_000)
    assert job is not None
    process_tts(conn, contract, settings, job)
    row = conn.execute("SELECT status, error_code, error FROM jobs WHERE id='j1'").fetchone()
    wav = Path(settings.DATA_DIR) / "projects" / "p1" / "tts" / "j1" / "voice.wav"
    assert row["status"] == "done", dict(row)
    assert wav.is_file() and wav.stat().st_size > 0


def test_e3_i2_timeout_fail(conn, contract, settings, monkeypatch) -> None:
    voice = Path(settings.DATA_DIR) / "v.onnx"
    voice.write_bytes(b"onnx")
    settings.PIPER_VOICE = str(voice)
    insert_tts(conn, timeout_sec=1)

    def fake_spawn(argv, *, timeout_sec, stdin_bytes=None):
        raise TimeoutExpired(argv, timeout_sec)

    monkeypatch.setattr("modules.tts.spawn", fake_spawn)
    job = claim_oldest(conn, contract, ["tts"], settings.WORKER_OWNER, 1_000)
    process_tts(conn, contract, settings, job)
    row = conn.execute("SELECT status, error_code FROM jobs WHERE id='j1'").fetchone()
    assert row["status"] == "error"
    assert row["error_code"] == "timeout"
