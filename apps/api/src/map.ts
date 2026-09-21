import type { ErrorCode, Job } from "@faceless/schema";

export type ApprovalTriple = { jobId: string; hash: string; at: string } | null;

export type ProjectDto = {
  id: string;
  title: string;
  channel: string;
  createdAt: string;
  updatedAt: string;
  bytesUsed: number;
  approvals: {
    script: ApprovalTriple;
    master: ApprovalTriple;
    thumb: ApprovalTriple;
  };
};

type ProjectRow = {
  id: string;
  title: string;
  channel: string;
  created_at: string;
  updated_at: string;
  bytes_used: number;
  approved_script_job_id: string | null;
  approved_script_hash: string | null;
  approved_script_at: string | null;
  approved_master_job_id: string | null;
  approved_master_hash: string | null;
  approved_master_at: string | null;
  approved_thumb_job_id: string | null;
  approved_thumb_hash: string | null;
  approved_thumb_at: string | null;
};

function triple(jobId: string | null, hash: string | null, at: string | null): ApprovalTriple {
  if (!jobId || !hash || !at) return null;
  return { jobId, hash, at };
}

export function mapProject(row: ProjectRow): ProjectDto {
  return {
    id: row.id,
    title: row.title,
    channel: row.channel,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    bytesUsed: row.bytes_used,
    approvals: {
      script: triple(row.approved_script_job_id, row.approved_script_hash, row.approved_script_at),
      master: triple(row.approved_master_job_id, row.approved_master_hash, row.approved_master_at),
      thumb: triple(row.approved_thumb_job_id, row.approved_thumb_hash, row.approved_thumb_at),
    },
  };
}

export type JobRow = {
  id: string;
  project_id: string;
  module: string;
  engine: string;
  status: string;
  progress: number;
  timeout_sec: number;
  idempotency_key: string;
  created_by: string;
  claimed_by: string | null;
  input_hash: string;
  cancel_requested: number;
  input_json: string;
  output_json: string | null;
  error: string | null;
  error_code: string | null;
  bytes_out: number | null;
  cost_usd: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  gpu_sec: number | null;
  stock_calls: number | null;
  created_at: string;
  updated_at: string;
  lease_until: string | null;
  deadline_at: string | null;
};

export function mapJob(row: JobRow): Job {
  const job: Job = {
    id: row.id,
    projectId: row.project_id,
    module: row.module as Job["module"],
    engine: row.engine as Job["engine"],
    status: row.status as Job["status"],
    progress: row.progress,
    timeoutSec: row.timeout_sec,
    idempotencyKey: row.idempotency_key,
    createdBy: row.created_by,
    inputHash: row.input_hash,
    cancelRequested: row.cancel_requested === 1,
    input: JSON.parse(row.input_json) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.claimed_by) job.claimedBy = row.claimed_by;
  if (row.output_json) {
    const parsed = JSON.parse(row.output_json) as Job["output"];
    job.output = parsed;
  }
  if (row.error) job.error = row.error;
  if (row.error_code) job.errorCode = row.error_code as ErrorCode;
  if (row.bytes_out !== null) job.bytesOut = row.bytes_out;
  if (
    row.cost_usd !== null ||
    row.tokens_in !== null ||
    row.tokens_out !== null ||
    row.gpu_sec !== null ||
    row.stock_calls !== null
  ) {
    job.cost = {
      costUsd: row.cost_usd ?? undefined,
      tokensIn: row.tokens_in ?? undefined,
      tokensOut: row.tokens_out ?? undefined,
      gpuSec: row.gpu_sec ?? undefined,
      stockCalls: row.stock_calls ?? undefined,
    };
  }
  if (row.lease_until) job.leaseUntil = row.lease_until;
  if (row.deadline_at) job.deadlineAt = row.deadline_at;
  return job;
}
