import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { apiUrl, authHeaders, createProject, testApp } from "./helpers.js";

describe("E7b", () => {
  it("E7b-U1 overlay longer than 32 is 400", async () => {
    const { app, db } = testApp();
    const projectId = await createProject(app);
    const res = await app.request(apiUrl(`/projects/${projectId}/jobs`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        module: "thumb",
        idempotencyKey: "01THUMBOVERLAY0000000000",
        input: {
          masterJobId: "01MASTER01JOB0000000000",
          title: "Night",
          overlayText: "this overlay is way too long for the spec",
          description: "d",
          tags: ["faceless"],
        },
      }),
    });
    expect(res.status).toBe(400);
    db.close();
  });

  it("E7b-I2 approval thumb sets hash columns", async () => {
    const { app, db, dataDir } = testApp();
    const projectId = await createProject(app);
    const created = await app.request(apiUrl(`/projects/${projectId}/jobs`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        module: "thumb",
        idempotencyKey: "01THUMBAPPROVE0000000000",
        input: {
          masterJobId: "01MASTER01JOB0000000000",
          title: "Night",
          overlayText: "WAIT",
          description: "d",
          tags: ["faceless"],
        },
      }),
    });
    const job = (await created.json()) as { id: string };
    const dir = join(dataDir, "projects", projectId, "export");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "thumb.png"), "png");
    db.prepare("UPDATE jobs SET status = 'done' WHERE id = ?").run(job.id);
    const appr = await app.request(apiUrl(`/projects/${projectId}/approvals/thumb`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ jobId: job.id }),
    });
    expect(appr.status).toBe(200);
    const body = (await appr.json()) as { approvals: { thumb: { hash: string } } };
    expect(body.approvals.thumb.hash).toHaveLength(64);
    db.close();
  });
});
