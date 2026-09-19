import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLAIM_BY_ID_SQL,
  GPU_ONE_RUNNING_SQL,
  GPU_MODULES,
  HEARTBEAT_SQL,
  LIMITS,
  MODULE_TIMEOUT_SEC,
  SQLITE_PRAGMAS,
  SWEEP_STALE_SQL,
  SWEEP_TIMEOUT_SQL,
} from "./job";

const contract = {
  version: 1,
  modules: MODULE_TIMEOUT_SEC,
  gpuModules: GPU_MODULES,
  limits: LIMITS,
  errorCodes: [
    "timeout",
    "stale",
    "budget",
    "validation",
    "io",
    "config",
    "canceled",
    "internal",
    "idempotency_conflict",
  ],
  pragmas: SQLITE_PRAGMAS,
  sql: {
    claimById: CLAIM_BY_ID_SQL,
    heartbeat: HEARTBEAT_SQL,
    sweepStale: SWEEP_STALE_SQL,
    sweepTimeout: SWEEP_TIMEOUT_SQL,
    oneGpuRunning: GPU_ONE_RUNNING_SQL,
  },
};

const dir = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(dir, "contract.json"), JSON.stringify(contract, null, 2) + "\n");
console.log("wrote packages/schema/contract.json");
