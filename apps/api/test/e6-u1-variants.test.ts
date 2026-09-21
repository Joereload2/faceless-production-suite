import { describe, expect, it } from "vitest";
import { apiUrl, authHeaders, createProject, testApp } from "./helpers.js";

describe("E6-U1", () => {
  it("image variants 5 is 400", async () => {
    const { app, db } = testApp();
    const projectId = await createProject(app);
    const res = await app.request(apiUrl(`/projects/${projectId}/jobs`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        module: "image",
        idempotencyKey: "01IMAGEVARIANTS000000000",
        input: { prompt: "night lamp", variants: 5, preset: "image-v1" },
      }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ errorCode: "validation" });
    db.close();
  });
});
