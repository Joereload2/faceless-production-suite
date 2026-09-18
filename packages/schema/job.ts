/**
 * Shared Job contract for the faceless studio.
 * UI, extension, workers, and (later) cloud speak this shape only.
 *
 * Numbers live here. Docs in docs/plan/03-contratos-datos-variables.md
 * must match. If they drift, fix both in the same PR.
 */

export type Module =
  | "image"
  | "tts"
  | "stock"
  | "video"
  | "seo"
  | "captions"
  | "assemble";

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
  owner: string;
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
  claimedUntil?: string;
}

export const MODULE_TIMEOUT_SEC: Record<Module, number> = {
  image: 180,
  video: 900,
  tts: 120,
  captions: 300,
  stock: 60,
  seo: 180,
  assemble: 600,
};

export const LIMITS = {
  maxQueuedGpu: 3,
  maxProjectBytes: 20 * 1024 * 1024 * 1024,
  softProjectBytes: 5 * 1024 * 1024 * 1024,
  maxImageVariants: 4,
  POLL_MS: 1500,
  STOCK_CACHE_TTL_SEC: 24 * 60 * 60,
  HEARTBEAT_MS: 10_000,
  CLAIM_GRACE_MS: 15_000,
  LUFS_TARGET: -14,
  SEGMENT_SEC_MIN: 15,
  SEGMENT_SEC_MAX: 30,
} as const;

export const CLAIM_SQL =
  "UPDATE jobs SET status = 'running', owner = ?, updated_at = ?, claimed_until = ? WHERE id = ? AND status = 'queued'";

export const HEARTBEAT_SQL =
  "UPDATE jobs SET updated_at = ?, claimed_until = ? WHERE id = ? AND status = 'running' AND owner = ?";

export const RECONCILE_SQL =
  "UPDATE jobs SET status = 'error', error_code = 'stale', error = 'heartbeat expired', updated_at = ? WHERE status = 'running' AND claimed_until < ?";

export function defaultTimeout(module: Module): number {
  return MODULE_TIMEOUT_SEC[module];
}

export function claimedUntilIso(nowMs: number, timeoutSec: number): string {
  return new Date(nowMs + timeoutSec * 1000 + LIMITS.CLAIM_GRACE_MS).toISOString();
}
