from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import httpx

from claim import complete_job, fail_job, utc_iso
from config import Settings
from db import add_stock_call, stock_calls_today, utc_day
from hash import canonical_json, input_hash
from paths import job_dir, project_dir

PEXELS_SEARCH = "https://api.pexels.com/v1/search"


def cache_key(query: str, orientation: str, source: str = "pexels") -> str:
    return input_hash({"source": source, "query": query, "orientation": orientation})


def process_stock(conn, contract: dict, settings: Settings, job: dict, http_get=httpx.get) -> None:
    owner = settings.WORKER_OWNER
    job_id = str(job["id"])
    project_id = str(job["project_id"])
    if not settings.PEXELS_API_KEY.strip():
        fail_job(conn, contract, job_id, owner, "config", "pexels key missing", utc_iso())
        return
    payload = json.loads(job["input_json"])
    query = str(payload["query"])
    orientation = str(payload["orientation"])
    count = int(payload["count"])
    source = str(payload.get("source") or "pexels")
    key = cache_key(query, orientation, source)
    cache_dir = Path(settings.DATA_DIR) / "cache" / "stock" / key
    meta_path = cache_dir / "meta.json"
    ttl = int(contract["limits"]["STOCK_CACHE_TTL_SEC"])
    cache_hit = False
    photos: list[dict] = []
    if meta_path.is_file():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        saved = datetime.fromisoformat(meta["savedAt"].replace("Z", "+00:00")).timestamp()
        if datetime.now(timezone.utc).timestamp() - saved <= ttl:
            cache_hit = True
            photos = meta["photos"]
    if not cache_hit:
        day = utc_day()
        if stock_calls_today(conn, day) >= settings.DAILY_STOCK_CALLS:
            fail_job(conn, contract, job_id, owner, "budget", "daily stock cap", utc_iso())
            return
        resp = http_get(
            PEXELS_SEARCH,
            params={"query": query, "orientation": orientation, "per_page": count},
            headers={"Authorization": settings.PEXELS_API_KEY},
            timeout=60,
        )
        data = resp.json()
        photos = list(data.get("photos") or [])[:count]
        add_stock_call(conn, day)
        cache_dir.mkdir(parents=True, exist_ok=True)
        (cache_dir / "meta.json").write_text(
            json.dumps(
                {
                    "savedAt": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
                    "photos": photos,
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
    dest = job_dir(settings.DATA_DIR, project_id, "stock", job_id)
    dest.mkdir(parents=True, exist_ok=True)
    files = []
    attrs = []
    now = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    for i, photo in enumerate(photos):
        url = photo["src"]["large"]
        name = f"asset-{i:02d}.jpg"
        out = dest / name
        cached_img = cache_dir / name
        if cache_hit and cached_img.is_file():
            out.write_bytes(cached_img.read_bytes())
        else:
            img = http_get(url, timeout=60)
            raw = img.content if hasattr(img, "content") else img.read()
            out.write_bytes(raw)
            cache_dir.mkdir(parents=True, exist_ok=True)
            cached_img.write_bytes(raw)
        attr = {
            "provider": "pexels",
            "id": str(photo.get("id")),
            "author": photo.get("photographer") or "",
            "license": "Pexels License",
            "url": photo.get("url") or "",
            "savedAt": now,
        }
        (dest / f"asset-{i:02d}.attribution.json").write_text(json.dumps(attr, ensure_ascii=False, indent=2), encoding="utf-8")
        attrs.append(attr)
        files.append(
            {
                "kind": "image",
                "path": f"stock/{job_id}/{name}",
                "mime": "image/jpeg",
                "bytes": out.stat().st_size,
            }
        )
    proj = project_dir(settings.DATA_DIR, project_id)
    proj.mkdir(parents=True, exist_ok=True)
    attr_path = proj / "attribution.json"
    existing = []
    if attr_path.is_file():
        existing = json.loads(attr_path.read_text(encoding="utf-8"))
        if not isinstance(existing, list):
            existing = []
    existing.extend(attrs)
    attr_path.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
    bytes_out = sum(f["bytes"] for f in files)
    output = json.dumps(
        {"files": files, "meta": {"stockCalls": 0 if cache_hit else 1, "cacheHit": cache_hit, "attribution": attrs}},
        separators=(",", ":"),
    )
    complete_job(
        conn,
        contract,
        job_id,
        project_id,
        owner,
        output,
        bytes_out,
        utc_iso(),
        stock_calls=0 if cache_hit else 1,
    )
