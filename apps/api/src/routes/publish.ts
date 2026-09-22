import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Hono } from "hono";
import { z } from "zod";
import { utcIso } from "@faceless/schema";
import type { Config } from "../config.js";
import { HttpError } from "../http.js";
import { mapProject, type ProjectDto } from "../map.js";

type Env = { Variables: { config: Config; db: DatabaseSync } };

const HumanZ = z
  .object({
    syntheticMediaMarked: z.boolean(),
    stockAttributionSaved: z.boolean(),
    piperVoiceLicenseOk: z.boolean(),
    notMadeForKids: z.boolean(),
    titleMatchesCard: z.boolean(),
  })
  .strict();

export type PublishChecklist = {
  originalityOnFile: boolean;
  masterApproved: boolean;
  thumbApproved: boolean;
  hashesMatchDisk: boolean;
  syntheticMediaMarked: boolean;
  stockAttributionSaved: boolean;
  piperVoiceLicenseOk: boolean;
  notMadeForKids: boolean;
  titleMatchesCard: boolean;
};

const HUMAN_DEFAULT = {
  syntheticMediaMarked: false,
  stockAttributionSaved: false,
  piperVoiceLicenseOk: false,
  notMadeForKids: false,
  titleMatchesCard: false,
};

function sha256File(path: string): string | null {
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function loadProjectRow(db: DatabaseSync, id: string) {
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as
    | (Parameters<typeof mapProject>[0] & { publish_checklist_json: string | null })
    | undefined;
  if (!row) throw new HttpError(404, "validation", "not found");
  return row;
}

function humanFromJson(raw: string | null): typeof HUMAN_DEFAULT {
  if (!raw) return { ...HUMAN_DEFAULT };
  try {
    const parsed = JSON.parse(raw) as Partial<typeof HUMAN_DEFAULT>;
    return {
      syntheticMediaMarked: Boolean(parsed.syntheticMediaMarked),
      stockAttributionSaved: Boolean(parsed.stockAttributionSaved),
      piperVoiceLicenseOk: Boolean(parsed.piperVoiceLicenseOk),
      notMadeForKids: Boolean(parsed.notMadeForKids),
      titleMatchesCard: Boolean(parsed.titleMatchesCard),
    };
  } catch {
    return { ...HUMAN_DEFAULT };
  }
}

export function computeChecklist(db: DatabaseSync, dataDir: string, projectId: string): PublishChecklist {
  const row = loadProjectRow(db, projectId);
  const p: ProjectDto = mapProject(row);
  const originalityOnFile = p.approvals.script !== null;
  const masterApproved = p.approvals.master !== null;
  const thumbApproved = p.approvals.thumb !== null;
  const masterPath = join(dataDir, "projects", projectId, "export", "master_16x9.mp4");
  const thumbPath = join(dataDir, "projects", projectId, "export", "thumb.png");
  const masterHash = sha256File(masterPath);
  const thumbHash = sha256File(thumbPath);
  const hashesMatchDisk = Boolean(
    masterApproved &&
      thumbApproved &&
      masterHash &&
      thumbHash &&
      masterHash === p.approvals.master?.hash &&
      thumbHash === p.approvals.thumb?.hash,
  );
  return {
    originalityOnFile,
    masterApproved,
    thumbApproved,
    hashesMatchDisk,
    ...humanFromJson(row.publish_checklist_json),
  };
}

export function canOpenStudio(c: PublishChecklist): boolean {
  return c.originalityOnFile && c.masterApproved && c.thumbApproved && c.hashesMatchDisk;
}

export const publishRoutes = new Hono<Env>();

publishRoutes.get("/projects/:id/publish-checklist", (c) => {
  const checklist = computeChecklist(c.get("db"), c.get("config").DATA_DIR, c.req.param("id"));
  return c.json({ checklist, canOpenStudio: canOpenStudio(checklist) });
});

publishRoutes.post("/projects/:id/publish-checklist", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new HttpError(400, "validation", "invalid json");
  }
  const parsed = HumanZ.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "validation", "checklist invalid");
  const db = c.get("db");
  const projectId = c.req.param("id");
  loadProjectRow(db, projectId);
  db.prepare("UPDATE projects SET publish_checklist_json = ?, updated_at = ? WHERE id = ?").run(
    JSON.stringify(parsed.data),
    utcIso(),
    projectId,
  );
  const checklist = computeChecklist(db, c.get("config").DATA_DIR, projectId);
  return c.json({ checklist, canOpenStudio: canOpenStudio(checklist) });
});
