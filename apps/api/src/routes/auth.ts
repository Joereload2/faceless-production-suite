import { Hono } from "hono";
import type { Config } from "../config.js";
import { clearLoginCookie, hmacToken, setLoginCookie } from "../auth.js";
import { errJson } from "../http.js";
import { timingSafeEqual } from "node:crypto";

export const authRoutes = new Hono<{ Variables: { config: Config } }>();

authRoutes.post("/auth/login", async (c) => {
  const config = c.get("config");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(errJson("validation", "invalid json"), 400);
  }
  const token = (body as { token?: unknown }).token;
  if (typeof token !== "string" || token.length < 32) {
    return c.json(errJson("validation", "token too short"), 400);
  }
  let ok = false;
  try {
    ok = timingSafeEqual(hmacToken(token), hmacToken(config.STUDIO_TOKEN));
  } catch {
    ok = false;
  }
  if (!ok) return c.json(errJson("unauthorized", "unauthorized"), 401);
  setLoginCookie(c, config);
  return c.body(null, 204);
});

authRoutes.post("/auth/logout", (c) => {
  clearLoginCookie(c);
  return c.body(null, 204);
});

authRoutes.get("/auth/me", (c) => {
  return c.json({ ok: true });
});
