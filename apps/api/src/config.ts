import { z } from "zod";

const EnvZ = z.object({
  STUDIO_HOST: z
    .string()
    .default("127.0.0.1")
    .refine((h) => h === "127.0.0.1", "STUDIO_HOST must be 127.0.0.1"),
  STUDIO_PORT: z.coerce.number().int().default(8787),
  STUDIO_TOKEN: z.string().min(32, "STUDIO_TOKEN required, min 32 chars"),
  DATA_DIR: z.string().default("./data"),
  CLOUD_JOBS: z.string().default("0"),
  DAILY_TOKEN_BUDGET: z.coerce.number().int().default(200000),
  DAILY_STOCK_CALLS: z.coerce.number().int().default(80),
  EXTENSION_ID: z.string().optional().default(""),
  DUMMY_MODULES: z.string().optional().default(""),
  WEB_DIST: z.string().optional().default(""),
});

export type Config = z.infer<typeof EnvZ>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return EnvZ.parse({
    STUDIO_HOST: env.STUDIO_HOST,
    STUDIO_PORT: env.STUDIO_PORT,
    STUDIO_TOKEN: env.STUDIO_TOKEN,
    DATA_DIR: env.DATA_DIR,
    CLOUD_JOBS: env.CLOUD_JOBS,
    DAILY_TOKEN_BUDGET: env.DAILY_TOKEN_BUDGET,
    DAILY_STOCK_CALLS: env.DAILY_STOCK_CALLS,
    EXTENSION_ID: env.EXTENSION_ID,
    DUMMY_MODULES: env.DUMMY_MODULES,
    WEB_DIST: env.WEB_DIST,
  });
}
