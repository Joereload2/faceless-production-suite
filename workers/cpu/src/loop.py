from __future__ import annotations

import time
from pathlib import Path

from claim import claim_oldest
from config import Settings
from db import connect
from log import log
from modules.script import process_script
from modules.stock import process_stock
from modules.tts import process_tts

CPU_MODULES = ["script", "tts", "stock"]


def run_loop(settings: Settings | None = None) -> None:
    settings = settings or Settings()
    contract = settings.load_contract()
    db_path = Path(settings.DATA_DIR) / "studio.sqlite"
    conn = connect(db_path, list(contract["pragmas"]))
    owner = settings.WORKER_OWNER
    log(level="info", event="cpu_loop", owner=owner)
    while True:
        job = claim_oldest(conn, contract, CPU_MODULES, owner, int(time.time() * 1000))
        if not job:
            time.sleep(0.5)
            continue
        module = str(job["module"])
        if module == "script":
            process_script(conn, contract, settings, job)
        elif module == "tts":
            process_tts(conn, contract, settings, job)
        elif module == "stock":
            process_stock(conn, contract, settings, job)
