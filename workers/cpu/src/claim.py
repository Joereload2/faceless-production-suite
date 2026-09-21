from __future__ import annotations

import sqlite3
from datetime import datetime, timezone


def utc_iso(ms: int | None = None) -> str:
    if ms is None:
        dt = datetime.now(timezone.utc)
    else:
        dt = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    return dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def claim_pick_sql(template: str, modules: list[str], allowed: dict) -> str:
    if not modules:
        raise ValueError("empty module list")
    for m in modules:
        if m not in allowed:
            raise ValueError(f"invalid module: {m}")
    listed = ", ".join(f"'{m}'" for m in modules)
    return template.replace("__MODULES__", listed)


def claim_oldest(
    conn: sqlite3.Connection,
    contract: dict,
    modules: list[str],
    owner: str,
    now_ms: int,
) -> dict | None:
    sql_pick = claim_pick_sql(contract["sql"]["claimPickTemplate"], modules, contract["modules"])
    conn.execute("BEGIN IMMEDIATE")
    try:
        pick = conn.execute(sql_pick).fetchone()
        if pick is None:
            conn.execute("COMMIT")
            return None
        now = utc_iso(now_ms)
        lease_ms = int(contract["limits"]["LEASE_MS"])
        timeout_sec = int(pick["timeout_sec"])
        lease_until = utc_iso(now_ms + lease_ms)
        deadline_at = utc_iso(now_ms + timeout_sec * 1000)
        rows = conn.execute(
            contract["sql"]["claimById"],
            {
                "owner": owner,
                "now": now,
                "lease_until": lease_until,
                "deadline_at": deadline_at,
                "id": pick["id"],
            },
        ).fetchall()
        conn.execute("COMMIT")
        if not rows:
            return None
        return dict(rows[0])
    except Exception:
        try:
            conn.execute("ROLLBACK")
        except Exception:
            pass
        raise


def complete_job(
    conn: sqlite3.Connection,
    contract: dict,
    job_id: str,
    project_id: str,
    owner: str,
    output_json: str,
    bytes_out: int,
    now_iso: str,
) -> None:
    conn.execute("BEGIN IMMEDIATE")
    rows = conn.execute(
        contract["sql"]["complete"],
        {
            "output_json": output_json,
            "bytes_out": bytes_out,
            "cost_usd": None,
            "tokens_in": None,
            "tokens_out": None,
            "gpu_sec": None,
            "stock_calls": None,
            "now": now_iso,
            "id": job_id,
            "owner": owner,
        },
    ).fetchall()
    if not rows:
        conn.execute("ROLLBACK")
        raise RuntimeError("complete missed")
    conn.execute(contract["sql"]["addBytes"], {"delta": bytes_out, "now": now_iso, "id": project_id})
    conn.execute("COMMIT")


def fail_job(
    conn: sqlite3.Connection,
    contract: dict,
    job_id: str,
    owner: str,
    error_code: str,
    error: str,
    now_iso: str,
) -> None:
    conn.execute(
        contract["sql"]["fail"],
        {
            "error_code": error_code,
            "error": error,
            "now": now_iso,
            "id": job_id,
            "owner": owner,
        },
    ).fetchall()
