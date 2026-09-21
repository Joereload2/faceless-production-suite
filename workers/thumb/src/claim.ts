import { DatabaseSync } from "node:sqlite";
import {
  claimPickSql,
  deadlineAtIso,
  leaseUntilIso,
  utcIso,
  type Module,
} from "@faceless/schema";
import contract from "@faceless/schema/contract.json" with { type: "json" };

export function claimOldest(
  db: DatabaseSync,
  modules: readonly Module[],
  owner: string,
  nowMs: number,
): Record<string, unknown> | null {
  db.exec("BEGIN IMMEDIATE");
  try {
    const pick = db.prepare(claimPickSql(modules)).get() as
      | { id: string; timeout_sec: number }
      | undefined;
    if (!pick) {
      db.exec("COMMIT");
      return null;
    }
    const now = utcIso(nowMs);
    const lease = leaseUntilIso(nowMs);
    const deadline = deadlineAtIso(nowMs, pick.timeout_sec);
    let claimed: Record<string, unknown> | undefined;
    try {
      claimed = db.prepare(contract.sql.claimById).get({
        owner,
        now,
        lease_until: lease,
        deadline_at: deadline,
        id: pick.id,
      }) as Record<string, unknown> | undefined;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("constraint")) {
        db.exec("ROLLBACK");
        return null;
      }
      throw e;
    }
    if (!claimed) {
      db.exec("COMMIT");
      return null;
    }
    db.exec("COMMIT");
    return claimed;
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  }
}

export function completeJob(
  db: DatabaseSync,
  jobId: string,
  projectId: string,
  owner: string,
  outputJson: string,
  bytesOut: number,
  nowIso: string,
): void {
  db.exec("BEGIN IMMEDIATE");
  const row = db.prepare(contract.sql.complete).get({
    output_json: outputJson,
    bytes_out: bytesOut,
    cost_usd: null,
    tokens_in: null,
    tokens_out: null,
    gpu_sec: null,
    stock_calls: null,
    now: nowIso,
    id: jobId,
    owner,
  });
  if (!row) {
    db.exec("ROLLBACK");
    throw new Error("complete missed");
  }
  db.prepare(contract.sql.addBytes).run({ delta: bytesOut, now: nowIso, id: projectId });
  db.exec("COMMIT");
}
