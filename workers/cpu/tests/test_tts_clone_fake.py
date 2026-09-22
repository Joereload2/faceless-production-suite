from __future__ import annotations

import json
import struct
import wave
from pathlib import Path
from subprocess import CompletedProcess

from claim import claim_oldest
from conftest import insert_tts
from modules.tts import process_tts


def _silence_wav(path: Path, seconds: float = 0.2) -> None:
    rate = 48000
    n = int(rate * seconds)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(struct.pack("<" + "h" * n, *([0] * n)))


def test_clone_missing_reference(conn, contract, settings) -> None:
    settings.TTS_ENGINE = "clone"
    settings.CLONE_REF_WAV = ""
    insert_tts(conn, "jclone1")
    job = claim_oldest(conn, contract, ["tts"], settings.WORKER_OWNER, 1_000)
    process_tts(conn, contract, settings, job)
    row = conn.execute("SELECT error_code, error FROM jobs WHERE id='jclone1'").fetchone()
    assert row["error_code"] == "config"
    assert row["error"] == "clone reference missing"


def test_clone_fake_writes_voice_wav(conn, contract, settings, monkeypatch) -> None:
    settings.TTS_ENGINE = "clone"
    ref = Path(settings.DATA_DIR) / "voices" / "me.wav"
    ref.parent.mkdir(parents=True)
    _silence_wav(ref)
    settings.CLONE_REF_WAV = str(ref)
    insert_tts(conn, "jclone2")

    def fake_synth(text, speaker_wav, language, dest: Path) -> None:
        assert language in {"en", "es"}
        assert speaker_wav.is_file()
        _silence_wav(dest)

    def fake_spawn(argv, *, timeout_sec, stdin_bytes=None):
        joined = " ".join(str(a) for a in argv)
        if "-af" in argv and "loudnorm" in joined:
            dest = Path(argv[-1])
            src = Path(argv[argv.index("-i") + 1])
            dest.write_bytes(src.read_bytes() if src.is_file() else b"")
            if dest.stat().st_size == 0:
                _silence_wav(dest)
            return CompletedProcess(argv, 0, b"", b"")
        if "-of" in argv and "json" in argv:
            payload = json.dumps(
                {"streams": [{"codec_type": "audio"}], "format": {"duration": "0.2"}}
            )
            return CompletedProcess(argv, 0, payload.encode(), b"")
        raise AssertionError(joined)

    monkeypatch.setattr("modules.tts.synthesize_clone", fake_synth)
    monkeypatch.setattr("modules.tts.spawn", fake_spawn)
    job = claim_oldest(conn, contract, ["tts"], settings.WORKER_OWNER, 2_000)
    process_tts(conn, contract, settings, job)
    wav = Path(settings.DATA_DIR) / "projects" / "p1" / "tts" / "jclone2" / "voice.wav"
    row = conn.execute("SELECT status, output_json FROM jobs WHERE id='jclone2'").fetchone()
    assert row["status"] == "done"
    assert wav.is_file() and wav.stat().st_size > 0
    meta = json.loads(row["output_json"])["meta"]
    assert meta["engine"] == "clone"
    assert meta["language"] == "es"
