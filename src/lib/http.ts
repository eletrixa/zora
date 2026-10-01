/**
 * Response helpers and the bearer-token middleware shared by /api/v1, /mcp, /ingest and /admin.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/lib/http.ts
 * Deps:    hono, src/lib/crypto.ts
 * Tested:  test/app/gates.test.ts
 */
import type { Context, MiddlewareHandler } from "hono";
import type { AppEnv, Env } from "../contracts/env";
import { timingSafeEqual } from "./crypto";

export const PRIVATE_HEADERS: Readonly<Record<string, string>> = {
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
};

export interface ErrorBody {
  readonly error: { readonly code: string; readonly message: string };
}

export function errorJson(c: Context, status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500 | 503, code: string, message: string): Response {
  const body: ErrorBody = { error: { code, message } };
  return c.json(body, status, PRIVATE_HEADERS);
}

/** The bearer token of the request, or null. */
export function bearerOf(c: Context): string | null {
  const header = c.req.header("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] ?? null;
}

type TokenName = "ZAL_AGENT_TOKEN" | "ZAL_INGEST_TOKEN" | "ZAL_ADMIN_TOKEN";

/** True when the request carries the named token. An unset secret never matches. */
export function hasToken(c: Context<AppEnv>, name: TokenName): boolean {
  const expected = (c.env as Env)[name];
  const given = bearerOf(c);
  if (!expected || expected.length < 16 || !given) return false;
  return timingSafeEqual(given, expected);
}

/** Fail closed: no secret configured answers 503, wrong or missing token answers 401. */
export function requireToken(name: TokenName): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const expected = c.env[name];
    if (!expected || expected.length < 16) return errorJson(c, 503, "not_configured", `${name} is not set`);
    if (!hasToken(c, name)) return errorJson(c, 401, "unauthenticated", "missing or wrong bearer token");
    await next();
  };
}
