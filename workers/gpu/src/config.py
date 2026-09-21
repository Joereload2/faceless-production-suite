from __future__ import annotations

import json
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATA_DIR: str = "./data"
    COMFY_URL: str = "http://127.0.0.1:8188"
    CONTRACT_JSON: str = ""
    WORKER_OWNER: str = "gpu-local"

    def contract_path(self) -> Path:
        if self.CONTRACT_JSON.strip():
            return Path(self.CONTRACT_JSON)
        return REPO_ROOT / "packages" / "schema" / "contract.json"

    def load_contract(self) -> dict:
        return json.loads(self.contract_path().read_text(encoding="utf-8"))
