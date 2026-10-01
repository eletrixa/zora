/**
 * A counter per key and minute, kept in D1, for caps that must hold across requests and
 * isolates (module state does not).
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/lib/rate.ts
 * Deps:    D1 (table rate_windows)
 * Tested:  test/lib/rate.test.ts
 */

const MINUTE_MS = 60_000;
const KEEP_MS = 60 * MINUTE_MS;

/** Counts this event and says whether it is still within `limit` events in the current minute. */
export async function withinMinuteLimit(db: D1Database, key: string, limit: number, now: number): Promise<boolean> {
  const windowStart = Math.floor(now / MINUTE_MS) * MINUTE_MS;
  const row = await db
    .prepare(
      `INSERT INTO rate_windows (key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1
       RETURNING count`,
    )
    .bind(key, windowStart)
    .first<{ count: number }>();
  // Old windows are dropped now and then, so the table stays small.
  if (windowStart % (10 * MINUTE_MS) === 0 && Number(row?.count ?? 0) === 1) {
    await db.prepare("DELETE FROM rate_windows WHERE window_start < ?1").bind(windowStart - KEEP_MS).run();
  }
  return Number(row?.count ?? 0) <= limit;
}
