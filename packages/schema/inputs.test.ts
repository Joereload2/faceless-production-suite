import { describe, expect, it } from "vitest";
import { CreateJobBodyZ, StockInputZ, TtsInputZ } from "./inputs.js";

describe("inputs Zod", () => {
  it("accepts tts without voice", () => {
    expect(TtsInputZ.parse({ text: "hello library" }).text).toBe("hello library");
  });

  it("accepts tts language es", () => {
    expect(TtsInputZ.parse({ text: "hola biblioteca", language: "es" }).language).toBe("es");
  });

  it("StockInput.source is optional; old literals parse", () => {
    const parsed = StockInputZ.parse({
      query: "night library",
      orientation: "landscape",
      count: 1,
    });
    expect(parsed.source).toBeUndefined();
  });

  it("create job body is strict and has script/thumb", () => {
    const script = CreateJobBodyZ.parse({
      module: "script",
      idempotencyKey: "01ABCDEFGH",
      input: { brief: "ten chars.", language: "en", targetDurationSec: 60 },
    });
    expect(script.engine).toBe("local");
    const thumb = CreateJobBodyZ.parse({
      module: "thumb",
      idempotencyKey: "01ABCDEFGH",
      input: {
        masterJobId: "01MASTER01",
        title: "Night",
        overlayText: "WAIT",
        description: "d",
        tags: ["faceless"],
      },
    });
    expect(thumb.module).toBe("thumb");
  });

  it("rejects extra keys", () => {
    expect(() => TtsInputZ.parse({ text: "x", timeoutSec: 1 })).toThrow();
  });
});
