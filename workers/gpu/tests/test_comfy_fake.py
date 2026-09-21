from __future__ import annotations

from pathlib import Path

from claim import claim_oldest
from comfy import process_image

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


class FakeResp:
    def __init__(self, payload=None, content=b""):
        self._payload = payload or {}
        self.content = content

    def json(self):
        return self._payload


class FakeClient:
    def __init__(self):
        self.posts = 0

    def get(self, url, params=None):
        if url.endswith("/system_stats"):
            return FakeResp({})
        if "/history/" in url:
            return FakeResp({"pid": {"outputs": {"7": {"images": [{"bytes": PNG}]}}}})
        if url.endswith("/view"):
            return FakeResp({}, PNG)
        return FakeResp({})

    def post(self, url, json=None):
        self.posts += 1
        return FakeResp({"prompt_id": "pid"})


def test_e6_i1_fake_comfy_png(conn, contract, settings) -> None:
    now = "2026-09-19T00:00:00.000Z"
    conn.execute(
        """INSERT INTO jobs (id, project_id, module, engine, status, progress, timeout_sec,
           idempotency_key, created_by, input_hash, input_json, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            "img1",
            "p1",
            "image",
            "local",
            "queued",
            0,
            180,
            "k-img1",
            "api",
            "h",
            '{"prompt":"night lamp","variants":1,"preset":"image-v1"}',
            now,
            now,
        ),
    )
    job = claim_oldest(conn, contract, ["image"], settings.WORKER_OWNER, 1_000)
    assert job
    process_image(conn, contract, settings, job, client=FakeClient())
    png = Path(settings.DATA_DIR) / "projects" / "p1" / "image" / "img1" / "v0.png"
    assert png.is_file() and png.stat().st_size > 0
    row = conn.execute("SELECT status, bytes_out FROM jobs WHERE id='img1'").fetchone()
    assert row["status"] == "done"
    assert row["bytes_out"] > 0
