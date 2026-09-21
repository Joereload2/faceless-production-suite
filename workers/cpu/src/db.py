from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path


def connect(db_path: str | Path, pragmas: list[str]) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path), isolation_level=None, timeout=5, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    for p in pragmas:
        conn.execute(p)
    return conn


def utc_day() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def token_usage_today(conn: sqlite3.Connection, day: str) -> tuple[int, int]:
    row = conn.execute("SELECT tokens_in, tokens_out FROM daily_usage WHERE day = ?", (day,)).fetchone()
    if not row:
        return 0, 0
    return int(row["tokens_in"]), int(row["tokens_out"])


def add_token_usage(conn: sqlite3.Connection, day: str, tokens_in: int, tokens_out: int) -> None:
    conn.execute(
        """INSERT INTO daily_usage (day, tokens_in, tokens_out, stock_calls)
           VALUES (?, ?, ?, 0)
           ON CONFLICT(day) DO UPDATE SET
             tokens_in = tokens_in + excluded.tokens_in,
             tokens_out = tokens_out + excluded.tokens_out""",
        (day, tokens_in, tokens_out),
    )


def stock_calls_today(conn: sqlite3.Connection, day: str) -> int:
    row = conn.execute("SELECT stock_calls FROM daily_usage WHERE day = ?", (day,)).fetchone()
    if not row:
        return 0
    return int(row["stock_calls"])


def add_stock_call(conn: sqlite3.Connection, day: str) -> None:
    conn.execute(
        """INSERT INTO daily_usage (day, tokens_in, tokens_out, stock_calls)
           VALUES (?, 0, 0, 1)
           ON CONFLICT(day) DO UPDATE SET stock_calls = stock_calls + 1""",
        (day,),
    )
