from claim import claim_oldest


def test_e6_i2_running_image_blocks_claim(conn, contract, settings) -> None:
    now = "2026-09-19T00:00:00.000Z"
    conn.execute(
        """INSERT INTO jobs (id, project_id, module, engine, status, progress, timeout_sec,
           idempotency_key, created_by, input_hash, input_json, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        ("g1", "p1", "image", "local", "running", 0, 180, "k-g1", "api", "h", "{}", now, now),
    )
    conn.execute(
        """INSERT INTO jobs (id, project_id, module, engine, status, progress, timeout_sec,
           idempotency_key, created_by, input_hash, input_json, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            "g2",
            "p1",
            "image",
            "local",
            "queued",
            0,
            180,
            "k-g2",
            "api",
            "h",
            '{"prompt":"lamp","variants":1,"preset":"image-v1"}',
            now,
            now,
        ),
    )
    assert claim_oldest(conn, contract, ["image"], settings.WORKER_OWNER, 1_000) is None
