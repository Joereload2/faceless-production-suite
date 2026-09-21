import { DatabaseSync } from "node:sqlite";
import { Hono } from "hono";
import { ZodError } from "zod";
import { gate } from "./auth.js";
import type { Config } from "./config.js";
import { HttpError, errJson } from "./http.js";
import { log } from "./log.js";
import { approvalRoutes } from "./routes/approvals.js";
import { authRoutes } from "./routes/auth.js";
import { channelRoutes } from "./routes/channels.js";
import { fileRoutes } from "./routes/files.js";
import { healthRoutes } from "./routes/health.js";
import { jobRoutes } from "./routes/jobs.js";
import { projectRoutes } from "./routes/projects.js";

export type AppEnv = {
  Variables: {
    config: Config;
    db: DatabaseSync;
    repoRoot: string;
  };
};

export function createApp(opts: { config: Config; db: DatabaseSync; repoRoot: string }): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("config", opts.config);
    c.set("db", opts.db);
    c.set("repoRoot", opts.repoRoot);
    await next();
  });
  app.use("*", gate);
  app.route("/", healthRoutes);
  app.route("/", authRoutes);
  app.route("/", projectRoutes);
  app.route("/", jobRoutes);
  app.route("/", fileRoutes);
  app.route("/", channelRoutes);
  app.route("/", approvalRoutes);
  app.notFound((c) => c.json(errJson("validation", "not found"), 404));
  app.onError((err, c) => {
    if (err instanceof HttpError) {
      return c.json(
        errJson(err.errorCode, err.message),
        err.status as 400 | 401 | 403 | 404 | 409 | 429 | 500,
      );
    }
    if (err instanceof ZodError) {
      const first = err.issues[0];
      return c.json(errJson("validation", first ? first.message : "validation"), 400);
    }
    log({ level: "error", event: "unhandled", extra: err instanceof Error ? err.name : "unknown" });
    return c.json(errJson("internal", "internal"), 500);
  });
  return app;
}
