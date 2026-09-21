import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACK_CANCEL_SQL,
  ADD_BYTES_SQL,
  CANCEL_QUEUED_SQL,
  CANCEL_RUNNING_SQL,
  CLAIM_BY_ID_SQL,
  CLAIM_PICK_SQL_TEMPLATE,
  COMPLETE_SQL,
  FAIL_SQL,
  GPU_MODULES,
  GPU_ONE_RUNNING_SQL,
  HEARTBEAT_SQL,
  LIMITS,
  MODULE_CLAIM_ORDER,
  MODULE_TIMEOUT_SEC,
  RECONCILE_BYTES_SQL,
  REQUEST_CANCEL_SQL,
  SQLITE_PRAGMAS,
  SWEEP_SQLS,
  SWEEP_STALE_SQL,
  SWEEP_TIMEOUT_SQL,
} from "./job.js";

const contract = {
  version: 2,
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
    "unauthorized",
  ],
  pragmas: SQLITE_PRAGMAS,
  claimOrder: MODULE_CLAIM_ORDER,
  sql: {
    claimById: CLAIM_BY_ID_SQL,
    claimPickTemplate: CLAIM_PICK_SQL_TEMPLATE,
    heartbeat: HEARTBEAT_SQL,
    complete: COMPLETE_SQL,
    fail: FAIL_SQL,
    cancelRunning: CANCEL_RUNNING_SQL,
    cancelQueued: CANCEL_QUEUED_SQL,
    requestCancel: REQUEST_CANCEL_SQL,
    ackCancel: ACK_CANCEL_SQL,
    addBytes: ADD_BYTES_SQL,
    reconcileBytes: RECONCILE_BYTES_SQL,
    sweepStale: SWEEP_STALE_SQL,
    sweepTimeout: SWEEP_TIMEOUT_SQL,
    sweepAll: SWEEP_SQLS,
    oneGpuRunning: GPU_ONE_RUNNING_SQL,
  },
};

const dir = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(dir, "contract.json"), JSON.stringify(contract, null, 2) + "\n");
console.log("wrote packages/schema/contract.json");
