"""Zero-shot local clone (XTTS-v2). Optional extra: pip install 'faceless-cpu[clone]'."""

from __future__ import annotations

from pathlib import Path

CLONE_LANGS = {"en", "es"}


def resolve_ref_wav(data_dir: str, clone_ref: str) -> Path:
    if clone_ref.strip():
        return Path(clone_ref)
    return Path(data_dir) / "voices" / "me.wav"


def synthesize_clone(text: str, speaker_wav: Path, language: str, dest: Path) -> None:
    lang = language if language in CLONE_LANGS else "es"
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        from TTS.api import TTS
    except ImportError as e:
        raise RuntimeError("clone engine missing") from e
    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2")
    tts.tts_to_file(
        text=str(text).strip(),
        file_path=str(dest),
        speaker_wav=str(speaker_wav),
        language=lang,
    )
