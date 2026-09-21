import { describe, expect, it } from "vitest";
import { apiUrl, authHeaders, createProject, testApp } from "./helpers.js";

describe("E4-I4", () => {
  it("source=unsplash is 400 source not in v1", async () => {
    const { app, db } = testApp();
    const projectId = await createProject(app);
    const res = await app.request(apiUrl(`/projects/${projectId}/jobs`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        module: "stock",
        idempotencyKey: "01STOCKUNSPLASH000000000",
        input: {
          query: "night library",
          orientation: "landscape",
          count: 1,
          source: "unsplash",
        },
      }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ errorCode: "validation", message: "source not in v1" });
    db.close();
  });
});
