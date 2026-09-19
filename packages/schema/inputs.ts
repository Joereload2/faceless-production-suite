/**
 * Shapes of Job.input per module. Runtime validation (Zod) lands in E1
 * in this same package. Until then these types are the contract.
 */

import type { Module } from "./job";

export type Orientation = "landscape" | "portrait";

export interface TtsInput {
  text: string;
  voice?: string;
}

export interface StockInput {
  query: string;
  orientation: Orientation;
  count: number;
}

export interface ImageInput {
  prompt: string;
  variants: number;
  preset: "image-v1";
}

export interface VideoInput {
  prompt: string;
  seconds: number;
  preset: "video-v1";
}

export interface CaptionsInput {
  audioJobId: string;
}

export interface AssembleClip {
  fileJobId: string;
  fileName: string;
  fileKind: "image" | "stock" | "video";
  timelineStartSec: number;
  timelineEndSec: number;
  sourceInSec?: number;
}

export interface AssembleSpec {
  width: 1920;
  height: 1080;
  fps: 30;
  audioJobId: string;
  captionsJobId?: string;
  clips: AssembleClip[];
}

export interface AssembleInput {
  spec: AssembleSpec;
}

export interface SeoInput {
  siteUrl: string;
  days: number;
}

export type ModuleInput = {
  tts: TtsInput;
  stock: StockInput;
  image: ImageInput;
  video: VideoInput;
  captions: CaptionsInput;
  assemble: AssembleInput;
  seo: SeoInput;
};

export type InputFor<M extends Module> = ModuleInput[M];
