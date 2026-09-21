import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { apiUrl, authHeaders, createProject, testApp } from "./helpers.js";

describe("E7 export", () => {
  it("E7-U1 spec width 1280 is 400", async () => {
    const { app, db } = testApp();
    const projectId = await createProject(app);
    const res = await app.request(apiUrl(`/projects/${projectId}/jobs`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        module: "assemble",
        idempotencyKey: "01ASSEMBLEWIDTH000000000",
        input: {
          spec: {
            width: 1280,
            height: 1080,
            fps: 30,
            audioJobId: "01AUDIOJOB00000000000000",
            clips: [
              {
                fileJobId: "01CLIPJOB00000000000000",
                fileName: "v0.png",
                fileKind: "image",
                timelineStartSec: 0,
                timelineEndSec: 5,
              },
            ],
          },
        },
      }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ errorCode: "validation" });
    db.close();
  });

  it("E7-F1 GET export master 200 and evil.txt 400", async () => {
    const { app, db, dataDir } = testApp();
    const projectId = await createProject(app);
    const dir = join(dataDir, "projects", projectId, "export");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "master_16x9.mp4"), "mp4");
    const ok = await app.request(apiUrl(`/projects/${projectId}/export/master_16x9.mp4`), {
      headers: authHeaders(),
    });
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("mp4");
    const evil = await app.request(apiUrl(`/projects/${projectId}/export/evil.txt`), {
      headers: authHeaders(),
    });
    expect(evil.status).toBe(400);

    const created = await app.request(apiUrl(`/projects/${projectId}/jobs`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        module: "assemble",
        idempotencyKey: "01ASSEMBLEAPPROVE00000000",
        input: {
          spec: {
            width: 1920,
            height: 1080,
            fps: 30,
            audioJobId: "01AUDIOJOB00000000000000",
            clips: [
              {
                fileJobId: "01CLIPJOB00000000000000",
                fileName: "v0.png",
                fileKind: "image",
                timelineStartSec: 0,
                timelineEndSec: 5,
              },
            ],
          },
        },
      }),
    });
    const job = (await created.json()) as { id: string };
    db.prepare("UPDATE jobs SET status = 'done' WHERE id = ?").run(job.id);
    const appr = await app.request(apiUrl(`/projects/${projectId}/approvals/master`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ jobId: job.id }),
    });
    expect(appr.status).toBe(200);
    const body = (await appr.json()) as { approvals: { master: { hash: string } } };
    expect(body.approvals.master.hash).toHaveLength(64);
    db.close();
  });
});
