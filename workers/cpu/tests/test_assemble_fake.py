from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from modules.assemble import run_assemble
from process_kill import spawn


ffmpeg_ok = shutil.which("ffmpeg") and shutil.which("ffprobe")


def _lavfi_png(path: Path, color: str) -> None:
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


def _sine_wav(path: Path, seconds: float) -> None:
    spawn(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"sine=frequency=440:duration={seconds}",
            "-ar",
            "48000",
            "-ac",
            "1",
            str(path),
        ],
        timeout_sec=30,
    )


@pytest.mark.skipif(not ffmpeg_ok, reason="ffmpeg required")
def test_e7_i1_i3_concat_not_tmp(settings) -> None:
    pid = "p1"
    root = Path(settings.DATA_DIR) / "projects" / pid
    tts = root / "tts" / "audio001"
    img_a = root / "image" / "clipA001"
    img_b = root / "image" / "clipB001"
    for d in (tts, img_a, img_b):
        d.mkdir(parents=True)
    _sine_wav(tts / "voice.wav", 4)
    _lavfi_png(img_a / "a.png", "#1a1a2e")
    _lavfi_png(img_b / "b.png", "#16213e")
    job = {
        "id": "asm1",
        "project_id": pid,
        "timeout_sec": 600,
        "input_json": json.dumps(
            {
                "spec": {
                    "width": 1920,
                    "height": 1080,
                    "fps": 30,
                    "audioJobId": "audio001",
                    "clips": [
                        {
                            "fileJobId": "clipA001",
                            "fileName": "a.png",
                            "fileKind": "image",
                            "timelineStartSec": 0,
                            "timelineEndSec": 2,
                        },
                        {
                            "fileJobId": "clipB001",
                            "fileName": "b.png",
                            "fileKind": "image",
                            "timelineStartSec": 2,
                            "timelineEndSec": 4,
                        },
                    ],
                }
            }
        ),
    }
    result = run_assemble(settings, job)
    assert result["probe"]["hasVideo"] is True
    first_seg = next(cmd for cmd in result["argv"] if "-an" in cmd and "-loop" in cmd)
    assert "-an" in first_seg
    concat_txt = Path(settings.DATA_DIR) / "projects" / pid / "assemble" / "asm1" / "concat.txt"
    text = concat_txt.read_text(encoding="utf-8")
    assert "file 'seg-000.mp4'" in text
    assert "tmp/" not in text
    master = Path(settings.DATA_DIR) / "projects" / pid / "export" / "master_16x9.mp4"
    assert master.is_file()
