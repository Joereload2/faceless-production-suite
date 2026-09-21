from __future__ import annotations

import time
from pathlib import Path

from claim import claim_oldest
from config import Settings
from db import connect
from log import log
from modules.tts import process_tts


def run_loop(settings: Settings | None = None) -> None:
    settings = settings or Settings()
    contract = settings.load_contract()
    db_path = Path(settings.DATA_DIR) / "studio.sqlite"
    conn = connect(db_path, list(contract["pragmas"]))
    owner = settings.WORKER_OWNER
    log(level="info", event="cpu_loop", owner=owner)
    while True:
        job = claim_oldest(conn, contract, ["tts"], owner, int(time.time() * 1000))
        if not job:
            time.sleep(0.5)
            continue
        process_tts(conn, contract, settings, job)
