from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

from claim import complete_job, fail_job, utc_iso
from config import Settings
from paths import job_dir

auto_publish = False


def classify_row(impressions: float, ctr: float, floor: float, gap: float) -> str:
    if impressions < floor:
        return "watch"
    if ctr < gap:
        return "gap"
    return "ok"


def fetch_gsc_rows(
    settings: Settings,
    site_url: str,
    start: str,
    end: str,
    row_limit: int,
    http_post=httpx.post,
) -> list[dict]:
    if not settings.GSC_CLIENT_SECRET_PATH.strip() or not Path(settings.GSC_CLIENT_SECRET_PATH).is_file():
        raise RuntimeError("gsc credentials missing")
    url = f"https://searchconsole.googleapis.com/webmasters/v3/sites/{site_url}/searchAnalytics/query"
    resp = http_post(
        url,
        json={"startDate": start, "endDate": end, "dimensions": ["query"], "rowLimit": row_limit},
        timeout=60,
    )
    data = resp.json()
    return list(data.get("rows") or [])


def process_seo(conn, contract: dict, settings: Settings, job: dict, fetch_rows=None) -> None:
    owner = settings.WORKER_OWNER
    job_id = str(job["id"])
    project_id = str(job["project_id"])
    payload = json.loads(job["input_json"])
    site_url = str(payload["siteUrl"])
    days = int(payload["days"])
    limits = contract["limits"]
    floor = float(limits["IMPRESSION_FLOOR"])
    gap = float(limits["SEO_CTR_GAP"])
    row_limit = int(limits["SEO_ROW_LIMIT"])
    claude_n = int(limits["SEO_CLAUDE_ROWS"])
    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=days)
    try:
        raw = (fetch_rows or fetch_gsc_rows)(
            settings,
            site_url,
            start.isoformat(),
            end.isoformat(),
            row_limit,
        )
    except RuntimeError as e:
        fail_job(conn, contract, job_id, owner, "config", str(e), utc_iso())
        return
    gaps = []
    for row in raw:
        keys = row.get("keys") or [row.get("query")]
        query = keys[0] if keys else ""
        impressions = float(row.get("impressions") or 0)
        clicks = float(row.get("clicks") or 0)
        ctr = float(row.get("ctr") or 0)
        action = classify_row(impressions, ctr, floor, gap)
        gaps.append(
            {
                "query": query,
                "impressions": impressions,
                "clicks": clicks,
                "ctr": ctr,
                "action": action,
            }
        )
    notes = ""
    if settings.ANTHROPIC_API_KEY.strip() and gaps:
        notes = ""  # fake/CI: no raw dump; live would summarize gaps[:claude_n]
        _ = claude_n
    root = job_dir(settings.DATA_DIR, project_id, "seo", job_id)
    root.mkdir(parents=True, exist_ok=True)
    gaps_path = root / "gaps.json"
    gaps_bytes = json.dumps(gaps, ensure_ascii=False, indent=2).encode("utf-8")
    gaps_path.write_bytes(gaps_bytes)
    output = json.dumps(
        {
            "files": [
                {
                    "kind": "json",
                    "path": f"seo/{job_id}/gaps.json",
                    "mime": "application/json",
                    "bytes": len(gaps_bytes),
                }
            ],
            "meta": {"autoPublish": auto_publish, "gaps": gaps, "notes": notes},
        },
        separators=(",", ":"),
    )
    complete_job(conn, contract, job_id, project_id, owner, output, len(gaps_bytes), utc_iso())
