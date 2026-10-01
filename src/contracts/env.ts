/**
 * Worker bindings, secrets and the Hono app types. FROZEN after Wave 0.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/contracts/env.ts
 * Deps:    hono, @cloudflare/workers-types
 * Tested:  n/a (types only)
 */
import type { Deps } from "./ports";
import type { Reports } from "./reports";

export interface Env {
  readonly DB: D1Database;
  readonly ASSETS: Fetcher;
  readonly SYNC_WORKFLOW: Workflow;

  // secrets (wrangler secret put; never in wrangler.jsonc, never logged)
  readonly GROUPON_PARTNER_API_KEY?: string;
  /** Bearer for /api/v1/* and /mcp. */
  readonly ZAL_AGENT_TOKEN?: string;
  /** Bearer for /ingest/*. */
  readonly ZAL_INGEST_TOKEN?: string;
  /** Bearer for /admin/* (job triggers from the command line). */
  readonly ZAL_ADMIN_TOKEN?: string;

  // vars (wrangler.jsonc)
  readonly PARTNER_BASE_URL: string;
  readonly PARTNER_USER_AGENT: string;
  readonly PARTNER_MIN_INTERVAL_MS: string;
  readonly SYNC_PAGE_SIZE: string;
  readonly CART_SAMPLE_SIZE: string;
  readonly KNOWN_ORDER_UUID?: string;
}

/** Hono generics used by every route module. `deps` is set by the composition middleware. */
export interface AppEnv {
  Bindings: Env;
  Variables: { deps: Deps; reports: Reports };
}

export const PARTNER_DISPLAY_NAME = "Zora Agent Lab";
export const PUBLIC_HOST = "zorasocial.asajj.cz";
