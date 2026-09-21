import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { config as loadDotenv } from "dotenv";
import { createApp } from "./app.js";
import { loadConfig, type Config } from "./config.js";
import { openStudioDb } from "./db.js";
import { log } from "./log.js";
import { repoRootFrom } from "./paths.js";

loadDotenv();

let config: Config;
try {
  config = loadConfig();
} catch {
  log({ level: "error", event: "config_invalid" });
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const db = openStudioDb(config.DATA_DIR, join(here, "../drizzle"));
const app = createApp({ config, db, repoRoot: repoRootFrom(import.meta.url) });

serve({ fetch: app.fetch, hostname: config.STUDIO_HOST, port: config.STUDIO_PORT }, () => {
  log({ level: "info", event: "listen", extra: `${config.STUDIO_HOST}:${config.STUDIO_PORT}` });
});
