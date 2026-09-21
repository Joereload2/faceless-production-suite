from __future__ import annotations

import sqlite3
from pathlib import Path


def connect(db_path: str | Path, pragmas: list[str]) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path), isolation_level=None, timeout=5, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    for p in pragmas:
        conn.execute(p)
    return conn
