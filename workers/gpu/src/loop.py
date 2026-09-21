from __future__ import annotations

import sqlite3
import time
from pathlib import Path

from claim import claim_oldest
from comfy import process_image
from config import Settings


def connect(db_path: Path, pragmas: list[str]) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path), isolation_level=None, timeout=5)
    conn.row_factory = sqlite3.Row
    for p in pragmas:
        conn.execute(p)
    return conn


def run_loop(settings: Settings | None = None) -> None:
    settings = settings or Settings()
    contract = settings.load_contract()
    conn = connect(Path(settings.DATA_DIR) / "studio.sqlite", list(contract["pragmas"]))
    while True:
        try:
            job = claim_oldest(conn, contract, ["image"], settings.WORKER_OWNER, int(time.time() * 1000))
        except Exception:
            time.sleep(1)
            continue
        if not job:
            time.sleep(1)
            continue
        process_image(conn, contract, settings, job)
