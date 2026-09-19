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
  | "idempotency_conflict";

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
} as const;

export const SQLITE_PRAGMAS = [
  "PRAGMA journal_mode = WAL",
  "PRAGMA busy_timeout = 5000",
  "PRAGMA foreign_keys = ON",
] as const;

export const CLAIM_BY_ID_SQL = `UPDATE jobs
   SET status = 'running',
       claimed_by = ?,
       updated_at = ?,
       lease_until = ?,
       deadline_at = ?
 WHERE id = ? AND status = 'queued'
RETURNING *`;

/** Worker loop: pick oldest queued job for the given modules (expand IN list in the caller). */
export const CLAIM_SQL = CLAIM_BY_ID_SQL;

export const HEARTBEAT_SQL = `UPDATE jobs
   SET updated_at = :now, lease_until = :lease_until
 WHERE id = :id AND status = 'running' AND claimed_by = :owner
RETURNING cancel_requested`;

export const SWEEP_STALE_SQL = `UPDATE jobs
   SET status = 'error', error_code = 'stale',
       error = 'lease expired', updated_at = :now
 WHERE status = 'running' AND lease_until < :now`;

export const SWEEP_TIMEOUT_SQL = `UPDATE jobs
   SET status = 'error', error_code = 'timeout',
       error = 'deadline exceeded', updated_at = :now
 WHERE status = 'running' AND deadline_at < :now`;

/** @deprecated use SWEEP_STALE_SQL; kept as alias for boot reconcile */
export const RECONCILE_SQL = SWEEP_STALE_SQL;

export const GPU_ONE_RUNNING_SQL = `CREATE UNIQUE INDEX IF NOT EXISTS one_gpu_running
  ON jobs(status)
  WHERE status = 'running' AND module IN ('image', 'video')`;

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
