import { DatabaseSync } from "node:sqlite";
import { RECONCILE_BYTES_SQL, SWEEP_SQLS, utcIso } from "@faceless/schema";

export function sweepOnce(db: DatabaseSync, nowIso: string = utcIso()): void {
  for (const sql of SWEEP_SQLS) db.prepare(sql).run({ now: nowIso });
  db.prepare(RECONCILE_BYTES_SQL).run();
}
