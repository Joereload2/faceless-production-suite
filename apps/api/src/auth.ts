import { createHmac, timingSafeEqual } from "node:crypto";
import { getCookie, setCookie } from "hono/cookie";
import type { Context, Next } from "hono";
import type { Config } from "./config.js";
import { errJson } from "./http.js";

export const TOKEN_COOKIE = "studio_token";
const TOKEN_MSG = "faceless.token.v1";
const COOKIE_MAX_AGE = 604800;

export function hmacToken(secret: string): Buffer {
  return createHmac("sha256", secret).update(TOKEN_MSG).digest();
}

export function timingSafeHexEqual(hex: string, expected: Buffer): boolean {
  try {
    const got = Buffer.from(hex, "hex");
    if (got.length !== expected.length) return false;
    return timingSafeEqual(got, expected);
  } catch {
    return false;
  }
}

export function hostAllowlist(config: Config): Set<string> {
  return new Set([`127.0.0.1:${config.STUDIO_PORT}`, "127.0.0.1:5173"]);
}

export function originAllowlist(config: Config): Set<string> {
  const set = new Set([
    `http://127.0.0.1:${config.STUDIO_PORT}`,
    "http://127.0.0.1:5173",
  ]);
  if (config.EXTENSION_ID.length > 0) {
    set.add(`chrome-extension://${config.EXTENSION_ID}`);
  }
  return set;
}

export function isValidBearer(header: string | undefined, config: Config): boolean {
  if (!header || !header.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length);
  if (token.length < 32) return false;
  try {
    return timingSafeEqual(hmacToken(token), hmacToken(config.STUDIO_TOKEN));
  } catch {
    return false;
  }
}

export function isValidCookie(hex: string | undefined, config: Config): boolean {
  if (!hex) return false;
  return timingSafeHexEqual(hex, hmacToken(config.STUDIO_TOKEN));
}

export function setLoginCookie(c: Context, config: Config): void {
  setCookie(c, TOKEN_COOKIE, hmacToken(config.STUDIO_TOKEN).toString("hex"), {
    httpOnly: true,
    sameSite: "Strict",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export function clearLoginCookie(c: Context): void {
  setCookie(c, TOKEN_COOKIE, "", {
    httpOnly: true,
    sameSite: "Strict",
    path: "/",
    maxAge: 0,
  });
}

function skipAuth(method: string, path: string): boolean {
  if (method === "GET" && path === "/health") return true;
  if (method === "POST" && path === "/auth/login") return true;
  if (method === "POST" && path === "/auth/logout") return true;
  if (method === "OPTIONS") return true;
  return false;
}

export async function gate(c: Context, next: Next): Promise<Response | void> {
  const config = c.get("config") as Config;
  const host = c.req.header("host") ?? new URL(c.req.url).host;
  if (!hostAllowlist(config).has(host)) {
    return c.json(errJson("validation", "bad host"), 400);
  }

  const origin = c.req.header("origin");
  if (origin && config.EXTENSION_ID.length > 0 && origin === `chrome-extension://${config.EXTENSION_ID}`) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Credentials", "true");
    c.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
    c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    c.header("Vary", "Origin");
  }

  const path = new URL(c.req.url).pathname;
  const method = c.req.method.toUpperCase();
  if (skipAuth(method, path)) {
    await next();
    return;
  }

  const bearer = c.req.header("authorization");
  const bearerOk = isValidBearer(bearer, config);
  if (method !== "GET" && method !== "HEAD") {
    if (!origin) {
      if (!bearerOk) return c.json(errJson("unauthorized", "unauthorized"), 401);
    } else if (!originAllowlist(config).has(origin)) {
      return c.json(errJson("validation", "bad origin"), 403);
    }
  }

  const cookieOk = isValidCookie(getCookie(c, TOKEN_COOKIE), config);
  if (!cookieOk && !bearerOk) {
    return c.json(errJson("unauthorized", "unauthorized"), 401);
  }
  await next();
}
