from pathlib import Path


def write_concat_txt(dest: Path, count: int) -> None:
    lines = [f"file 'seg-{i:03d}.mp4'" for i in range(count)]
    dest.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
