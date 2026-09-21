from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from modules.assemble import run_assemble
from process_kill import spawn

ffmpeg_ok = shutil.which("ffmpeg") and shutil.which("ffprobe")


@pytest.mark.skipif(not ffmpeg_ok, reason="ffmpeg required")
def test_e7_e2e_sine_and_pngs(settings) -> None:
    pid = "p1"
    root = Path(settings.DATA_DIR) / "projects" / pid
    tts = root / "tts" / "audio8sec"
    img_a = root / "image" / "pngA0001"
    img_b = root / "image" / "pngB0001"
    for d in (tts, img_a, img_b):
        d.mkdir(parents=True)
    spawn(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=8",
            "-ar",
            "48000",
            "-ac",
            "1",
            str(tts / "voice.wav"),
        ],
        timeout_sec=30,
    )
    for path, color in ((img_a / "a.png", "#1a1a2e"), (img_b / "b.png", "#16213e")):
        spawn(
            [
                "ffmpeg",
                "-y",
                "-f",
                "lavfi",
                "-i",
                f"color=c={color}:s=1920x1080:d=1",
                "-frames:v",
                "1",
                str(path),
            ],
            timeout_sec=30,
        )
    job = {
        "id": "e2e1",
        "project_id": pid,
        "timeout_sec": 600,
        "input_json": json.dumps(
            {
                "spec": {
                    "width": 1920,
                    "height": 1080,
                    "fps": 30,
                    "audioJobId": "audio8sec",
                    "clips": [
                        {
                            "fileJobId": "pngA0001",
                            "fileName": "a.png",
                            "fileKind": "image",
                            "timelineStartSec": 0,
                            "timelineEndSec": 4,
                        },
                        {
                            "fileJobId": "pngB0001",
                            "fileName": "b.png",
                            "fileKind": "image",
                            "timelineStartSec": 4,
                            "timelineEndSec": 8,
                        },
                    ],
                }
            }
        ),
    }
    result = run_assemble(settings, job)
    master = Path(result["master"])
    assert master.is_file()
    assert result["probe"]["hasAudio"] and result["probe"]["hasVideo"]
    assert abs(result["probe"]["durationSec"] - 8) <= 0.5
