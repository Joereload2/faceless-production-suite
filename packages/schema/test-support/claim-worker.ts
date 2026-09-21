/**
 * Child process used by job.test.ts to race real OS processes against one SQLite file.
 * argv: dbPath mode workerId startAtMs modules(csv) [jobId]
 *  - race : try to claim `jobId` once
 *  - drain: loop claimPick -> claimById until nothing is claimable (claimed jobs stay running)
 * Prints one JSON line: { worker, claimed: string[], errors: string[] }
 */
import { DatabaseSync } from "node:sqlite";
import {
  CLAIM_BY_ID_SQL,
  GPU_MODULES,
  SQLITE_PRAGMAS,
  claimPickSql,
  deadlineAtIso,
  leaseUntilIso,
  utcIso,
  type Module,
} from "../job.js";

const [dbPath, mode, worker, startAt, modulesCsv, jobId] = process.argv.slice(2);
const modules = modulesCsv.split(",") as Module[];

const db = new DatabaseSync(dbPath);
for (const p of SQLITE_PRAGMAS) db.exec(p);
const claim = db.prepare(CLAIM_BY_ID_SQL);
const next = db.prepare(claimPickSql(modules));

const claimed: string[] = [];
const errors: string[] = [];
const gpuLoop = modules.some((m) => (GPU_MODULES as readonly string[]).includes(m));

function tryClaim(id: string, timeoutSec: number): boolean {
  const now = Date.now();
  try {
    const row = claim.get({
      id,
      owner: worker,
      now: utcIso(now),
      lease_until: leaseUntilIso(now),
      deadline_at: deadlineAtIso(now, timeoutSec),
    });
    return row !== undefined;
  } catch (e) {
    errors.push(String(e));
    return false;
  }
}

while (Date.now() < Number(startAt)) {
  /* barrier: all workers start together */
}

if (mode === "race") {
  if (tryClaim(jobId, 120)) claimed.push(jobId);
} else {
  for (;;) {
    const row = next.get() as { id: string; timeout_sec: number } | undefined;
    if (!row) break;
    if (tryClaim(row.id, row.timeout_sec)) claimed.push(row.id);
    else if (gpuLoop) break; // GPU busy: stop, don't spin
  }
}

db.close();
console.log(JSON.stringify({ worker, claimed, errors }));
