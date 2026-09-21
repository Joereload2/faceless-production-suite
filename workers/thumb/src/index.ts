import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { spawnSync } from "node:child_process";
import { SQLITE_PRAGMAS, utcIso, type Module } from "@faceless/schema";
import sharp from "sharp";
import { claimOldest, completeJob } from "./claim.js";
import { thumbSvg } from "./svg.js";

export async function renderThumb(opts: {
  overlayText: string;
  title: string;
  description: string;
  tags: string[];
  exportDir: string;
  masterPath?: string;
}): Promise<{ pngPath: string; svgPath: string; cardPath: string }> {
  mkdirSync(opts.exportDir, { recursive: true });
  const svgPath = join(opts.exportDir, "thumb.svg");
  const pngPath = join(opts.exportDir, "thumb.png");
  const cardPath = join(opts.exportDir, "youtube-card.json");
  const svgXml = thumbSvg(opts.overlayText);
  writeFileSync(svgPath, svgXml);
  if (opts.masterPath) {
    const frame = join(opts.exportDir, "frame.png");
    const r = spawnSync("ffmpeg", ["-y", "-i", opts.masterPath, "-frames:v", "1", frame], {
      windowsHide: true,
    });
    if (r.status !== 0) {
      /* solid SVG fallback — do not fail */
    }
  }
  await sharp(Buffer.from(svgXml)).png().toFile(pngPath);
  writeFileSync(
    cardPath,
    JSON.stringify(
      {
        title: opts.title,
        description: opts.description,
        tags: opts.tags,
        categoryId: "27",
        syntheticMedia: true,
        madeForKids: false,
        thumbSvg: "export/thumb.svg",
        thumbPng: "export/thumb.png",
      },
      null,
      2,
    ),
  );
  return { pngPath, svgPath, cardPath };
}

export async function processThumbJob(
  db: DatabaseSync,
  job: Record<string, unknown>,
  dataDir: string,
): Promise<void> {
  const id = String(job.id);
  const projectId = String(job.project_id ?? job.projectId);
  const input = JSON.parse(String(job.input_json ?? "{}")) as {
    overlayText: string;
    title: string;
    description: string;
    tags: string[];
  };
  const exportDir = join(dataDir, "projects", projectId, "export");
  const masterPath = join(dataDir, "projects", projectId, "export", "master_16x9.mp4");
  const out = await renderThumb({
    overlayText: input.overlayText,
    title: input.title,
    description: input.description,
    tags: input.tags,
    exportDir,
    masterPath,
  });
  const bytes = statSync(out.pngPath).size;
  const output = JSON.stringify({
    files: [
      { kind: "image", path: "export/thumb.svg", mime: "image/svg+xml" },
      { kind: "image", path: "export/thumb.png", mime: "image/png", bytes },
      { kind: "json", path: "export/youtube-card.json", mime: "application/json" },
    ],
    meta: { categoryId: "27" },
  });
  completeJob(db, id, projectId, "thumb-ts", output, bytes, utcIso());
}

async function main(): Promise<void> {
  const dataDir = process.env.DATA_DIR ?? "./data";
  const db = new DatabaseSync(join(dataDir, "studio.sqlite"));
  for (const p of SQLITE_PRAGMAS) db.exec(p);
  for (;;) {
    const job = claimOldest(db, ["thumb"] as Module[], "thumb-ts", Date.now());
    if (!job) {
      await new Promise((r) => setTimeout(r, 500));
      continue;
    }
    await processThumbJob(db, job, dataDir);
  }
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("index.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
