import { createHash } from "node:crypto";

export function canonicalize(v: unknown): unknown {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(canonicalize);
  const o = v as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(o).sort()) out[k] = canonicalize(o[k]);
  return out;
}

export function canonicalJson(v: unknown): string {
  return JSON.stringify(canonicalize(v));
}

export function inputHash(v: unknown): string {
  return createHash("sha256").update(canonicalJson(v), "utf8").digest("hex");
}
