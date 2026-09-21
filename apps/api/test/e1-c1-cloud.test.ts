import { describe, expect, it } from "vitest";
import { apiUrl, authHeaders, createProject, testApp } from "./helpers.js";

describe("E1-C1", () => {
  it("engine=cloud is 403 config", async () => {
    const { app, db } = testApp();
    const projectId = await createProject(app);
    const res = await app.request(apiUrl(`/projects/${projectId}/jobs`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        module: "tts",
        engine: "cloud",
        idempotencyKey: "01CLOUDJOB000000000000000",
        input: { text: "Hello from the night library." },
      }),
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ errorCode: "config", message: "cloud jobs disabled" });
    db.close();
  });
});
