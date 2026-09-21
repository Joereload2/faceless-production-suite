import { existsSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { Hono } from "hono";
import type { Config } from "../config.js";
import { HttpError } from "../http.js";
import { type JobRow, mapJob } from "../map.js";
import { confinedFile } from "../paths.js";

type Env = { Variables: { config: Config; db: DatabaseSync } };

const NAME_RE = /^[A-Za-z0-9._-]+$/;

export const fileRoutes = new Hono<Env>();

fileRoutes.get("/jobs/:id/files/:name", (c) => {
  const name = c.req.param("name");
  if (!NAME_RE.test(name)) throw new HttpError(400, "validation", "traversal");
  const db = c.get("db");
  const row = db.prepare("SELECT * FROM jobs WHERE id = ?").get(c.req.param("id")) as JobRow | undefined;
  if (!row) throw new HttpError(404, "validation", "not found");
  const job = mapJob(row);
  if (job.status !== "done" || !job.output?.files) {
    throw new HttpError(404, "validation", "not found");
  }
  const file = job.output.files.find((f) => f.path.split(/[/\\]/).pop() === name);
  if (!file) throw new HttpError(404, "validation", "not found");
  let abs: string;
  try {
    abs = confinedFile(c.get("config").DATA_DIR, job.projectId, file.path);
  } catch {
    throw new HttpError(400, "validation", "traversal");
  }
  if (!existsSync(abs)) throw new HttpError(404, "validation", "not found");
  const buf = readFileSync(abs);
  return c.body(buf, 200, { "Content-Type": file.mime || "application/octet-stream" });
});
