/**
 * Shared Job contract. Numbers live HERE only.
 * Generate contract.json via `pnpm --filter @faceless/schema build:contract`.
 */

export type Module =
  | "image"
  | "tts"
  | "stock"
  | "video"
  | "seo"
  | "captions"
  | "assemble"
  | "script"
  | "thumb";

export type JobStatus =
  | "queued"
  | "running"
  | "done"
  | "error"
  | "canceled";

export type Engine = "local" | "cloud";

export type ErrorCode =
  | "timeout"
  | "stale"
  | "budget"
  | "validation"
  | "io"
  | "config"
  | "canceled"
  | "internal"
  | "idempotency_conflict"
  | "unauthorized";

export type CreatedBy = "api" | "extension" | "worker-cpu" | "worker-gpu" | string;

export interface JobFile {
  kind: string;
  path: string;
  mime: string;
  bytes?: number;
}

export interface JobCost {
  costUsd?: number;
  tokensIn?: number;
  tokensOut?: number;
  gpuSec?: number;
  stockCalls?: number;
}

export interface Job {
  id: string;
  projectId: string;
  module: Module;
  engine: Engine;
  status: JobStatus;
  progress: number;
  timeoutSec: number;
  idempotencyKey: string;
  createdBy: CreatedBy;
  claimedBy?: string;
  inputHash: string;
  cancelRequested: boolean;
  input: Record<string, unknown>;
  output?: {
    files: JobFile[];
    meta: Record<string, unknown>;
  };
  error?: string;
  errorCode?: ErrorCode;
  bytesOut?: number;
  cost?: JobCost;
  createdAt: string;
  updatedAt: string;
  leaseUntil?: string;
  deadlineAt?: string;
}

export const GPU_MODULES: readonly Module[] = ["image", "video"];

export const MODULE_TIMEOUT_SEC: Record<Module, number> = {
  image: 180,
  video: 900,
  tts: 120,
  captions: 300,
  stock: 60,
  seo: 180,
  assemble: 600,
  script: 180,
  thumb: 60,
};

export const LIMITS = {
  maxQueuedGpu: 3,
  maxProjectBytes: 20 * 1024 * 1024 * 1024,
  softProjectBytes: 5 * 1024 * 1024 * 1024,
  maxImageVariants: 4,
  POLL_MS: 1500,
  STOCK_CACHE_TTL_SEC: 24 * 60 * 60,
  HEARTBEAT_MS: 10_000,
  LEASE_MS: 30_000,
  SWEEP_MS: 12_000,
  SQLITE_BUSY_TIMEOUT_MS: 5000,
  LUFS_TARGET: -14,
  SEGMENT_SEC_MIN: 15,
  SEGMENT_SEC_MAX: 30,
  IMPRESSION_FLOOR: 1000,
  SEO_CTR_GAP: 0.02,
  SEO_ROW_LIMIT: 200,
  SEO_CLAUDE_ROWS: 40,
  SCRIPT_MAX_TOKENS: 4096,
} as const;

/**
 * ORDER MATTERS: busy_timeout must be first. Switching/opening WAL takes a lock, and with several
 * processes opening the same file at once, a connection without a busy handler fails immediately
 * with "database is locked" (reproduced with 8 concurrent workers).
 */
export const SQLITE_PRAGMAS = [
  `PRAGMA busy_timeout = ${LIMITS.SQLITE_BUSY_TIMEOUT_MS}`,
  "PRAGMA journal_mode = WAL",
  "PRAGMA foreign_keys = ON",
] as const;

/**
 * SQL contract. Every statement uses NAMED parameters (:name) so TS (node:sqlite)
 * and Python (sqlite3) bind the same way and nobody depends on positional order.
 * Timestamps are always `toISOString()` UTC (fixed width), so text comparison is safe.
 * Requires SQLite >= 3.35 (RETURNING).
 */

const sqlList = (items: readonly string[]): string =>
  items.map((s) => `'${s}'`).join(", ");
