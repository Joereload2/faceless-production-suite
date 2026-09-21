import { describe, expect, it } from "vitest";
import { parseStudioHtml, ratio } from "../src/parseStudio";

describe("E5-U2", () => {
  it("subscribers missing yields ratio null even if views=1000", () => {
    const html = `<table><tr><td><a href="/video/vidAAAA">A</a></td><td>1,000 views</td></tr></table>`;
    const rows = parseStudioHtml(html);
    expect(rows[0]?.subscribers).toBeNull();
    expect(ratio(rows[0]?.views ?? 1000, rows[0]?.subscribers ?? null)).toBeNull();
    expect(ratio(1000, null)).toBeNull();
  });
});
