/**
 * Contract tests for the Job schema.
 * Runner: Vitest (wired in E1). Until then this file is the spec QA executes.
 */
import { describe, expect, it } from "vitest";
import {
  CLAIM_SQL,
  HEARTBEAT_SQL,
  LIMITS,
  MODULE_TIMEOUT_SEC,
  RECONCILE_SQL,
  claimedUntilIso,
  defaultTimeout,
} from "./job";

describe("MODULE_TIMEOUT_SEC", () => {
  it("freezes v1 budgets", () => {
    expect(MODULE_TIMEOUT_SEC.image).toBe(180);
    expect(MODULE_TIMEOUT_SEC.video).toBe(900);
    expect(MODULE_TIMEOUT_SEC.tts).toBe(120);
    expect(MODULE_TIMEOUT_SEC.captions).toBe(300);
    expect(MODULE_TIMEOUT_SEC.stock).toBe(60);
    expect(MODULE_TIMEOUT_SEC.seo).toBe(180);
    expect(MODULE_TIMEOUT_SEC.assemble).toBe(600);
  });
});

describe("LIMITS", () => {
  it("freezes v1 caps", () => {
    expect(LIMITS.maxQueuedGpu).toBe(3);
    expect(LIMITS.maxImageVariants).toBe(4);
    expect(LIMITS.POLL_MS).toBe(1500);
    expect(LIMITS.LUFS_TARGET).toBe(-14);
    expect(LIMITS.SEGMENT_SEC_MIN).toBe(15);
    expect(LIMITS.SEGMENT_SEC_MAX).toBe(30);
    expect(LIMITS.maxProjectBytes).toBe(20 * 1024 * 1024 * 1024);
    expect(LIMITS.softProjectBytes).toBe(5 * 1024 * 1024 * 1024);
  });
});

describe("SQL helpers", () => {
  it("claim is compare-and-set on queued", () => {
    expect(CLAIM_SQL).toContain("status = 'queued'");
    expect(CLAIM_SQL).toContain("claimed_until");
    expect(CLAIM_SQL.toLowerCase()).toContain("where id");
  });

  it("heartbeat stays on running+owner", () => {
    expect(HEARTBEAT_SQL).toContain("status = 'running'");
    expect(HEARTBEAT_SQL).toContain("owner = ?");
  });

  it("reconcile marks stale runnings", () => {
    expect(RECONCILE_SQL).toContain("error_code = 'stale'");
    expect(RECONCILE_SQL).toContain("claimed_until <");
  });
});

describe("defaultTimeout", () => {
  it("matches the table", () => {
    expect(defaultTimeout("tts")).toBe(120);
  });
});

describe("claimedUntilIso", () => {
  it("adds timeout plus grace", () => {
    const start = Date.parse("2026-09-18T00:00:00.000Z");
    const iso = claimedUntilIso(start, 120);
    expect(Date.parse(iso) - start).toBe(120_000 + LIMITS.CLAIM_GRACE_MS);
  });
});
