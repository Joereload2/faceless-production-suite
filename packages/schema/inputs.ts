/**
 * Shapes of Job.input per module. Zod is the runtime contract.
 */

import { z } from "zod";
import type { Module } from "./job.js";

export type Orientation = "landscape" | "portrait";

export const TtsInputZ = z
  .object({
    text: z.string().min(1).max(5000),
    voice: z.string().min(1).max(80).optional(),
    language: z.enum(["en", "es"]).optional(),
  })
  .strict();
export type TtsInput = z.infer<typeof TtsInputZ>;

export const StockInputZ = z
  .object({
    query: z.string().min(2).max(120),
    orientation: z.enum(["landscape", "portrait"]),
    count: z.number().int().min(1).max(8),
    source: z.enum(["pexels", "unsplash", "library"]).optional(),
  })
  .strict();
export type StockInput = z.infer<typeof StockInputZ>;

export const ImageInputZ = z
  .object({
    prompt: z.string().min(1).max(1500),
    variants: z.number().int().min(1).max(4),
    preset: z.literal("image-v1"),
  })
  .strict();
export type ImageInput = z.infer<typeof ImageInputZ>;

export const VideoInputZ = z
  .object({
    prompt: z.string().min(1).max(1500),
    seconds: z.number().int().min(1).max(5),
    preset: z.literal("video-v1"),
  })
  .strict();
export type VideoInput = z.infer<typeof VideoInputZ>;

export const CaptionsInputZ = z
  .object({
    audioJobId: z.string().min(8).max(32),
  })
  .strict();
export type CaptionsInput = z.infer<typeof CaptionsInputZ>;

export const AssembleClipZ = z
  .object({
    fileJobId: z.string().min(8).max(32),
    fileName: z.string().min(1).max(120).regex(/^[A-Za-z0-9._-]+$/),
    fileKind: z.enum(["image", "stock", "video"]),
    timelineStartSec: z.number().min(0).max(3600),
    timelineEndSec: z.number().min(0).max(3600),
    sourceInSec: z.number().min(0).max(3600).optional(),
  })
  .strict()
  .refine((c) => c.timelineEndSec > c.timelineStartSec, "end>start");
export type AssembleClip = z.infer<typeof AssembleClipZ>;

export const AssembleSpecZ = z
  .object({
    width: z.literal(1920),
    height: z.literal(1080),
    fps: z.literal(30),
    audioJobId: z.string().min(8).max(32),
    captionsJobId: z.string().min(8).max(32).optional(),
    clips: z.array(AssembleClipZ).min(1).max(40),
  })
  .strict();
export type AssembleSpec = z.infer<typeof AssembleSpecZ>;

export const AssembleInputZ = z.object({ spec: AssembleSpecZ }).strict();
export type AssembleInput = z.infer<typeof AssembleInputZ>;

export const SeoInputZ = z
  .object({
    siteUrl: z.string().url().max(200),
    days: z.number().int().min(1).max(90),
  })
  .strict();
export type SeoInput = z.infer<typeof SeoInputZ>;

export const ScriptInputZ = z
  .object({
    brief: z.string().min(10).max(4000),
    language: z.enum(["en", "es"]),
    targetDurationSec: z.number().int().min(30).max(180),
  })
  .strict();
export type ScriptInput = z.infer<typeof ScriptInputZ>;

export const ThumbInputZ = z
  .object({
    masterJobId: z.string().min(8).max(32),
    title: z.string().min(1).max(100),
    overlayText: z.string().min(1).max(32),
    description: z.string().min(1).max(5000),
    tags: z.array(z.string().min(1).max(30)).min(1).max(15),
  })
  .strict();
export type ThumbInput = z.infer<typeof ThumbInputZ>;

export type ModuleInput = {
  tts: TtsInput;
  stock: StockInput;
  image: ImageInput;
  video: VideoInput;
  captions: CaptionsInput;
  assemble: AssembleInput;
  seo: SeoInput;
  script: ScriptInput;
  thumb: ThumbInput;
};

export type InputFor<M extends Module> = ModuleInput[M];

export const INPUT_ZOD = {
  tts: TtsInputZ,
  stock: StockInputZ,
  image: ImageInputZ,
  video: VideoInputZ,
  captions: CaptionsInputZ,
  assemble: AssembleInputZ,
  seo: SeoInputZ,
  script: ScriptInputZ,
  thumb: ThumbInputZ,
} as const;

const engineZ = z.enum(["local", "cloud"]).default("local");
const idempotencyKeyZ = z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/);

function jobBody<M extends Module, I extends z.ZodType>(module: M, input: I) {
  return z
    .object({
      module: z.literal(module),
      engine: engineZ,
      idempotencyKey: idempotencyKeyZ,
      input,
    })
    .strict();
}

export const CreateJobBodyZ = z.discriminatedUnion("module", [
  jobBody("tts", TtsInputZ),
  jobBody("stock", StockInputZ),
  jobBody("image", ImageInputZ),
  jobBody("video", VideoInputZ),
  jobBody("captions", CaptionsInputZ),
  jobBody("assemble", AssembleInputZ),
  jobBody("seo", SeoInputZ),
  jobBody("script", ScriptInputZ),
  jobBody("thumb", ThumbInputZ),
]);

export type CreateJobBody = z.infer<typeof CreateJobBodyZ>;
