from hash import canonical_json, input_hash

FIXTURE = {"b": 1, "a": [2, {"z": 3, "y": 4}]}


def test_e3_h1_hash_fixture() -> None:
    assert canonical_json(FIXTURE) == '{"a":[2,{"y":4,"z":3}],"b":1}'
    assert input_hash(FIXTURE) == "d7bc8a2a1c87d959f7699542056ae658f1b5fd120b835f51e702fe095d609c72"
