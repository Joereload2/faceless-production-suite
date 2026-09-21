import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";

type Env = { Variables: { repoRoot: string } };

export const channelRoutes = new Hono<Env>();

channelRoutes.get("/channels", (c) => {
  const root = join(c.get("repoRoot"), "channels");
  const channels: Array<{ id: string; language: string; piperVoice: string }> = [];
  for (const name of readdirSync(root, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    try {
      const raw = JSON.parse(readFileSync(join(root, name.name, "channel.json"), "utf8")) as {
        id: string;
        language: string;
        piperVoice: string;
      };
      channels.push({ id: raw.id, language: raw.language, piperVoice: raw.piperVoice });
    } catch {
      /* skip broken channel dirs */
    }
  }
  return c.json({ channels });
});
