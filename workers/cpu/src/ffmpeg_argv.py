def piper_cmd(piper_bin: str, voice_onnx: str, raw_wav: str) -> list[str]:
    return [piper_bin, "--model", voice_onnx, "--output_file", raw_wav]


def loudnorm_cmd(ffmpeg_bin: str, raw_wav: str, dest_wav: str) -> list[str]:
    return [
        ffmpeg_bin,
        "-y",
        "-i",
        raw_wav,
        "-af",
        "loudnorm=I=-14:TP=-1.5:LRA=11",
        "-ar",
        "48000",
        "-ac",
        "1",
        dest_wav,
    ]


def still_seg_cmd(ffmpeg_bin: str, image_path: str, dur: float | str, seg_path: str) -> list[str]:
    dur_s = dur if isinstance(dur, str) else f"{dur:.3f}"
    return [
        ffmpeg_bin,
        "-y",
        "-loop",
        "1",
        "-framerate",
        "30",
        "-t",
        dur_s,
        "-i",
        image_path,
        "-vf",
        "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        "-an",
        "-movflags",
        "+faststart",
        seg_path,
    ]


def concat_cmd(ffmpeg_bin: str, concat_txt: str, concat_video: str) -> list[str]:
    return [ffmpeg_bin, "-y", "-f", "concat", "-safe", "0", "-i", concat_txt, "-c", "copy", concat_video]


def mix_cmd(ffmpeg_bin: str, concat_video: str, voice_wav: str, with_audio: str) -> list[str]:
    return [
        ffmpeg_bin,
        "-y",
        "-i",
        concat_video,
        "-i",
        voice_wav,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-movflags",
        "+faststart",
        with_audio,
    ]


def captions_cmd(ffmpeg_bin: str, with_audio: str, vf: str, master: str) -> list[str]:
    return [ffmpeg_bin, "-y", "-i", with_audio, "-vf", vf, "-c:a", "copy", master]


def ffprobe_cmd(ffprobe_bin: str, file: str) -> list[str]:
    return [
        ffprobe_bin,
        "-v",
        "error",
        "-show_entries",
        "format=duration:stream=codec_type,codec_name,width,height",
        "-of",
        "json",
        file,
    ]


def color_png_cmd(path: str, color_hex: str, w: int = 1920, h: int = 1080, ffmpeg_bin: str = "ffmpeg") -> list[str]:
    return [
        ffmpeg_bin,
        "-y",
        "-f",
        "lavfi",
        "-i",
        f"color=c={color_hex}:s={w}x{h}:d=1",
        "-frames:v",
        "1",
        path,
    ]
