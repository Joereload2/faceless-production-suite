import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { config as loadDotenv } from "dotenv";
import {
  CANCEL_RUNNING_SQL,
  HEARTBEAT_SQL,
  MODULE_TIMEOUT_SEC,
  leaseUntilIso,
  utcIso,
  type Module,
} from "@faceless/schema";
import { loadConfig, type Config } from "./config.js";
import { openStudioDb } from "./db.js";
import { claimOldest, completeJob, failJob } from "./jobs/claim.js";
import { log } from "./log.js";

export function parseDummyModules(raw: string | undefined): Module[] {
  const parts = (raw ?? "").split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  const allowed = new Set(Object.keys(MODULE_TIMEOUT_SEC));
  for (const p of parts) {
    if (!allowed.has(p)) {
      console.error(JSON.stringify({ level: "error", event: "config_invalid", extra: p }));
      process.exit(1);
    }
  }
  return parts as Module[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function finishDummyJob(
  db: DatabaseSync,
  config: Config,
  job: Record<string, unknown>,
  owner = "dummy-ts",
): void {
  const id = String(job.id);
  const projectId = String(job.project_id ?? job.projectId);
  const module = String(job.module);
  const rel = `${module}/${id}/dummy.txt`;
  const dir = join(config.DATA_DIR, "projects", projectId, module, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "dummy.txt"), "ok\n");
  const output = JSON.stringify({
    files: [{ kind: "text", path: rel, mime: "text/plain", bytes: 3 }],
    meta: { dummy: true },
  });
  completeJob(db, id, projectId, owner, output, 3, utcIso());
}

export async function dummyOnce(
  db: DatabaseSync,
  config: Config,
  modules: Module[],
  owner = "dummy-ts",
): Promise<Record<string, unknown> | null> {
  const job = claimOldest(db, modules, owner, Date.now());
  if (!job) return null;
  const id = String(job.id);
  try {
    const hb = db.prepare(HEARTBEAT_SQL).get({
      id,
      owner,
      now: utcIso(),
      lease_until: leaseUntilIso(Date.now()),
    }) as { cancel_requested: number } | undefined;
    if (hb && Number(hb.cancel_requested) === 1) {
      db.prepare(CANCEL_RUNNING_SQL).run({ now: utcIso(), id, owner });
      return job;
    }
    await sleep(1000);
    finishDummyJob(db, config, job, owner);
  } catch {
    failJob(db, id, owner, "internal", "dummy failed", utcIso());
  }
  return job;
}

async function main(): Promise<void> {
  loadDotenv();
  const config = loadConfig();
  const here = dirname(fileURLToPath(import.meta.url));
  const db = openStudioDb(config.DATA_DIR, join(here, "../drizzle"));
  log({ level: "info", event: "dummy_start", extra: config.DUMMY_MODULES });
  for (;;) {
    const modules = parseDummyModules(process.env.DUMMY_MODULES ?? config.DUMMY_MODULES);
    if (modules.length === 0) {
      await sleep(500);
      continue;
    }
    const job = await dummyOnce(db, config, modules);
    if (!job) await sleep(500);
  }
}

if (process.argv[1] && process.argv[1].includes("dummy-worker")) {
  main().catch((e) => {
    log({ level: "error", event: "dummy_crash", extra: e instanceof Error ? e.name : "unknown" });
    process.exit(1);
  });
}
