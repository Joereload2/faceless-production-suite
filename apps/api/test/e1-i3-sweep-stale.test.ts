import { describe, expect, it } from "vitest";
import { utcIso } from "@faceless/schema";
import { claimOldest } from "../src/jobs/claim.js";
import { sweepOnce } from "../src/jobs/sweep.js";
import { apiUrl, authHeaders, createProject, testApp } from "./helpers.js";

describe("E1-I3", () => {
  it("running with expired lease is swept stale", async () => {
    const { app, db } = testApp();
    const projectId = await createProject(app);
    const created = await app.request(apiUrl(`/projects/${projectId}/jobs`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        module: "tts",
        idempotencyKey: "01SWEEPSTALE0000000000000",
        input: { text: "Hello from the night library." },
      }),
    });
    const job = (await created.json()) as { id: string };
    const t0 = Date.now();
    expect(claimOldest(db, ["tts"], "cpu-a", t0)).toBeTruthy();
    sweepOnce(db, utcIso(t0 + 60_000));
    const row = db.prepare("SELECT status, error_code FROM jobs WHERE id = ?").get(job.id) as {
      status: string;
      error_code: string;
    };
    expect(row).toMatchObject({ status: "error", error_code: "stale" });
    db.close();
  });
});
