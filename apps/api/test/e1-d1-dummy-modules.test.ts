import { describe, expect, it } from "vitest";
import { claimOldest } from "../src/jobs/claim.js";
import { parseDummyModules } from "../src/dummy-worker.js";
import { apiUrl, authHeaders, createProject, testApp } from "./helpers.js";

describe("E1-D1", () => {
  it("DUMMY_MODULES=stock does not claim a queued tts job", async () => {
    const { app, db } = testApp();
    const projectId = await createProject(app);
    await app.request(apiUrl(`/projects/${projectId}/jobs`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        module: "tts",
        idempotencyKey: "01DUMMYSTOCK0000000000000",
        input: { text: "Hello from the night library." },
      }),
    });
    const modules = parseDummyModules("stock");
    expect(modules).toEqual(["stock"]);
    expect(claimOldest(db, modules, "dummy-ts", Date.now())).toBeNull();
    const row = db.prepare("SELECT status FROM jobs").get() as { status: string };
    expect(row.status).toBe("queued");
    db.close();
  });
});
