import { describe, expect, it } from "vitest";
import { apiUrl, authHeaders, createProject, testApp } from "./helpers.js";

describe("E9-U1", () => {
  it("video seconds 6 is 400", async () => {
    const { app, db } = testApp();
    const projectId = await createProject(app);
    const res = await app.request(apiUrl(`/projects/${projectId}/jobs`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        module: "video",
        idempotencyKey: "01VIDEOSECONDS0000000000",
        input: { prompt: "night pan", seconds: 6, preset: "video-v1" },
      }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ errorCode: "validation" });
    db.close();
  });
});
