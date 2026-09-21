from __future__ import annotations

import sqlite3
import tempfile
from pathlib import Path

import pytest

from config import Settings
from db import connect


@pytest.fixture
def repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


@pytest.fixture
def settings(repo_root: Path) -> Settings:
    data = Path(tempfile.mkdtemp(prefix="faceless-e3-"))
    return Settings(
        DATA_DIR=str(data),
        CONTRACT_JSON=str(repo_root / "packages" / "schema" / "contract.json"),
        PIPER_BIN="piper",
        PIPER_VOICE="",
        FFMPEG_BIN="ffmpeg",
        FFPROBE_BIN="ffprobe",
        WORKER_OWNER="cpu-test",
    )


@pytest.fixture
def contract(settings: Settings) -> dict:
    return settings.load_contract()


@pytest.fixture
def conn(settings: Settings, contract: dict, repo_root: Path) -> sqlite3.Connection:
    db_path = Path(settings.DATA_DIR) / "studio.sqlite"
    c = connect(db_path, list(contract["pragmas"]))
    sql = (repo_root / "apps" / "api" / "drizzle" / "0001_init.sql").read_text(encoding="utf-8")
    c.executescript(sql)
    c.execute(contract["sql"]["oneGpuRunning"])
    now = "2026-09-19T00:00:00.000Z"
    c.execute(
        "INSERT INTO projects (id, title, channel, created_at, updated_at) VALUES (?,?,?,?,?)",
        ("p1", "t", "demo", now, now),
    )
    yield c
    c.close()


def insert_tts(conn: sqlite3.Connection, job_id: str = "j1", timeout_sec: int = 120) -> None:
    now = "2026-09-19T00:00:00.000Z"
    conn.execute(
        """INSERT INTO jobs (id, project_id, module, engine, status, progress, timeout_sec,
           idempotency_key, created_by, input_hash, input_json, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            job_id,
            "p1",
            "tts",
            "local",
            "queued",
            0,
            timeout_sec,
            f"k-{job_id}",
            "api",
            "h",
            '{"text":"hello library"}',
            now,
            now,
        ),
    )
