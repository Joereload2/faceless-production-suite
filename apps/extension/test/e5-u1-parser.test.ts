import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseStudioHtml } from "../src/parseStudio";

const here = dirname(fileURLToPath(import.meta.url));

describe("E5-U1", () => {
  it("parser fixture yields vidAAAA and vidBBBB", () => {
    const html = readFileSync(join(here, "../fixtures/studio-table.html"), "utf8");
    const rows = parseStudioHtml(html);
    expect(rows.map((r) => r.videoId)).toEqual(["vidAAAA", "vidBBBB"]);
  });
});
