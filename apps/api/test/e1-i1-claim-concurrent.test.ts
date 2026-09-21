import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SQLITE_PRAGMAS } from "@faceless/schema";
import { claimOldest } from "../src/jobs/claim.js";
import { apiUrl, authHeaders, createProject, testApp } from "./helpers.js";

describe("E1-I1", () => {
  it("two claimOldest on WAL: one winner", async () => {
    const { app, db, dataDir } = testApp();
    const projectId = await createProject(app);
    const created = await app.request(apiUrl(`/projects/${projectId}/jobs`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        module: "tts",
        idempotencyKey: "01CLAIMCONCURRENT00000000",
        input: { text: "Hello from the night library." },
      }),
    });
    expect(created.status).toBe(201);
    const path = join(dataDir, "studio.sqlite");
    const b = new DatabaseSync(path);
    for (const p of SQLITE_PRAGMAS) b.exec(p);
    const r1 = claimOldest(db, ["tts"], "cpu-a", Date.now());
    const r2 = claimOldest(b, ["tts"], "cpu-b", Date.now());
    const wins = [r1, r2].filter(Boolean);
    expect(wins).toHaveLength(1);
    b.close();
    db.close();
  });
});
