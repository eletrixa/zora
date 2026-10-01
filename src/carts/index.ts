/**
 * Creates, logs, abandons and sweeps carts against the Partner Storefront cart API.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/carts/index.ts
 * Deps:    src/contracts, src/lib/clock.ts, src/lib/crypto.ts
 * Tested:  test/carts/service.test.ts, test/carts/sweep.test.ts
 */
import type { OctoCart } from "../contracts/partner";
import type { CallMeta, CartLineRequest, CartOutcome, CartService, CartSource, Clock, Job, PartnerClient, Result } from "../contracts/ports";
import { iso } from "../lib/clock";
import { newId } from "../lib/crypto";

const localMeta = (): CallMeta => ({ endpoint: "carts.create", requestId: newId(), httpStatus: null, latencyMs: 0, attempts: 0 });

/** A refusal caught before any API call: no request was sent, so httpStatus is null. */
function refuse(lines: readonly CartLineRequest[]): CartOutcome | null {
  const fail = (message: string): CartOutcome => ({
    kind: "error",
    error: { code: "BAD_REQUEST", message, retryable: false, shape: "none" },
    meta: localMeta(),
  });
  if (lines.length === 0 || lines.length > 20) return fail("a cart holds 1 to 20 lines");
  const seenOptions = new Set<string>();
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 100) return fail("quantity must be 1..100");
    if (!Number.isInteger(line.expectedPriceMinor) || line.expectedPriceMinor < 0) return fail("expectedPriceMinor must be a non-negative integer");
    const key = `${line.productId}/${line.optionId}`;
    if (seenOptions.has(key)) return fail("two lines name the same option");
    seenOptions.add(key);
  }
  return null;
}

export function createCartService(partner: PartnerClient, db: D1Database, clock: Clock): CartService {
  async function logOpen(cart: OctoCart, source: CartSource, requestId: string): Promise<void> {
    await db
      .prepare("INSERT INTO carts_log (cart_id, source, status, created_at, line_count, total_minor, request_id) VALUES (?1, ?2, 'open', ?3, ?4, ?5, ?6)")
      .bind(cart.id, source, iso(clock.now()), cart.items.length, cart.totals.grandTotal, requestId)
      .run();
  }

  async function markClosed(cartId: string, status: "abandoned" | "expired"): Promise<void> {
    await db.prepare("UPDATE carts_log SET status = ?1, closed_at = ?2 WHERE cart_id = ?3").bind(status, iso(clock.now()), cartId).run();
  }

  async function abandonNow(cartId: string): Promise<Result<null>> {
    const result = await partner.abandonCart(cartId);
    if (result.ok) {
      await markClosed(cartId, "abandoned");
      return result;
    }
    // The cart is already gone at the API, which is what abandon wanted. Say so, and close our row.
    if (result.error.code === "INVALID_CART_ID") {
      await markClosed(cartId, "expired");
      return { ok: true, value: null, meta: result.meta };
    }
    return result;
  }

  return {
    async create(lines, source) {
      const refusal = refuse(lines);
      if (refusal) return refusal;

      const result = await partner.createCart(
        lines.map((line) => ({ productId: line.productId, optionId: line.optionId, quantity: line.quantity, expectedPrice: line.expectedPriceMinor })),
      );
      if (!result.ok) {
        const { error, meta } = result;
        // Several lines can mismatch; the API reports one price. Name the first line, as documented.
        if (error.code === "PRICE_MISMATCH" && error.currentPrice !== undefined) {
          const first = lines[0]!;
          return {
            kind: "price_changed",
            productId: first.productId,
            optionId: first.optionId,
            expectedPriceMinor: first.expectedPriceMinor,
            currentPriceMinor: error.currentPrice,
            meta,
          };
        }
        if (error.code === "PRODUCT_NOT_CARTABLE" || error.code === "INVALID_PRODUCT_ID" || error.code === "UNPROCESSABLE_ENTITY") {
          // The failed call named no line; a one-line request has only one candidate to blame.
          const only = lines.length === 1 ? lines[0] : undefined;
          return { kind: "unavailable", code: error.code, message: error.message, meta, productId: only?.productId, optionId: only?.optionId };
        }
        return { kind: "error", error, meta };
      }

      const cart = result.value;
      await logOpen(cart, source, result.meta.requestId);
      const unavailableLine = cart.items.find((item) => !item.available);
      if (unavailableLine) {
        const abandonResult = await abandonNow(cart.id);
        if (!abandonResult.ok) {
          console.error(
            JSON.stringify({ at: "carts.create", problem: "abandon failed", cartId: cart.id, code: abandonResult.error.code, requestId: abandonResult.meta.requestId }),
          );
        }
        const reason = unavailableLine.unavailableReason ?? "UNAVAILABLE";
        return {
          kind: "unavailable",
          code: reason,
          message: `${unavailableLine.optionTitle ?? unavailableLine.optionId} is ${reason.toLowerCase().replace(/_/g, " ")}`,
          meta: result.meta,
          productId: unavailableLine.productId,
          optionId: unavailableLine.optionId,
        };
      }
      return { kind: "created", cart, meta: result.meta };
    },

    async abandon(cartId) {
      return abandonNow(cartId);
    },

    async listOpen(olderThanMs) {
      const cutoff = iso(clock.now() - olderThanMs);
      const rows = await db
        .prepare("SELECT cart_id, source, created_at FROM carts_log WHERE status = 'open' AND created_at < ?1 ORDER BY created_at ASC")
        .bind(cutoff)
        .all<{ cart_id: string; source: CartSource; created_at: string }>();
      return rows.results.map((row) => ({ cartId: row.cart_id, source: row.source, createdAt: row.created_at }));
    },
  };
}

export const SWEEP_AFTER_MS: Readonly<Record<CartSource, number>> = {
  probe: 3_600_000,
  monitor: 3_600_000,
  "agent-api": 86_400_000,
  "agent-mcp": 86_400_000,
  web: 86_400_000,
};

const SWEEP_CAP = 30;

/** Abandons open carts: probe and monitor carts older than 1 hour, agent and web carts older than 24 hours. */
const MAX_NAMED_FAILURES = 5;

export const runCartSweep: Job = async (deps) => {
  const startedAt = iso(deps.clock.now());
  let abandoned = 0;
  const failedIds: string[] = [];
  sources: for (const source of Object.keys(SWEEP_AFTER_MS) as CartSource[]) {
    const candidates = (await deps.carts.listOpen(SWEEP_AFTER_MS[source])).filter((cart) => cart.source === source);
    for (const cart of candidates) {
      if (abandoned + failedIds.length >= SWEEP_CAP) break sources;
      const result = await deps.carts.abandon(cart.cartId);
      if (result.ok) {
        abandoned++;
      } else {
        failedIds.push(cart.cartId);
        console.error(JSON.stringify({ at: "carts.sweep", problem: "abandon failed", cartId: cart.cartId, source, code: result.error.code, requestId: result.meta.requestId }));
      }
    }
  }
  const named = failedIds.length > 0 ? ` (${failedIds.slice(0, MAX_NAMED_FAILURES).join(", ")})` : "";
  return {
    job: "cart-sweep",
    ok: failedIds.length === 0,
    startedAt,
    finishedAt: iso(deps.clock.now()),
    summary: `abandoned ${abandoned} cart(s), ${failedIds.length} failed${named}`,
  };
};
