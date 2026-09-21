from __future__ import annotations

import json
import re
from pathlib import Path

import httpx

from claim import complete_job, fail_job, utc_iso
from config import REPO_ROOT, Settings
from db import add_token_usage, token_usage_today, utc_day
from paths import job_dir

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"


def _strip_fences(text: str) -> str:
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*", "", t)
    t = re.sub(r"\s*```$", "", t)
    return t.strip()


def process_script(conn, contract: dict, settings: Settings, job: dict, http_post=httpx.post) -> None:
    owner = settings.WORKER_OWNER
    job_id = str(job["id"])
    project_id = str(job["project_id"])
    if not settings.ANTHROPIC_API_KEY.strip():
        fail_job(conn, contract, job_id, owner, "config", "anthropic key missing", utc_iso())
        return

    max_tokens = int(contract["limits"]["SCRIPT_MAX_TOKENS"])
    day = utc_day()
    tin, tout = token_usage_today(conn, day)
    if tin + tout + max_tokens > settings.DAILY_TOKEN_BUDGET:
        fail_job(conn, contract, job_id, owner, "budget", "daily token budget", utc_iso())
        return

    project = conn.execute("SELECT channel FROM projects WHERE id = ?", (project_id,)).fetchone()
    channel = project["channel"] if project else "demo"
    tone_path = REPO_ROOT / "channels" / channel / "tone.md"
    system = tone_path.read_text(encoding="utf-8") if tone_path.is_file() else ""
    payload = json.loads(job["input_json"])
    brief = str(payload.get("brief", ""))
    user = (
        "Return ONLY JSON with keys version,language,title,fullText,paragraphs,wordCount,"
        "originalityNotes and shotlist object with shots. "
        f"<user_brief>\n{brief}\n</user_brief>"
    )
    resp = http_post(
        ANTHROPIC_URL,
        headers={
            "x-api-key": settings.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": settings.ANTHROPIC_MODEL,
            "max_tokens": max_tokens,
            "system": system,
            "messages": [{"role": "user", "content": user}],
        },
        timeout=120,
    )
    body = resp.json()
    text = body["content"][0]["text"]
    parsed = json.loads(_strip_fences(text))
    paragraphs = parsed.get("paragraphs") or []
    if len(paragraphs) < 1:
        fail_job(conn, contract, job_id, owner, "validation", "paragraphs min 1", utc_iso())
        return
    shotlist = parsed.get("shotlist") or {"shots": []}
    root = job_dir(settings.DATA_DIR, project_id, "script", job_id)
    root.mkdir(parents=True, exist_ok=True)
    script_path = root / "script.json"
    shots_path = root / "shotlist.json"
    script_bytes = json.dumps(parsed, ensure_ascii=False, indent=2).encode("utf-8")
    shots_bytes = json.dumps(shotlist, ensure_ascii=False, indent=2).encode("utf-8")
    script_path.write_bytes(script_bytes)
    shots_path.write_bytes(shots_bytes)
    usage = body.get("usage") or {}
    tokens_in = int(usage.get("input_tokens") or 0)
    tokens_out = int(usage.get("output_tokens") or 0)
    add_token_usage(conn, day, tokens_in, tokens_out)
    bytes_out = len(script_bytes) + len(shots_bytes)
    output = json.dumps(
        {
            "files": [
                {
                    "kind": "json",
                    "path": f"script/{job_id}/script.json",
                    "mime": "application/json",
                    "bytes": len(script_bytes),
                },
                {
                    "kind": "json",
                    "path": f"script/{job_id}/shotlist.json",
                    "mime": "application/json",
                    "bytes": len(shots_bytes),
                },
            ],
            "meta": {"model": settings.ANTHROPIC_MODEL},
        },
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
        tokens_in=tokens_in,
        tokens_out=tokens_out,
    )
