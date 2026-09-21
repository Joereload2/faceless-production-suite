from __future__ import annotations

import json
from pathlib import Path

from claim import claim_oldest
from modules.stock import cache_key, process_stock


def insert_stock(conn, job_id: str = "st1") -> None:
    now = "2026-09-19T00:00:00.000Z"
    conn.execute(
        """INSERT INTO jobs (id, project_id, module, engine, status, progress, timeout_sec,
           idempotency_key, created_by, input_hash, input_json, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            job_id,
            "p1",
            "stock",
            "local",
            "queued",
            0,
            60,
            f"k-{job_id}",
            "api",
            "h",
            json.dumps({"query": "night library", "orientation": "landscape", "count": 1}),
            now,
            now,
        ),
    )


class FakeSearch:
    def json(self):
        return {
            "photos": [
                {
                    "id": 1,
                    "photographer": "x",
                    "url": "https://example",
                    "src": {"large": "https://example/x.jpg"},
                }
            ]
        }

    content = b""


class FakeImg:
    content = b"\xff\xd8\xffJPEG"

    def json(self):
        return {}


def test_e4_u1_cache_key_stable() -> None:
    a = cache_key("night library", "landscape", "pexels")
    b = cache_key("night library", "landscape", "pexels")
    assert a == b
    assert len(a) == 64


def test_e4_i3_missing_key(conn, contract, settings) -> None:
    settings.PEXELS_API_KEY = ""
    insert_stock(conn)
    job = claim_oldest(conn, contract, ["stock"], settings.WORKER_OWNER, 1_000)
    process_stock(conn, contract, settings, job, http_get=lambda *a, **k: (_ for _ in ()).throw(AssertionError("net")))
    row = conn.execute("SELECT error_code FROM jobs WHERE id='st1'").fetchone()
    assert row["error_code"] == "config"


def test_e4_i1_and_i2_cache(conn, contract, settings) -> None:
    settings.PEXELS_API_KEY = "px-test"
    counts = {"search": 0, "dl": 0}

    def fake_get(url, *a, **k):
        if "api.pexels.com" in str(url):
            counts["search"] += 1
            return FakeSearch()
        counts["dl"] += 1
        return FakeImg()

    insert_stock(conn, "st1")
    job = claim_oldest(conn, contract, ["stock"], settings.WORKER_OWNER, 1_000)
    process_stock(conn, contract, settings, job, http_get=fake_get)
    asset = Path(settings.DATA_DIR) / "projects" / "p1" / "stock" / "st1" / "asset-00.jpg"
    attr = Path(settings.DATA_DIR) / "projects" / "p1" / "attribution.json"
    assert asset.is_file()
    assert json.loads(attr.read_text(encoding="utf-8"))[0]["provider"] == "pexels"
    assert counts["search"] == 1

    insert_stock(conn, "st2")
    job2 = claim_oldest(conn, contract, ["stock"], settings.WORKER_OWNER, 2_000)
    process_stock(conn, contract, settings, job2, http_get=fake_get)
    assert counts["search"] == 1
    row = conn.execute("SELECT status FROM jobs WHERE id='st2'").fetchone()
    assert row["status"] == "done"
