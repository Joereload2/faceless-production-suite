import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  channel: text("channel").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  bytesUsed: integer("bytes_used").notNull().default(0),
  approvedScriptJobId: text("approved_script_job_id"),
  approvedScriptHash: text("approved_script_hash"),
  approvedScriptAt: text("approved_script_at"),
  approvedMasterJobId: text("approved_master_job_id"),
  approvedMasterHash: text("approved_master_hash"),
  approvedMasterAt: text("approved_master_at"),
  approvedThumbJobId: text("approved_thumb_job_id"),
  approvedThumbHash: text("approved_thumb_hash"),
  approvedThumbAt: text("approved_thumb_at"),
  originalityChecklistJson: text("originality_checklist_json"),
  publishChecklistJson: text("publish_checklist_json"),
});

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id),
    module: text("module").notNull(),
    engine: text("engine").notNull().default("local"),
    status: text("status").notNull(),
    progress: real("progress").notNull().default(0),
    timeoutSec: integer("timeout_sec").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdBy: text("created_by").notNull(),
    claimedBy: text("claimed_by"),
    inputHash: text("input_hash").notNull(),
    cancelRequested: integer("cancel_requested").notNull().default(0),
    inputJson: text("input_json").notNull(),
    outputJson: text("output_json"),
    error: text("error"),
    errorCode: text("error_code"),
    bytesOut: integer("bytes_out"),
    costUsd: real("cost_usd"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    gpuSec: real("gpu_sec"),
    stockCalls: integer("stock_calls"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    leaseUntil: text("lease_until"),
    deadlineAt: text("deadline_at"),
  },
  (t) => ({
    jobsIdempotency: uniqueIndex("jobs_idempotency").on(t.projectId, t.idempotencyKey),
    jobsStatus: index("jobs_status").on(t.status, t.updatedAt),
    jobsCreated: index("jobs_created").on(t.status, t.module, t.createdAt),
    jobsProject: index("jobs_project").on(t.projectId, t.createdAt),
    jobsLease: index("jobs_lease").on(t.status, t.leaseUntil),
  }),
);

export const dailyUsage = sqliteTable("daily_usage", {
  day: text("day").primaryKey(),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  stockCalls: integer("stock_calls").notNull().default(0),
});

export const outliers = sqliteTable(
  "outliers",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id),
    videoId: text("video_id").notNull(),
    title: text("title").notNull(),
    views: integer("views"),
    vph: real("vph"),
    subscribers: integer("subscribers"),
    ratio: real("ratio"),
    capturedAt: text("captured_at").notNull(),
    rawJson: text("raw_json").notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("outliers_project_video").on(t.projectId, t.videoId),
  }),
);
