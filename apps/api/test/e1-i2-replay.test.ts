import { describe, expect, it } from "vitest";
import { apiUrl, authHeaders, createProject, testApp } from "./helpers.js";

describe("E1-I2", () => {
  it("same key+input replays id; different input is 409", async () => {
    const { app, db } = testApp();
    const projectId = await createProject(app);
    const body = {
      module: "tts",
      idempotencyKey: "01REPLAYKEY00000000000000",
      input: { text: "Hello from the night library." },
    };
    const a = await app.request(apiUrl(`/projects/${projectId}/jobs`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    expect(a.status).toBe(201);
    const jobA = (await a.json()) as { id: string };
    const b = await app.request(apiUrl(`/projects/${projectId}/jobs`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    expect(b.status).toBe(200);
    expect((await b.json()).id).toBe(jobA.id);
    const c = await app.request(apiUrl(`/projects/${projectId}/jobs`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ ...body, input: { text: "A different night library line." } }),
    });
    expect(c.status).toBe(409);
    expect(await c.json()).toMatchObject({ errorCode: "idempotency_conflict" });
    db.close();
  });
});
