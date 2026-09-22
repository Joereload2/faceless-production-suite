from pathlib import Path

from claim import claim_oldest
from video import process_video


def test_e9_i1_fake_clip_mp4(conn, contract, settings) -> None:
    now = "2026-09-19T00:00:00.000Z"
    conn.execute(
        """INSERT INTO jobs (id, project_id, module, engine, status, progress, timeout_sec,
           idempotency_key, created_by, input_hash, input_json, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            "vid1xxxx",
            "p1",
            "video",
            "local",
            "queued",
            0,
            900,
            "k-vid1",
            "api",
            "h",
            '{"prompt":"lamp pan","seconds":2,"preset":"video-v1"}',
            now,
            now,
        ),
    )
    job = claim_oldest(conn, contract, ["image", "video"], settings.WORKER_OWNER, 1_000)
    assert job
    process_video(conn, contract, settings, job, fake=True)
    clip = Path(settings.DATA_DIR) / "projects" / "p1" / "video" / "vid1xxxx" / "clip.mp4"
    assert clip.is_file() and clip.stat().st_size > 0
    row = conn.execute("SELECT status FROM jobs WHERE id='vid1xxxx'").fetchone()
    assert row["status"] == "done"


def test_e9_i2_running_image_blocks_video_claim(conn, contract, settings) -> None:
    now = "2026-09-19T00:00:00.000Z"
    conn.execute(
        """INSERT INTO jobs (id, project_id, module, engine, status, progress, timeout_sec,
           idempotency_key, created_by, input_hash, input_json, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        ("img-run1", "p1", "image", "local", "running", 0, 180, "k-imgr", "api", "h", "{}", now, now),
    )
    conn.execute(
        """INSERT INTO jobs (id, project_id, module, engine, status, progress, timeout_sec,
           idempotency_key, created_by, input_hash, input_json, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            "vid-q001",
            "p1",
            "video",
            "local",
            "queued",
            0,
            900,
            "k-vidq",
            "api",
            "h",
            '{"prompt":"pan","seconds":2,"preset":"video-v1"}',
            now,
            now,
        ),
    )
    assert claim_oldest(conn, contract, ["image", "video"], settings.WORKER_OWNER, 1_000) is None
