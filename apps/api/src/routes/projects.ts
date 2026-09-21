import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Hono } from "hono";
import { ulid } from "ulid";
import { z } from "zod";
import type { Config } from "../config.js";
import { errJson, HttpError } from "../http.js";
import { mapProject } from "../map.js";
import { channelExists, projectDir } from "../paths.js";

const CreateProjectZ = z
  .object({
    title: z.string().min(1).max(120),
    channel: z.string().regex(/^[a-z0-9-]{1,32}$/),
  })
  .strict();

const PROJECT_SELECT = `SELECT id, title, channel, created_at, updated_at, bytes_used,
  approved_script_job_id, approved_script_hash, approved_script_at,
  approved_master_job_id, approved_master_hash, approved_master_at,
  approved_thumb_job_id, approved_thumb_hash, approved_thumb_at
 FROM projects`;

type Env = { Variables: { config: Config; db: DatabaseSync; repoRoot: string } };

export const projectRoutes = new Hono<Env>();

projectRoutes.post("/projects", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(errJson("validation", "invalid json"), 400);
  }
  const parsed = CreateProjectZ.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return c.json(errJson("validation", first ? first.message : "validation"), 400);
  }
  const repoRoot = c.get("repoRoot");
  if (!channelExists(repoRoot, parsed.data.channel)) {
    return c.json(errJson("config", "unknown channel"), 400);
  }
  const db = c.get("db");
  const config = c.get("config");
  const now = new Date().toISOString();
  const id = ulid();
  db.prepare(
    "INSERT INTO projects (id, title, channel, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, parsed.data.title, parsed.data.channel, now, now);
  const dir = projectDir(config.DATA_DIR, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "project.json"),
    JSON.stringify({ id, title: parsed.data.title, channel: parsed.data.channel }),
  );
  const row = db.prepare(`${PROJECT_SELECT} WHERE id = ?`).get(id);
  return c.json(mapProject(row as Parameters<typeof mapProject>[0]), 201);
});

projectRoutes.get("/projects", (c) => {
  const db = c.get("db");
  const rows = db.prepare(`${PROJECT_SELECT} ORDER BY created_at DESC`).all();
  return c.json({
    projects: (rows as Array<Parameters<typeof mapProject>[0]>).map(mapProject),
  });
});

projectRoutes.get("/projects/:id", (c) => {
  const db = c.get("db");
  const row = db.prepare(`${PROJECT_SELECT} WHERE id = ?`).get(c.req.param("id"));
  if (!row) throw new HttpError(404, "validation", "not found");
  return c.json(mapProject(row as Parameters<typeof mapProject>[0]));
});
