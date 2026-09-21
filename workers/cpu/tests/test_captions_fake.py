from pathlib import Path

from claim import claim_oldest
from modules import captions
from modules.captions import process_captions


def test_e7_i2_whisper_fake_srt(conn, contract, settings, monkeypatch) -> None:
    now = "2026-09-19T00:00:00.000Z"
    audio_dir = Path(settings.DATA_DIR) / "projects" / "p1" / "tts" / "aud1xxxx"
    audio_dir.mkdir(parents=True)
    (audio_dir / "voice.wav").write_bytes(b"RIFF")
    conn.execute(
        """INSERT INTO jobs (id, project_id, module, engine, status, progress, timeout_sec,
           idempotency_key, created_by, input_hash, input_json, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            "c1",
            "p1",
            "captions",
            "local",
            "queued",
            0,
            300,
            "k-c1",
            "api",
            "h",
            '{"audioJobId":"aud1xxxx"}',
            now,
            now,
        ),
    )
    monkeypatch.setattr(captions, "transcribe", lambda _p: [(0.0, 2.0, "hello")])
    job = claim_oldest(conn, contract, ["captions"], settings.WORKER_OWNER, 1_000)
    process_captions(conn, contract, settings, job)
    srt = Path(settings.DATA_DIR) / "projects" / "p1" / "captions" / "c1" / "captions.srt"
    assert "hello" in srt.read_text(encoding="utf-8")
