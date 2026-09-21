import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { openStudioDb } from "../src/db.js";
import { repoRootFrom } from "../src/paths.js";

export const TOKEN = "t".repeat(32);

const here = dirname(fileURLToPath(import.meta.url));

export function testApp() {
  const dataDir = mkdtempSync(join(tmpdir(), "faceless-e1-"));
  const config = loadConfig({
    STUDIO_HOST: "127.0.0.1",
    STUDIO_PORT: "8787",
    STUDIO_TOKEN: TOKEN,
    DATA_DIR: dataDir,
    CLOUD_JOBS: "0",
  });
  const db = openStudioDb(dataDir, join(here, "../drizzle"));
  const app = createApp({ config, db, repoRoot: repoRootFrom(import.meta.url) });
  return { app, config, db, dataDir };
}

export function hostHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return extra;
}

export function apiUrl(path: string): string {
  return `http://127.0.0.1:8787${path}`;
}
