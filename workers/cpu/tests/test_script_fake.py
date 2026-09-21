from __future__ import annotations

import json
from pathlib import Path

from claim import claim_oldest
from modules.script import process_script


def insert_script(conn, job_id: str = "s1") -> None:
    now = "2026-09-19T00:00:00.000Z"
    conn.execute(
        """INSERT INTO jobs (id, project_id, module, engine, status, progress, timeout_sec,
           idempotency_key, created_by, input_hash, input_json, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            job_id,
            "p1",
            "script",
            "local",
            "queued",
            0,
            180,
            f"k-{job_id}",
            "api",
            "h",
            json.dumps({"brief": "ten chars of night library brief.", "language": "en", "targetDurationSec": 60}),
            now,
            now,
        ),
    )


class FakeResp:
    def json(self):
        return {
            "content": [
                {
                    "text": json.dumps(
                        {
                            "version": 1,
                            "language": "en",
                            "title": "Night library",
                            "fullText": "The lamp waits.",
                            "paragraphs": ["The lamp waits."],
                            "wordCount": 3,
                            "originalityNotes": "ok",
                            "shotlist": {"shots": [{"id": 1, "visual": "lamp"}]},
                        }
                    )
                }
            ],
            "usage": {"input_tokens": 12, "output_tokens": 8},
        }


def test_e3b_i1_fake_claude_writes_json(conn, contract, settings) -> None:
    settings.ANTHROPIC_API_KEY = "sk-test"
    insert_script(conn)
    job = claim_oldest(conn, contract, ["script"], settings.WORKER_OWNER, 1_000)
    assert job
    process_script(conn, contract, settings, job, http_post=lambda *a, **k: FakeResp())
    root = Path(settings.DATA_DIR) / "projects" / "p1" / "script" / "s1"
    assert (root / "script.json").is_file()
    assert (root / "shotlist.json").is_file()
    row = conn.execute("SELECT status FROM jobs WHERE id='s1'").fetchone()
    assert row["status"] == "done"
    assert json.loads((root / "script.json").read_text(encoding="utf-8"))["title"] == "Night library"


def test_e3b_i3_daily_budget_zero(conn, contract, settings) -> None:
    settings.ANTHROPIC_API_KEY = "sk-test"
    settings.DAILY_TOKEN_BUDGET = 0
    insert_script(conn, "s2")
    job = claim_oldest(conn, contract, ["script"], settings.WORKER_OWNER, 1_000)
    calls = {"n": 0}

    def boom(*_a, **_k):
        calls["n"] += 1
        raise AssertionError("network")

    process_script(conn, contract, settings, job, http_post=boom)
    row = conn.execute("SELECT status, error_code FROM jobs WHERE id='s2'").fetchone()
    assert row["status"] == "error"
    assert row["error_code"] == "budget"
    assert calls["n"] == 0
