import { describe, expect, it } from "vitest";
import { TOKEN, apiUrl, hostHeaders, testApp } from "./helpers.js";

describe("E1-P1", () => {
  it("POST /projects + GET list 200", async () => {
    const { app, db } = testApp();
    const auth = hostHeaders({
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    });
    const created = await app.request(apiUrl("/projects"), {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ title: "Night library", channel: "demo" }),
    });
    expect(created.status).toBe(201);
    const project = (await created.json()) as {
      id: string;
      title: string;
      channel: string;
      bytesUsed: number;
      approvals: { script: null };
    };
    expect(project.title).toBe("Night library");
    expect(project.channel).toBe("demo");
    expect(project.bytesUsed).toBe(0);
    expect(project.approvals.script).toBeNull();
    expect(project.id.length).toBeGreaterThan(8);

    const listed = await app.request(apiUrl("/projects"), { headers: hostHeaders({ Authorization: `Bearer ${TOKEN}` }) });
    expect(listed.status).toBe(200);
    const body = (await listed.json()) as { projects: Array<{ id: string }> };
    expect(body.projects.map((p) => p.id)).toEqual([project.id]);
    db.close();
  });
});
