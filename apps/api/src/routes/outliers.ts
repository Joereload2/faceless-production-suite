import { DatabaseSync } from "node:sqlite";
import { Hono } from "hono";
import { ulid } from "ulid";
import { z } from "zod";
import { utcIso } from "@faceless/schema";
import type { Config } from "../config.js";
import { HttpError } from "../http.js";

type Env = { Variables: { config: Config; db: DatabaseSync } };

const RowZ = z
  .object({
    videoId: z.string().min(6).max(20).regex(/^[A-Za-z0-9_-]+$/),
    title: z.string().min(1).max(200),
    views: z.number().int().min(0).optional(),
    vph: z.number().optional(),
    subscribers: z.number().int().min(0).nullable().optional(),
  })
  .strict();

const BodyZ = z.object({ rows: z.array(RowZ).min(1).max(200) }).strict();

export const outlierRoutes = new Hono<Env>();

function ratioOf(views: number | undefined, subscribers: number | null | undefined): number | null {
  if (subscribers == null || subscribers <= 0 || views == null) return null;
  return views / subscribers;
}

outlierRoutes.post("/projects/:id/outliers", async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("id");
  const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(projectId);
  if (!project) throw new HttpError(404, "validation", "not found");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new HttpError(400, "validation", "invalid json");
  }
  const parsed = BodyZ.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "validation", parsed.error.issues[0]?.message ?? "validation");
  const now = utcIso();
  let upserted = 0;
  for (const row of parsed.data.rows) {
    const ratio = ratioOf(row.views, row.subscribers ?? null);
    const existing = db
      .prepare("SELECT id FROM outliers WHERE project_id = ? AND video_id = ?")
      .get(projectId, row.videoId) as { id: string } | undefined;
    const id = existing?.id ?? ulid();
    db.prepare(
      `INSERT INTO outliers (id, project_id, video_id, title, views, vph, subscribers, ratio, captured_at, raw_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id, video_id) DO UPDATE SET
         title = excluded.title,
         views = excluded.views,
         vph = excluded.vph,
         subscribers = excluded.subscribers,
         ratio = excluded.ratio,
         captured_at = excluded.captured_at,
         raw_json = excluded.raw_json`,
    ).run(
      id,
      projectId,
      row.videoId,
      row.title,
      row.views ?? null,
      row.vph ?? null,
      row.subscribers ?? null,
      ratio,
      now,
      JSON.stringify(row),
    );
    upserted += 1;
  }
  return c.json({ upserted });
});

outlierRoutes.get("/projects/:id/outliers", (c) => {
  const db = c.get("db");
  const projectId = c.req.param("id");
  const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(projectId);
  if (!project) throw new HttpError(404, "validation", "not found");
  const rows = db
    .prepare(
      "SELECT id, video_id, title, views, vph, subscribers, ratio, captured_at FROM outliers WHERE project_id = ? ORDER BY captured_at DESC",
    )
    .all(projectId) as Array<{
    id: string;
    video_id: string;
    title: string;
    views: number | null;
    vph: number | null;
    subscribers: number | null;
    ratio: number | null;
    captured_at: string;
  }>;
  return c.json({
    rows: rows.map((r) => ({
      id: r.id,
      videoId: r.video_id,
      title: r.title,
      views: r.views,
      vph: r.vph,
      subscribers: r.subscribers,
      ratio: r.ratio,
      capturedAt: r.captured_at,
    })),
  });
});
