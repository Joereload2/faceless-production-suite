import { existsSync } from "node:fs";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export function repoRootFrom(metaUrl: string): string {
  return resolve(dirname(fileURLToPath(metaUrl)), "../../..");
}

export function channelJsonPath(repoRoot: string, channel: string): string {
  return join(repoRoot, "channels", channel, "channel.json");
}

export function channelExists(repoRoot: string, channel: string): boolean {
  return existsSync(channelJsonPath(repoRoot, channel));
}

export function projectDir(dataDir: string, projectId: string): string {
  const root = resolve(dataDir, "projects");
  const abs = resolve(root, projectId);
  const prefix = root.endsWith(sep) ? root : root + sep;
  if (abs !== root && !abs.startsWith(prefix)) {
    throw new Error("traversal");
  }
  return abs;
}

export function confinedFile(dataDir: string, projectId: string, rel: string): string {
  const root = projectDir(dataDir, projectId);
  const abs = resolve(root, rel);
  const prefix = root.endsWith(sep) ? root : root + sep;
  if (normalize(abs) !== abs || !abs.startsWith(prefix)) {
    throw new Error("traversal");
  }
  return abs;
}
