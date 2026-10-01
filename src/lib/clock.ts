/**
 * The system clock. The only place that reads real time or sleeps.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/lib/clock.ts
 * Deps:    src/contracts/ports.ts
 * Tested:  test/lib/lib.test.ts
 */
import type { Clock } from "../contracts/ports";

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms))),
};

/** ISO-8601 UTC string for an epoch-millisecond value. */
export const iso = (ms: number): string => new Date(ms).toISOString();

/** YYYY-MM-DD (UTC) for an epoch-millisecond value. */
export const utcDay = (ms: number): string => iso(ms).slice(0, 10);
