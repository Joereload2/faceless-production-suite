import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { apiUrl, authHeaders, createProject, testApp } from "./helpers.js";

describe("E1-F1", () => {
  it("GET /jobs/:id/files/master_16x9.mp4 serves export path", async () => {
    const { app, db, dataDir } = testApp();
    const projectId = await createProject(app);
    const created = await app.request(apiUrl(`/projects/${projectId}/jobs`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        module: "tts",
        idempotencyKey: "01FILESMASTER000000000000",
        input: { text: "Hello from the night library." },
      }),
    });
    const job = (await created.json()) as { id: string };
    const exportDir = join(dataDir, "projects", projectId, "export");
    mkdirSync(exportDir, { recursive: true });
    writeFileSync(join(exportDir, "master_16x9.mp4"), "mp4");
    db.prepare("UPDATE jobs SET status = 'done', output_json = ? WHERE id = ?").run(
      JSON.stringify({
        files: [{ kind: "video", path: "export/master_16x9.mp4", mime: "video/mp4", bytes: 3 }],
        meta: {},
      }),
      job.id,
    );
    const res = await app.request(apiUrl(`/jobs/${job.id}/files/master_16x9.mp4`), {
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("mp4");
    db.close();
  });
});
