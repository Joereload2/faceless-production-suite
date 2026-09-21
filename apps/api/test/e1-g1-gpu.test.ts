import { describe, expect, it } from "vitest";
import { claimOldest } from "../src/jobs/claim.js";
import { apiUrl, authHeaders, createProject, testApp } from "./helpers.js";

describe("E1-G1", () => {
  it("running image blocks a second GPU claim", async () => {
    const { app, db } = testApp();
    const projectId = await createProject(app);
    const input = { prompt: "night library lamp", variants: 1, preset: "image-v1" };
    await app.request(apiUrl(`/projects/${projectId}/jobs`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ module: "image", idempotencyKey: "01GPUJOB000000000000000A", input }),
    });
    await app.request(apiUrl(`/projects/${projectId}/jobs`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        module: "video",
        idempotencyKey: "01GPUJOB000000000000000B",
        input: { prompt: "night library pan", seconds: 2, preset: "video-v1" },
      }),
    });
    expect(claimOldest(db, ["image", "video"], "gpu-a", Date.now())).toBeTruthy();
    expect(claimOldest(db, ["image", "video"], "gpu-b", Date.now())).toBeNull();
    db.close();
  });
});