const GPU_LIST = sqlList(GPU_MODULES);

export const MODULE_CLAIM_ORDER: readonly Module[] = [
  "script",
  "tts",
  "captions",
  "assemble",
  "stock",
  "seo",
  "thumb",
  "image",
  "video",
] as const;

const CLAIM_ORDER_CASE = MODULE_CLAIM_ORDER.map(
  (m, i) => `WHEN '${m}' THEN ${i + 1}`,
).join(" ");

/** Placeholder replaced by claimPickSql(). Python workers do the same replace. */
export const CLAIM_PICK_SQL_TEMPLATE = `SELECT id, timeout_sec FROM jobs
 WHERE status = 'queued' AND cancel_requested = 0
   AND module IN (__MODULES__)
 ORDER BY CASE module ${CLAIM_ORDER_CASE} ELSE 99 END, created_at ASC, id ASC
 LIMIT 1`;

/** Worker loop step 1: oldest queued job for these modules, CPU-first. Step 2: CLAIM_BY_ID_SQL; on no row, loop. */
export function claimPickSql(modules: readonly Module[]): string {
  if (modules.length === 0) throw new Error("claimPickSql: empty module list");
  for (const m of modules) {
    if (!(m in MODULE_TIMEOUT_SEC)) throw new Error(`invalid module: ${m}`);
  }
  return CLAIM_PICK_SQL_TEMPLATE.replace("__MODULES__", sqlList(modules));
}

/**
 * Claim one job by id (CAS). Returns the row, or NO row if someone else won, the job was
 * canceled, or (GPU modules) another GPU job is already running. Never throws for those cases.
 * The GPU exclusion lives here (single statement = atomic under SQLite's write lock);
 * GPU_ONE_RUNNING_SQL stays as a backstop index.
 */
export const CLAIM_BY_ID_SQL = `UPDATE jobs
   SET status = 'running',
       claimed_by = :owner,
       updated_at = :now,
       lease_until = :lease_until,
       deadline_at = :deadline_at
 WHERE id = :id
   AND status = 'queued'
   AND cancel_requested = 0
   AND (module NOT IN (${GPU_LIST})
        OR NOT EXISTS (SELECT 1 FROM jobs
                        WHERE status = 'running' AND module IN (${GPU_LIST})))
RETURNING *`;

/** @deprecated use claimPickSql + CLAIM_BY_ID_SQL */
export const CLAIM_SQL = CLAIM_BY_ID_SQL;

/** Renews the lease only. No row back = the lease was lost (swept / reassigned): stop working. */
export const HEARTBEAT_SQL = `UPDATE jobs
   SET updated_at = :now, lease_until = :lease_until
 WHERE id = :id AND status = 'running' AND claimed_by = :owner
RETURNING cancel_requested`;

/**
 * Sweeps are disjoint, so their execution order does not matter:
 * an expired deadline is always `timeout`; `stale` only when the deadline has NOT expired.
 * A running row with NULL lease counts as stale; NULL deadline never times out.
 */
export const SWEEP_TIMEOUT_SQL = `UPDATE jobs
   SET status = 'error', error_code = 'timeout',
       error = 'deadline exceeded', updated_at = :now
 WHERE status = 'running' AND deadline_at < :now`;

export const SWEEP_STALE_SQL = `UPDATE jobs
   SET status = 'error', error_code = 'stale',
       error = 'lease expired', updated_at = :now
 WHERE status = 'running'
   AND (lease_until IS NULL OR lease_until < :now)
   AND (deadline_at IS NULL OR deadline_at >= :now)`;

/** Run BOTH on every sweep tick and at boot: each one alone leaves the other case running forever. */
export const SWEEP_SQLS = [SWEEP_TIMEOUT_SQL, SWEEP_STALE_SQL] as const;

/**
 * Terminal transitions. All are guarded by (status, claimed_by): a worker that lost its lease
 * (swept, timed out) changes 0 rows and must discard its output. Always check RETURNING.
 */
