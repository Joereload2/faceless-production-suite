import { mkdirSync, readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync as read } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { renderThumb } from "../src/index.js";

describe("thumb", () => {
  it("E7b-I1 png 1280x720, svg exists, card.categoryId 27", async () => {
    const dir = mkdtempSync(join(tmpdir(), "faceless-thumb-"));
    const exportDir = join(dir, "export");
    mkdirSync(exportDir, { recursive: true });
    const out = await renderThumb({
      overlayText: "WAIT",
      title: "Night",
      description: "d",
      tags: ["faceless"],
      exportDir,
    });
    const meta = await sharp(out.pngPath).metadata();
    expect(meta.width).toBe(1280);
    expect(meta.height).toBe(720);
    expect(readFileSync(out.svgPath, "utf8")).toContain("WAIT");
    const card = JSON.parse(read(out.cardPath, "utf8")) as { categoryId: string };
    expect(card.categoryId).toBe("27");
  });

  it("E7b-C1 claim uses BEGIN IMMEDIATE and contract.sql.claimById", () => {
    const src = readFileSync(new URL("../src/claim.ts", import.meta.url), "utf8");
    expect(src).toContain("BEGIN IMMEDIATE");
    expect(src).toContain("contract.sql.claimById");
  });
});
