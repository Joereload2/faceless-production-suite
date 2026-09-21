import { describe, expect, it } from "vitest";
import { apiUrl, authHeaders, createProject, testApp } from "./helpers.js";

describe("E1-S1", () => {
  it("migrate + POST project + POST job + GET 200", async () => {
    const { app, db } = testApp();
    const projectId = await createProject(app);
    const created = await app.request(apiUrl(`/projects/${projectId}/jobs`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        module: "tts",
        idempotencyKey: "01SMOKEJOB000000000000000",
        input: { text: "Hello from the night library." },
      }),
    });
    expect(created.status).toBe(201);
    const job = (await created.json()) as { id: string; status: string; timeoutSec: number };
    expect(job.status).toBe("queued");
    expect(job.timeoutSec).toBe(120);
    const got = await app.request(apiUrl(`/jobs/${job.id}`), { headers: authHeaders() });
    expect(got.status).toBe(200);
    expect((await got.json()).id).toBe(job.id);
    db.close();
  });
});
