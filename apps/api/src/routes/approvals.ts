import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Hono } from "hono";
import { z } from "zod";
import { utcIso } from "@faceless/schema";
import type { Config } from "../config.js";
import { HttpError } from "../http.js";
import { mapProject, type JobRow, type ProjectDto } from "../map.js";

type Env = { Variables: { config: Config; db: DatabaseSync } };

const ChecklistZ = z
  .object({
    originalAnalysis: z.literal(true),
    variesStructure: z.literal(true),
    notTemplate: z.literal(true),
  })
  .strict();

const ScriptApprovalZ = z
  .object({
    jobId: z.string().min(8).max(32),
    checklist: ChecklistZ,
  })
  .strict();

export const approvalRoutes = new Hono<Env>();

function loadProject(db: DatabaseSync, id: string) {
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!row) throw new HttpError(404, "validation", "not found");
  return row as Parameters<typeof mapProject>[0];
}

approvalRoutes.get("/projects/:id/approvals", (c) => {
  const p = mapProject(loadProject(c.get("db"), c.req.param("id")));
  const raw = c.get("db").prepare("SELECT originality_checklist_json FROM projects WHERE id = ?").get(
    c.req.param("id"),
  ) as { originality_checklist_json: string | null };
  let originalityChecklist: ProjectDto["approvals"] | null | Record<string, boolean> = null;
  if (raw.originality_checklist_json) {
    originalityChecklist = JSON.parse(raw.originality_checklist_json) as Record<string, boolean>;
  }
  return c.json({
    script: p.approvals.script,
    master: p.approvals.master,
    thumb: p.approvals.thumb,
    originalityChecklist,
  });
});

approvalRoutes.post("/projects/:id/approvals/script", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new HttpError(400, "validation", "invalid json");
  }
  const parsed = ScriptApprovalZ.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "validation", "checklist incomplete");
  const db = c.get("db");
  const projectId = c.req.param("id");
  loadProject(db, projectId);
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(parsed.data.jobId) as JobRow | undefined;
  if (!job || job.project_id !== projectId || job.module !== "script" || job.status !== "done") {
    throw new HttpError(400, "validation", "script job not approvable");
  }
  const file = join(c.get("config").DATA_DIR, "projects", projectId, "script", job.id, "script.json");
  if (!existsSync(file)) throw new HttpError(400, "validation", "script.json missing");
  const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
  const now = utcIso();
  db.prepare(
    `UPDATE projects SET
        approved_script_job_id = ?, approved_script_hash = ?, approved_script_at = ?,
        originality_checklist_json = ?, updated_at = ?
      WHERE id = ?`,
  ).run(job.id, hash, now, JSON.stringify(parsed.data.checklist), now, projectId);
  const p = mapProject(loadProject(db, projectId));
  return c.json({
    ok: true,
    approvals: {
      script: p.approvals.script,
      master: p.approvals.master,
      thumb: p.approvals.thumb,
    },
  });
});
