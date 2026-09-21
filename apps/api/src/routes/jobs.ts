import { DatabaseSync } from "node:sqlite";
import { Hono } from "hono";
import {
  CANCEL_QUEUED_SQL,
  REQUEST_CANCEL_SQL,
  utcIso,
} from "@faceless/schema";
import type { Config } from "../config.js";
import { HttpError, errJson } from "../http.js";
import { createJob, parseCreateJob } from "../jobs/create.js";
import { mapJob, type JobRow } from "../map.js";

type Env = { Variables: { config: Config; db: DatabaseSync; repoRoot: string } };

export const jobRoutes = new Hono<Env>();

function getJobRow(db: DatabaseSync, id: string): JobRow {
  const row = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow | undefined;
  if (!row) throw new HttpError(404, "validation", "not found");
  return row;
}

jobRoutes.get("/projects/:id/jobs", (c) => {
  const db = c.get("db");
  const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(c.req.param("id"));
  if (!project) throw new HttpError(404, "validation", "not found");
  const raw = Number(c.req.query("limit") ?? 50);
  const limit = Number.isFinite(raw) ? Math.min(100, Math.max(1, raw)) : 50;
  const rows = db
    .prepare("SELECT * FROM jobs WHERE project_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(c.req.param("id"), limit) as JobRow[];
  return c.json({ jobs: rows.map(mapJob) });
});

jobRoutes.post("/projects/:id/jobs", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(errJson("validation", "invalid json"), 400);
  }
  const parsed = parseCreateJob(body);
  const origin = c.req.header("origin") ?? "";
  const createdBy = origin.startsWith("chrome-extension://") ? "extension" : "api";
  const { job, created } = createJob(
    c.get("db"),
    c.req.param("id"),
    parsed,
    createdBy,
    c.get("config").CLOUD_JOBS,
  );
  return c.json(job, created ? 201 : 200);
});

jobRoutes.get("/jobs/:id", (c) => {
  return c.json(mapJob(getJobRow(c.get("db"), c.req.param("id"))));
});

jobRoutes.post("/jobs/:id/cancel", (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const row = getJobRow(db, id);
  const now = utcIso();
  if (row.status === "queued") {
    db.prepare(CANCEL_QUEUED_SQL).get({ id, now });
  } else if (row.status === "running") {
    db.prepare(REQUEST_CANCEL_SQL).get({ id, now });
  } else {
    throw new HttpError(409, "validation", "not cancelable");
  }
  return c.json(mapJob(getJobRow(db, id)));
});