export const COMPLETE_SQL = `UPDATE jobs
   SET status = 'done', progress = 1,
       output_json = :output_json, bytes_out = :bytes_out,
       cost_usd = :cost_usd, tokens_in = :tokens_in, tokens_out = :tokens_out,
       gpu_sec = :gpu_sec, stock_calls = :stock_calls,
       error = NULL, error_code = NULL,
       claimed_by = NULL, lease_until = NULL,
       updated_at = :now
 WHERE id = :id AND status = 'running' AND claimed_by = :owner
RETURNING id`;

export const FAIL_SQL = `UPDATE jobs
   SET status = 'error', error_code = :error_code, error = :error,
       claimed_by = NULL, lease_until = NULL, updated_at = :now
 WHERE id = :id AND status = 'running' AND claimed_by = :owner
RETURNING id`;

/** Worker-owned cancel of a running job (dummy / kill path). */
export const CANCEL_RUNNING_SQL = `UPDATE jobs
   SET status = 'canceled', error_code = 'canceled', error = 'canceled',
       updated_at = :now, claimed_by = NULL, lease_until = NULL,
       cancel_requested = 1
 WHERE id = :id AND status = 'running' AND claimed_by = :owner
RETURNING id`;

/** API cancel, step 1: queued -> canceled. No row = already claimed; go to step 2. */
export const CANCEL_QUEUED_SQL = `UPDATE jobs
   SET status = 'canceled', error_code = 'canceled', updated_at = :now
 WHERE id = :id AND status = 'queued'
RETURNING id`;

/** API cancel, step 2: cooperative flag on a running job (the worker sees it in HEARTBEAT_SQL). */
export const REQUEST_CANCEL_SQL = `UPDATE jobs
   SET cancel_requested = 1, updated_at = :now
 WHERE id = :id AND status = 'running'
RETURNING id`;

/** Worker acknowledges a cancel request: running -> canceled. */
export const ACK_CANCEL_SQL = `UPDATE jobs
   SET status = 'canceled', error_code = 'canceled',
       error = 'canceled by request',
       claimed_by = NULL, lease_until = NULL, updated_at = :now
 WHERE id = :id AND status = 'running' AND claimed_by = :owner AND cancel_requested = 1
RETURNING id`;

export const ADD_BYTES_SQL = `UPDATE projects
   SET bytes_used = bytes_used + :delta, updated_at = :now
 WHERE id = :id`;

export const RECONCILE_BYTES_SQL = `UPDATE projects
   SET bytes_used = (
     SELECT COALESCE(SUM(bytes_out), 0) FROM jobs
      WHERE jobs.project_id = projects.id AND jobs.bytes_out IS NOT NULL
   )`;

/** @deprecated use SWEEP_STALE_SQL; kept as alias for boot reconcile */
export const RECONCILE_SQL = SWEEP_STALE_SQL;

/** Backstop only: the claim already refuses a 2nd GPU job. A raw write that bypasses it throws here. */
export const GPU_ONE_RUNNING_SQL = `CREATE UNIQUE INDEX IF NOT EXISTS one_gpu_running
  ON jobs(status)
  WHERE status = 'running' AND module IN (${GPU_LIST})`;

export function defaultTimeout(module: Module): number {
  return MODULE_TIMEOUT_SEC[module];
}

export function utcIso(ms: number = Date.now()): string {
  return new Date(ms).toISOString();
}

export function leaseUntilIso(nowMs: number): string {
  return new Date(nowMs + LIMITS.LEASE_MS).toISOString();
}

export function deadlineAtIso(nowMs: number, timeoutSec: number): string {
  return new Date(nowMs + timeoutSec * 1000).toISOString();
}

/** @deprecated lease is independent of timeout; use leaseUntilIso */
export function claimedUntilIso(nowMs: number, timeoutSec: number): string {
  return deadlineAtIso(nowMs, timeoutSec);
}
