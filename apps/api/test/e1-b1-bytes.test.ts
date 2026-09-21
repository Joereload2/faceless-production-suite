import { describe, expect, it } from "vitest";
import { claimOldest } from "../src/jobs/claim.js";
import { finishDummyJob } from "../src/dummy-worker.js";
import { apiUrl, authHeaders, createProject, testApp } from "./helpers.js";

describe("E1-B1", () => {
  it("dummy COMPLETE tts increments bytes_used to 3", async () => {
    const { app, db, config } = testApp();
    const projectId = await createProject(app);
    await app.request(apiUrl(`/projects/${projectId}/jobs`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        module: "tts",
        idempotencyKey: "01DUMMYBYTES0000000000000",
        input: { text: "Hello from the night library." },
      }),
    });
    const job = claimOldest(db, ["tts"], "dummy-ts", Date.now());
    expect(job).toBeTruthy();
    finishDummyJob(db, config, job as Record<string, unknown>);
    const row = db.prepare("SELECT bytes_used FROM projects WHERE id = ?").get(projectId) as {
      bytes_used: number;
    };
    expect(row.bytes_used).toBe(3);
    db.close();
  });
});
