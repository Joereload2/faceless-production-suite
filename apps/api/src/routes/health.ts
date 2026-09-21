import { Hono } from "hono";
import type { Config } from "../config.js";

export const healthRoutes = new Hono<{ Variables: { config: Config } }>();

healthRoutes.get("/health", (c) => {
  const config = c.get("config");
  return c.json({
    ok: true,
    cloudJobs: config.CLOUD_JOBS === "1",
    ts: new Date().toISOString(),
  });
});
