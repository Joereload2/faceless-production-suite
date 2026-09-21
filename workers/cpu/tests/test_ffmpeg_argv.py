from ffmpeg_argv import (
    captions_cmd,
    color_png_cmd,
    concat_cmd,
    ffprobe_cmd,
    loudnorm_cmd,
    mix_cmd,
    piper_cmd,
    still_seg_cmd,
)


def _assert_argv(cmd: list[str]) -> None:
    assert isinstance(cmd, list)
    assert all(isinstance(x, str) for x in cmd)
    assert cmd[0] != ""
    assert " " not in cmd[0]
    joined = " ".join(cmd)
    assert "&&" not in joined
    assert "shell" not in joined


def test_e0b_u2_loudnorm_argv() -> None:
    cmd = loudnorm_cmd("ffmpeg", "raw.wav", "voice.wav")
    _assert_argv(cmd)
    i = cmd.index("-af")
    assert cmd[i + 1] == "loudnorm=I=-14:TP=-1.5:LRA=11"


def test_all_cmds_are_argv_lists() -> None:
    cmds = [
        piper_cmd("piper", "voice.onnx", "raw.wav"),
        loudnorm_cmd("ffmpeg", "raw.wav", "voice.wav"),
        still_seg_cmd("ffmpeg", "still.png", 1.5, "seg-000.mp4"),
        concat_cmd("ffmpeg", "concat.txt", "concat_video.mp4"),
        mix_cmd("ffmpeg", "concat_video.mp4", "voice.wav", "with_audio.mp4"),
        captions_cmd("ffmpeg", "with_audio.mp4", "subtitles=x", "master.mp4"),
        ffprobe_cmd("ffprobe", "master.mp4"),
        color_png_cmd("clip-a.png", "#1a1a2e"),
    ]
    for cmd in cmds:
        _assert_argv(cmd)
