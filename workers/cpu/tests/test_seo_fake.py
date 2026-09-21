from __future__ import annotations

import json
from pathlib import Path

from claim import claim_oldest
from modules.seo import auto_publish, process_seo


def insert_seo(conn, job_id: str = "seo1") -> None:
    now = "2026-09-19T00:00:00.000Z"
    conn.execute(
        """INSERT INTO jobs (id, project_id, module, engine, status, progress, timeout_sec,
           idempotency_key, created_by, input_hash, input_json, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            job_id,
            "p1",
            "seo",
            "local",
            "queued",
            0,
            180,
            f"k-{job_id}",
            "api",
            "h",
            json.dumps({"siteUrl": "https://example.com", "days": 28}),
            now,
            now,
        ),
    )


def test_e8_u1_autopublish_false() -> None:
    assert auto_publish is False


def test_e8_i1_i2_c1_fake_gsc(conn, contract, settings) -> None:
    insert_seo(conn)
    rows = [
        {"keys": ["night library"], "impressions": 5000, "clicks": 10, "ctr": 0.002},
        {"keys": ["quiet lamp"], "impressions": 10, "clicks": 0, "ctr": 0.0},
    ]
    job = claim_oldest(conn, contract, ["seo"], settings.WORKER_OWNER, 1_000)
    process_seo(conn, contract, settings, job, fetch_rows=lambda *_a, **_k: rows)
    path = Path(settings.DATA_DIR) / "projects" / "p1" / "seo" / "seo1" / "gaps.json"
    gaps = json.loads(path.read_text(encoding="utf-8"))
    assert len(gaps) == 2
    assert {g["action"] for g in gaps} <= {"gap", "watch", "ok"}
    quiet = next(g for g in gaps if g["query"] == "quiet lamp")
    assert quiet["action"] == "watch"
    for g in gaps:
        assert set(g) >= {"query", "impressions", "clicks", "ctr", "action"}
    meta = json.loads(conn.execute("SELECT output_json FROM jobs WHERE id='seo1'").fetchone()["output_json"])
    assert meta["meta"]["autoPublish"] is False
