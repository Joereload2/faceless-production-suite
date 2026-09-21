import { describe, expect, it } from "vitest";
import { apiUrl, authHeaders, createProject, testApp } from "./helpers.js";

describe("E1-U2", () => {
  it("POST job without idempotencyKey is 400 validation", async () => {
    const { app, db } = testApp();
    const projectId = await createProject(app);
    const res = await app.request(apiUrl(`/projects/${projectId}/jobs`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ module: "tts", input: { text: "Hello from the night library." } }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ errorCode: "validation" });
    db.close();
  });
});
