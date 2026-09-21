import json
import os
from pathlib import Path


def split_segments(duration: float) -> list[tuple[float, float]]:
    env = os.environ.get("CONTRACT_JSON")
    path = Path(env) if env else Path(__file__).resolve().parents[4] / "packages/schema/contract.json"
    limits = json.loads(path.read_text(encoding="utf-8"))["limits"]
    min_sec = float(limits["SEGMENT_SEC_MIN"])
    max_sec = float(limits["SEGMENT_SEC_MAX"])
    t = 0.0
    segs: list[tuple[float, float]] = []
    while t < duration - 1e-6:
        remaining = duration - t
        if remaining <= max_sec:
            segs.append((t, duration))
            break
        if remaining - max_sec < min_sec:
            segs.append((t, duration))
            break
        segs.append((t, t + max_sec))
        t += max_sec
    return segs
