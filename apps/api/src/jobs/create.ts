import { DatabaseSync } from "node:sqlite";
import { ulid } from "ulid";
import { GPU_MODULES, LIMITS, defaultTimeout, utcIso, type Module } from "@faceless/schema";
import { inputHash } from "@faceless/schema/hash";
import { CreateJobBodyZ, type CreateJobBody } from "@faceless/schema/inputs";
import { HttpError } from "../http.js";
import { mapJob, type JobRow } from "../map.js";

const JOB_SELECT = "SELECT * FROM jobs WHERE id = ?";

export function parseCreateJob(body: unknown): CreateJobBody {
  const parsed = CreateJobBodyZ.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path?.length ? `${String(first.path[0])}: ` : "";
    throw new HttpError(400, "validation", `${path}${first?.message ?? "validation"}`);
  }
  return parsed.data;
}

export function createJob(
  db: DatabaseSync,
  projectId: string,
  body: CreateJobBody,
  createdBy: string,
  cloudJobs: string,
): { job: ReturnType<typeof mapJob>; created: boolean } {
  if (body.engine === "cloud" && cloudJobs !== "1") {
    throw new HttpError(403, "config", "cloud jobs disabled");
  }
  if (body.module === "stock") {
    const source = body.input.source ?? "pexels";
    if (source !== "pexels") {
      throw new HttpError(400, "validation", "source not in v1");
    }
  }

  const now = utcIso();
  const hash = inputHash(body.input);
  const timeoutSec = defaultTimeout(body.module as Module);

  db.exec("BEGIN IMMEDIATE");
  try {
    const project = db.prepare("SELECT id, bytes_used FROM projects WHERE id = ?").get(projectId) as
      | { id: string; bytes_used: number }
      | undefined;
    if (!project) throw new HttpError(404, "validation", "not found");
    if (project.bytes_used >= LIMITS.maxProjectBytes) {
      throw new HttpError(400, "budget", "project disk cap");
    }
    if ((GPU_MODULES as readonly string[]).includes(body.module)) {
      const n = db
        .prepare(
          "SELECT count(*) AS n FROM jobs WHERE status IN ('queued','running') AND module IN ('image','video')",
        )
        .get() as { n: number };
      if (n.n >= LIMITS.maxQueuedGpu) {
        throw new HttpError(429, "budget", "gpu queue full");
      }
    }
    const existing = db
      .prepare("SELECT * FROM jobs WHERE project_id = ? AND idempotency_key = ?")
      .get(projectId, body.idempotencyKey) as JobRow | undefined;
    if (existing) {
      if (existing.input_hash !== hash) {
        throw new HttpError(409, "idempotency_conflict", "idempotency_conflict");
      }
      db.exec("COMMIT");
      return { job: mapJob(existing), created: false };
    }
    const id = ulid();
    db.prepare(
      `INSERT INTO jobs (id, project_id, module, engine, status, progress, timeout_sec,
                         idempotency_key, created_by, input_hash, input_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'queued', 0, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      projectId,
      body.module,
      body.engine,
      timeoutSec,
      body.idempotencyKey,
      createdBy,
      hash,
      JSON.stringify(body.input),
      now,
      now,
    );
    if (body.module === "assemble") {
      db.prepare(
        `UPDATE projects SET approved_master_job_id = NULL, approved_master_hash = NULL,
                approved_master_at = NULL, updated_at = ? WHERE id = ?`,
      ).run(now, projectId);
    }
    const row = db.prepare(JOB_SELECT).get(id) as JobRow;
    db.exec("COMMIT");
    return { job: mapJob(row), created: true };
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  }
}


