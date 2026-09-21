from pathlib import Path

FORCE_STYLE = (
    "FontName=Arial,FontSize=24,Bold=0,Italic=0,"
    "PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000,"
    "Outline=2,Shadow=0,Alignment=2,MarginL=80,MarginR=80,MarginV=48"
)


def subtitles_filter(path: Path) -> str:
    p = path.resolve().as_posix()
    p = p.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")
    return f"subtitles='{p}':force_style='{FORCE_STYLE}'"
