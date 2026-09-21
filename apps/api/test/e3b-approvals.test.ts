import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { apiUrl, authHeaders, createProject, testApp } from "./helpers.js";

const checklist = {
  originalAnalysis: true,
  variesStructure: true,
  notTemplate: true,
};

describe("E3b approvals", () => {
  it("E3b-U1 brief shorter than 10 chars is 400", async () => {
    const { app, db } = testApp();
    const projectId = await createProject(app);
    const res = await app.request(apiUrl(`/projects/${projectId}/jobs`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        module: "script",
        idempotencyKey: "01SCRIPTSHORT00000000000",
        input: { brief: "too short", language: "en", targetDurationSec: 60 },
      }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ errorCode: "validation" });
    const okBody = {
      module: "script",
      idempotencyKey: "01SCRIPTREPLAY0000000000",
      input: { brief: "ten chars.", language: "en", targetDurationSec: 60 },
    };
    const a = await app.request(apiUrl(`/projects/${projectId}/jobs`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(okBody),
    });
    const b = await app.request(apiUrl(`/projects/${projectId}/jobs`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(okBody),
    });
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect((await b.json()).id).toBe((await a.json()).id);
    db.close();
  });

  it("E3b-I2 approval requires full checklist and stores 64-char hash", async () => {
    const { app, db, dataDir } = testApp();
    const projectId = await createProject(app);
    const created = await app.request(apiUrl(`/projects/${projectId}/jobs`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        module: "script",
        idempotencyKey: "01SCRIPTAPPROVE000000000",
        input: { brief: "ten chars.", language: "en", targetDurationSec: 60 },
      }),
    });
    const job = (await created.json()) as { id: string };
    const dir = join(dataDir, "projects", projectId, "script", job.id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "script.json"), '{"title":"Night"}');
    db.prepare("UPDATE jobs SET status = 'done' WHERE id = ?").run(job.id);

    const bad = await app.request(apiUrl(`/projects/${projectId}/approvals/script`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ jobId: job.id, checklist: { originalAnalysis: true } }),
    });
    expect(bad.status).toBe(400);

    const ok = await app.request(apiUrl(`/projects/${projectId}/approvals/script`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ jobId: job.id, checklist }),
    });
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { ok: boolean; approvals: { script: { hash: string } } };
    expect(body.ok).toBe(true);
    expect(body.approvals.script.hash).toHaveLength(64);
    db.close();
  });
});
