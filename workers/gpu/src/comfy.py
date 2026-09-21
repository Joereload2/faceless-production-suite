from __future__ import annotations

import copy
import hashlib
import json
import time
from pathlib import Path

import httpx

from claim import complete_job, fail_job, utc_iso
from config import REPO_ROOT, Settings


def variant_seed(job_id: str, i: int) -> int:
    return int(hashlib.sha256(f"{job_id}:{i}".encode()).hexdigest()[:8], 16) % (2**32)


def load_preset() -> dict:
    return json.loads((REPO_ROOT / "presets" / "image-v1.json").read_text(encoding="utf-8"))


def process_image(conn, contract: dict, settings: Settings, job: dict, client: httpx.Client | None = None) -> None:
    owner = settings.WORKER_OWNER
    job_id = str(job["id"])
    project_id = str(job["project_id"])
    payload = json.loads(job["input_json"])
    prompt = str(payload["prompt"])
    variants = int(payload.get("variants") or 1)
    timeout_sec = int(job["timeout_sec"])
    http = client or httpx.Client(timeout=30)
    try:
        http.get(settings.COMFY_URL + "/system_stats")
    except Exception:
        fail_job(conn, contract, job_id, owner, "config", "comfy down", utc_iso())
        return
    workflow = load_preset()
    workflow["2"]["inputs"]["text"] = prompt
    files = []
    dest_root = Path(settings.DATA_DIR) / "projects" / project_id / "image" / job_id
    dest_root.mkdir(parents=True, exist_ok=True)
    deadline = time.time() + timeout_sec
    try:
        for i in range(variants):
            wf = copy.deepcopy(workflow)
            wf["5"]["inputs"]["seed"] = variant_seed(job_id, i)
            posted = http.post(settings.COMFY_URL.rstrip("/") + "/prompt", json={"prompt": wf})
            prompt_id = posted.json()["prompt_id"]
            image_bytes = b""
            while time.time() < deadline:
                hist = http.get(settings.COMFY_URL.rstrip("/") + f"/history/{prompt_id}")
                data = hist.json()
                node = (data.get(prompt_id) or data).get("outputs", {}).get("7", {})
                imgs = node.get("images") or []
                if imgs:
                    info = imgs[0]
                    raw = info.get("bytes")
                    if isinstance(raw, (bytes, bytearray)):
                        image_bytes = bytes(raw)
                    elif isinstance(raw, list):
                        image_bytes = bytes(raw)
                    else:
                        view = http.get(
                            settings.COMFY_URL.rstrip("/") + "/view",
                            params={
                                "filename": info.get("filename"),
                                "subfolder": info.get("subfolder") or "",
                                "type": info.get("type") or "output",
                            },
                        )
                        image_bytes = view.content
                    break
                time.sleep(1)
            if not image_bytes:
                fail_job(conn, contract, job_id, owner, "timeout", "comfy deadline", utc_iso())
                return
            out = dest_root / f"v{i}.png"
            out.write_bytes(image_bytes)
            files.append(
                {
                    "kind": "image",
                    "path": f"image/{job_id}/v{i}.png",
                    "mime": "image/png",
                    "bytes": out.stat().st_size,
                }
            )
        bytes_out = sum(f["bytes"] for f in files)
        output = json.dumps(
            {"files": files, "meta": {"preset": "image-v1", "width": 1280, "height": 720}},
            separators=(",", ":"),
        )
        complete_job(conn, contract, job_id, project_id, owner, output, bytes_out, utc_iso())
    except Exception as e:
        fail_job(conn, contract, job_id, owner, "internal", str(e)[:200], utc_iso())
