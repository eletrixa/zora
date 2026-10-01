/**
 * The daily cart sample: one probe cart per sampled option, price checked against the catalogue
 * and abandoned at once. One sample per UTC day.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/monitor/sample.ts
 * Deps:    src/contracts/ports.ts, src/lib/clock.ts
 * Tested:  test/monitor/sample.test.ts
 */
import type { Env } from "../contracts/env";
import type { Deps, Job } from "../contracts/ports";
import { iso, utcDay } from "../lib/clock";

const DEFAULT_SAMPLE_SIZE = 20;
const MAX_SAMPLE_SIZE = 50;

function sampleSize(env: Env): number {
  const parsed = Number(env.CART_SAMPLE_SIZE);
  if (!Number.isInteger(parsed) || parsed <= 0) return DEFAULT_SAMPLE_SIZE;
  return Math.min(parsed, MAX_SAMPLE_SIZE);
}

interface SampleRow {
  readonly day: string;
  readonly productId: string;
  readonly optionId: string;
  readonly expectedMinor: number;
  readonly outcome: "matched" | "price_mismatch" | "unavailable" | "error";
  readonly cartRetailMinor: number | null;
  readonly currentMinor: number | null;
  readonly errorCode: string | null;
  readonly requestId: string | null;
  readonly cartId: string | null;
  readonly sampledAt: string;
}

async function insertRow(db: D1Database, row: SampleRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO cart_samples (day, product_id, option_id, expected_minor, outcome, cart_retail_minor, current_minor, error_code, request_id, cart_id, sampled_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
    )
    .bind(row.day, row.productId, row.optionId, row.expectedMinor, row.outcome, row.cartRetailMinor, row.currentMinor, row.errorCode, row.requestId, row.cartId, row.sampledAt)
    .run();
}

export const runCartSample: Job = async (deps: Deps, env: Env) => {
  const startedAt = iso(deps.clock.now());
  const day = utcDay(deps.clock.now());
  const already = await deps.db.prepare("SELECT COUNT(*) AS n FROM cart_samples WHERE day = ?1").bind(day).first<number>("n");
  if ((already ?? 0) > 0) {
    return { job: "cart-sample", ok: true, startedAt, finishedAt: iso(deps.clock.now()), summary: `already sampled ${day}, nothing to do` };
  }

  const options = await deps.catalogue.sampleListableOptions(sampleSize(env), day);
  if (options.length === 0) {
    return { job: "cart-sample", ok: false, startedAt, finishedAt: iso(deps.clock.now()), summary: "the catalogue copy is empty; no cart sampled" };
  }

  const counts = { matched: 0, price_mismatch: 0, unavailable: 0, error: 0 };
  let abandonFailures = 0;

  for (const option of options) {
    const sampledAt = iso(deps.clock.now());
    const outcome = await deps.carts.create([{ productId: option.productId, optionId: option.optionId, quantity: 1, expectedPriceMinor: option.retail }], "monitor");
    if (outcome.kind === "created") {
      const line = outcome.cart.items.find((item) => item.optionId === option.optionId);
      const cartRetail = line?.pricing?.retail ?? null;
      const matched = cartRetail === option.retail;
      counts[matched ? "matched" : "price_mismatch"]++;
      await insertRow(deps.db, {
        day,
        productId: option.productId,
        optionId: option.optionId,
        expectedMinor: option.retail,
        outcome: matched ? "matched" : "price_mismatch",
        cartRetailMinor: cartRetail,
        currentMinor: matched ? null : cartRetail,
        errorCode: null,
        requestId: outcome.meta.requestId,
        cartId: outcome.cart.id,
        sampledAt,
      });
      const abandoned = await deps.carts.abandon(outcome.cart.id);
      if (!abandoned.ok) {
        abandonFailures++;
        console.error(JSON.stringify({ at: "monitor.sample", problem: "abandon failed", cartId: outcome.cart.id, code: abandoned.error.code, requestId: abandoned.meta.requestId }));
      }
    } else if (outcome.kind === "price_changed") {
      counts.price_mismatch++;
      await insertRow(deps.db, {
        day,
        productId: option.productId,
        optionId: option.optionId,
        expectedMinor: option.retail,
        outcome: "price_mismatch",
        cartRetailMinor: null,
        currentMinor: outcome.currentPriceMinor,
        errorCode: null,
        requestId: outcome.meta.requestId,
        cartId: null,
        sampledAt,
      });
    } else if (outcome.kind === "unavailable") {
      counts.unavailable++;
      await insertRow(deps.db, {
        day,
        productId: option.productId,
        optionId: option.optionId,
        expectedMinor: option.retail,
        outcome: "unavailable",
        cartRetailMinor: null,
        currentMinor: null,
        errorCode: outcome.code,
        requestId: outcome.meta.requestId,
        cartId: null,
        sampledAt,
      });
      if (outcome.productId && outcome.optionId) {
        try {
          await deps.catalogue.markUnavailable(outcome.productId, outcome.optionId);
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause);
          console.error(JSON.stringify({ at: "monitor.sample", problem: "markUnavailable failed", productId: outcome.productId, optionId: outcome.optionId, message }));
        }
      }
    } else {
      counts.error++;
      await insertRow(deps.db, {
        day,
        productId: option.productId,
        optionId: option.optionId,
        expectedMinor: option.retail,
        outcome: "error",
        cartRetailMinor: null,
        currentMinor: null,
        errorCode: outcome.error.code,
        requestId: outcome.meta.requestId,
        cartId: null,
        sampledAt,
      });
    }
  }

  const abandonNote = abandonFailures > 0 ? `, ${abandonFailures} abandon(s) failed` : "";
  return {
    job: "cart-sample",
    ok: abandonFailures === 0,
    startedAt,
    finishedAt: iso(deps.clock.now()),
    summary: `sampled ${options.length}: ${counts.matched} matched, ${counts.price_mismatch} price mismatch, ${counts.unavailable} unavailable, ${counts.error} errors${abandonNote}`,
  };
};
