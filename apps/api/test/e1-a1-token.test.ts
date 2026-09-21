import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("E1-A1", () => {
  it("STUDIO_TOKEN of 8 chars throws", () => {
    expect(() => loadConfig({ STUDIO_TOKEN: "tttttttt" })).toThrow();
  });
});
