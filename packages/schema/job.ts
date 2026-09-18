/**
 * Shared Job contract for the faceless studio.
 * UI, extension, workers, and (later) n8n speak this shape only.
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

export interface JobFile {
  kind: string;
  path: string;
  mime: string;
  bytes?: number;
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
  owner?: string;
  input: Record<string, unknown>;
  output?: {
    files: JobFile[];
    meta: Record<string, unknown>;
  };
  error?: string;
  bytesOut?: number;
  createdAt: string;
  updatedAt: string;
}

/** Default budgets. Orchestrator and worker must share these. */
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
  maxImageVariants: 4,
} as const;

export const CLAIM_SQL =
  "UPDATE jobs SET status = 'running', owner = ?, updated_at = ? WHERE id = ? AND status = 'queued'";

export function defaultTimeout(module: Module): number {
  return MODULE_TIMEOUT_SEC[module];
}
