import { describe, expect, it } from "vitest";
import { TOKEN, apiUrl, hostHeaders, testApp } from "./helpers.js";

describe("E1-A2 auth", () => {
  it("GET /projects without cookie or bearer is 401 unauthorized; /health is 200", async () => {
    const { app, db } = testApp();
    const denied = await app.request(apiUrl("/projects"), { headers: hostHeaders() });
    expect(denied.status).toBe(401);
    expect(await denied.json()).toMatchObject({ errorCode: "unauthorized", message: "unauthorized" });
    const health = await app.request(apiUrl("/health"), { headers: hostHeaders() });
    expect(health.status).toBe(200);
    const body = (await health.json()) as { ok: boolean; cloudJobs: boolean };
    expect(body.ok).toBe(true);
    expect(body.cloudJobs).toBe(false);
    db.close();
  });
});

describe("E1-A3 logout", () => {
  it("POST /auth/logout without cookie or Bearer is 204 and clears studio_token", async () => {
    const { app, db } = testApp();
    const res = await app.request(apiUrl("/auth/logout"), { method: "POST", headers: hostHeaders() });
    expect(res.status).toBe(204);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("studio_token=");
    expect(setCookie.toLowerCase()).toContain("max-age=0");
    db.close();
  });

  it("login then /auth/me with cookie is 200", async () => {
    const { app, db } = testApp();
    const login = await app.request(apiUrl("/auth/login"), {
      method: "POST",
      headers: hostHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ token: TOKEN }),
    });
    expect(login.status).toBe(204);
    const cookie = login.headers.get("set-cookie") ?? "";
    const match = cookie.match(/studio_token=([^;]+)/);
    expect(match?.[1]).toBeTruthy();
    const me = await app.request(apiUrl("/auth/me"), {
      headers: hostHeaders({ Cookie: `studio_token=${match?.[1]}` }),
    });
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({ ok: true });
    db.close();
  });
});
