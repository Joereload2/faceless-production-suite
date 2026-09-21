from comfy import variant_seed


def test_e6_seeds_differ_per_variant() -> None:
    a = variant_seed("jobA", 0)
    b = variant_seed("jobA", 1)
    assert a != b
    assert variant_seed("jobA", 0) == a
    assert 0 <= a < 2**32
