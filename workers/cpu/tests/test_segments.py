from assemble.segments import split_segments


def test_e0b_u1_split_segments() -> None:
    assert split_segments(60) == [(0, 30), (30, 60)]
    assert split_segments(40) == [(0, 40)]
    assert split_segments(50) == [(0, 30), (30, 50)]
    assert split_segments(44) == [(0, 44)]
