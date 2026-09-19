import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import contract from "./contract.json" with { type: "json" };
import {
  CLAIM_BY_ID_SQL,
  HEARTBEAT_SQL,
  LIMITS,
  MODULE_TIMEOUT_SEC,
  SWEEP_STALE_SQL,
  SWEEP_TIMEOUT_SQL,
  deadlineAtIso,
  defaultTimeout,
  leaseUntilIso,
} from "./job";

describe("MODULE_TIMEOUT_SEC", () => {
  it("freezes v1 budgets", () => {
    expect(MODULE_TIMEOUT_SEC.tts).toBe(120);
    expect(MODULE_TIMEOUT_SEC.assemble).toBe(600);
    expect(MODULE_TIMEOUT_SEC.script).toBe(180);
    expect(MODULE_TIMEOUT_SEC.thumb).toBe(60);
  });
});

describe("LIMITS", () => {
  it("keeps lease short and independent of timeout", () => {
    expect(LIMITS.LEASE_MS).toBe(30_000);
    expect(LIMITS.HEARTBEAT_MS).toBe(10_000);
    expect(LIMITS.SWEEP_MS).toBe(12_000);
  });
});

describe("lease vs deadline", () => {
  it("lease is now+30s; deadline is now+timeout", () => {
    const start = Date.parse("2026-09-18T00:00:00.000Z");
    expect(Date.parse(leaseUntilIso(start)) - start).toBe(LIMITS.LEASE_MS);
    expect(Date.parse(deadlineAtIso(start, 120)) - start).toBe(120_000);
  });
});

describe("contract.json", () => {
  it("matches job.ts numbers", () => {
    expect(contract.limits.LEASE_MS).toBe(LIMITS.LEASE_MS);
    expect(contract.modules.tts).toBe(MODULE_TIMEOUT_SEC.tts);
    expect(contract.sql.claimById).toBe(CLAIM_BY_ID_SQL);
  });
});

describe("SQL", () => {
  it("heartbeat is claimed_by not owner", () => {
    expect(HEARTBEAT_SQL).toContain("claimed_by");
    expect(HEARTBEAT_SQL).toContain("cancel_requested");
  });
  it("sweeper splits stale vs timeout", () => {
    expect(SWEEP_STALE_SQL).toContain("lease_until <");
    expect(SWEEP_TIMEOUT_SQL).toContain("deadline_at <");
  });
});

describe("defaultTimeout", () => {
  it("matches the table", () => {
    expect(defaultTimeout("tts")).toBe(120);
  });
});

const DDL = `
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  status TEXT NOT NULL,
  claimed_by TEXT,
  updated_at TEXT,
  lease_until TEXT,
  deadline_at TEXT,
  cancel_requested INTEGER NOT NULL DEFAULT 0
);
`;

describe("CLAIM_BY_ID concurrent", () => {
  it("only one winner on a queued row", () => {
    const dir = mkdtempSync(join(tmpdir(), "faceless-claim-"));
    const path = join(dir, "t.sqlite");
    const a = new DatabaseSync(path);
    a.exec("PRAGMA journal_mode = WAL");
    a.exec("PRAGMA busy_timeout = 5000");
    a.exec(DDL);
    a.prepare(
      "INSERT INTO jobs (id, module, status) VALUES ('j1', 'tts', 'queued')",
    ).run();
    a.close();

    const db1 = new DatabaseSync(path);
    const db2 = new DatabaseSync(path);
    db1.exec("PRAGMA busy_timeout = 5000");
    db2.exec("PRAGMA busy_timeout = 5000");
    const now = "2026-09-18T00:00:00.000Z";
    const lease = "2026-09-18T00:00:30.000Z";
    const deadline = "2026-09-18T00:02:00.000Z";
    const stmt1 = db1.prepare(CLAIM_BY_ID_SQL);
    const stmt2 = db2.prepare(CLAIM_BY_ID_SQL);
    const r1 = stmt1.get("cpu-a", now, lease, deadline, "j1");
    const r2 = stmt2.get("cpu-b", now, lease, deadline, "j1");
    const wins = [r1, r2].filter(Boolean);
    expect(wins).toHaveLength(1);
    expect((wins[0] as { claimed_by: string }).claimed_by).toMatch(/^cpu-/);
    db1.close();
    db2.close();
  });
});
