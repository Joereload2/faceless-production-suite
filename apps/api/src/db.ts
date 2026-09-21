import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { GPU_ONE_RUNNING_SQL, SQLITE_PRAGMAS } from "@faceless/schema";

export function openStudioDb(dataDir: string, drizzleDir: string): DatabaseSync {
  mkdirSync(dataDir, { recursive: true });
  const sqlite = new DatabaseSync(join(dataDir, "studio.sqlite"));
  for (const p of SQLITE_PRAGMAS) sqlite.exec(p);
  sqlite.exec("CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT)");
  const applied = new Set(
    (sqlite.prepare("SELECT id FROM _migrations").all() as Array<{ id: string }>).map((r) => r.id),
  );
  const files = readdirSync(drizzleDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    if (applied.has(f)) continue;
    sqlite.exec(readFileSync(join(drizzleDir, f), "utf8"));
    sqlite
      .prepare("INSERT INTO _migrations (id, applied_at) VALUES (?, ?)")
      .run(f, new Date().toISOString());
  }
  sqlite.exec(GPU_ONE_RUNNING_SQL);
  return sqlite;
}
