import { describe, expect, it } from "vitest";
import { apiUrl, authHeaders, createProject, testApp } from "./helpers.js";

describe("E5-I1", () => {
  it("POST rows then GET same videoId with ratio null", async () => {
    const { app, db } = testApp();
    const projectId = await createProject(app);
    const post = await app.request(apiUrl(`/projects/${projectId}/outliers`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        rows: [{ videoId: "vidAAAA", title: "A", views: 1000, subscribers: null }],
      }),
    });
    expect(post.status).toBe(200);
    expect(await post.json()).toEqual({ upserted: 1 });
    const got = await app.request(apiUrl(`/projects/${projectId}/outliers`), { headers: authHeaders() });
    expect(got.status).toBe(200);
    const body = (await got.json()) as { rows: Array<{ videoId: string; ratio: number | null }> };
    expect(body.rows[0]?.videoId).toBe("vidAAAA");
    expect(body.rows[0]?.ratio).toBeNull();
    db.close();
  });
});
