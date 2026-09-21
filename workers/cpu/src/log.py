import json
from datetime import datetime, timezone


def log(*, level: str, event: str, **fields: object) -> None:
    banned = {"text", "prompt", "token", "authorization", "cookie", "script", "brief"}
    line = {
        "level": level,
        "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "event": event,
    }
    for k, v in fields.items():
        if k not in banned:
            line[k] = v
    print(json.dumps(line, ensure_ascii=False, separators=(",", ":")))
