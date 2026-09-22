import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { apiUrl, authHeaders, createProject, testApp } from "./helpers.js";

describe("E10 publish", () => {
  it("E10-U1 GET canOpenStudio false without approvals", async () => {
    const { app, db } = testApp();
    const projectId = await createProject(app);
    const res = await app.request(apiUrl(`/projects/${projectId}/publish-checklist`), {
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { canOpenStudio: boolean; checklist: { masterApproved: boolean } };
    expect(body.canOpenStudio).toBe(false);
    expect(body.checklist.masterApproved).toBe(false);
    db.close();
  });

  it("E10-I1 triples plus files on disk set canOpenStudio true", async () => {
    const { app, db, dataDir } = testApp();
    const projectId = await createProject(app);
    const exportDir = join(dataDir, "projects", projectId, "export");
    mkdirSync(exportDir, { recursive: true });
    writeFileSync(join(exportDir, "master_16x9.mp4"), "master-bytes");
    writeFileSync(join(exportDir, "thumb.png"), "thumb-bytes");
    const masterHash = createHash("sha256").update("master-bytes").digest("hex");
    const thumbHash = createHash("sha256").update("thumb-bytes").digest("hex");
    const scriptHash = createHash("sha256").update("script").digest("hex");
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE projects SET
         approved_script_job_id = ?, approved_script_hash = ?, approved_script_at = ?,
         approved_master_job_id = ?, approved_master_hash = ?, approved_master_at = ?,
         approved_thumb_job_id = ?, approved_thumb_hash = ?, approved_thumb_at = ?
       WHERE id = ?`,
    ).run(
      "01SCRIPTAPPROVED00000000",
      scriptHash,
      now,
      "01MASTERAPPROVED00000000",
      masterHash,
      now,
      "01THUMBAPPROVED000000000",
      thumbHash,
      now,
      projectId,
    );
    const res = await app.request(apiUrl(`/projects/${projectId}/publish-checklist`), {
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { canOpenStudio: boolean };
    expect(body.canOpenStudio).toBe(true);
    db.close();
  });

  it("E10-U2 no googleapis in package.json files", () => {
    const root = join(import.meta.dirname, "../../..");
    for (const rel of ["package.json", "apps/api/package.json", "apps/web/package.json"]) {
      const txt = readFileSync(join(root, rel), "utf8");
      expect(txt).not.toContain("googleapis");
      expect(txt).not.toContain("youtube.videos.insert");
    }
  });
});
