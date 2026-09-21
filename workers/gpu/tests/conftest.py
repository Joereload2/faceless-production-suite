from __future__ import annotations

import sqlite3
import tempfile
from pathlib import Path

import pytest

from config import Settings


@pytest.fixture
def repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


@pytest.fixture
def settings(repo_root: Path) -> Settings:
    data = Path(tempfile.mkdtemp(prefix="faceless-e6-"))
    return Settings(
        DATA_DIR=str(data),
        CONTRACT_JSON=str(repo_root / "packages" / "schema" / "contract.json"),
        COMFY_URL="http://127.0.0.1:8188",
        WORKER_OWNER="gpu-test",
    )


@pytest.fixture
def contract(settings: Settings) -> dict:
    return settings.load_contract()


@pytest.fixture
def conn(settings: Settings, contract: dict, repo_root: Path) -> sqlite3.Connection:
    db_path = Path(settings.DATA_DIR) / "studio.sqlite"
    c = sqlite3.connect(str(db_path), isolation_level=None, timeout=5)
    c.row_factory = sqlite3.Row
    for p in contract["pragmas"]:
        c.execute(p)
    c.executescript((repo_root / "apps" / "api" / "drizzle" / "0001_init.sql").read_text(encoding="utf-8"))
    c.execute(contract["sql"]["oneGpuRunning"])
    now = "2026-09-19T00:00:00.000Z"
    c.execute(
        "INSERT INTO projects (id, title, channel, created_at, updated_at) VALUES (?,?,?,?,?)",
        ("p1", "t", "demo", now, now),
    )
    yield c
    c.close()
