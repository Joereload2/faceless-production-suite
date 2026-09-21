import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import type { AppEnv } from "./app.js";

export function serveStaticApp(api: Hono<AppEnv>, webDist: string): Hono {
  const root = new Hono();
  root.route("/api", api);
  root.use("/*", serveStatic({ root: webDist }));
  return root;
}
