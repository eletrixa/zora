/**
 * The post-checkout return address registered with Groupon: /3pd/return?grouponOrderUuid=<uuid>.
 * Public by necessity (the shopper has no PIN). Guards: the id must be a UUID, new ids are
 * capped per hour, the status endpoint answers only for ids this page has already stored, and
 * the order is read from Groupon at most once per 3 seconds per order (60 seconds once it is
 * no longer pending) and at most 30 times a minute over all orders. In between, the last view
 * is served from D1. Without these a public page could make the Worker call Groupon on every
 * request (review loop 1).
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/return/routes.ts
 * Deps:    hono, src/lib/crypto.ts, src/lib/rate.ts, src/ui/pages/return.tsx
 * Tested:  test/app/return.test.ts
 */
import { Hono } from "hono";
import type { AppEnv } from "../contracts/env";
import type { Deps, OrderStatusResult } from "../contracts/ports";
import { iso } from "../lib/clock";
import { isUuid } from "../lib/crypto";
import { PRIVATE_HEADERS } from "../lib/http";
import { withinMinuteLimit } from "../lib/rate";
import { renderReturn } from "../ui/pages/return";

const MAX_NEW_ORDERS_PER_HOUR = 100;
const HOUR_MS = 3_600_000;
const PENDING_FRESH_MS = 3_000;
const SETTLED_FRESH_MS = 60_000;
const READS_PER_MINUTE = 30;

const page = async (body: string | Promise<string>, status: 200 | 400 | 429): Promise<Response> =>
  new Response(await body, { status, headers: { ...PRIVATE_HEADERS, "Content-Type": "text/html; charset=utf-8" } });

/** Stores the id once. Returns false when the hourly cap for new ids is reached. */
async function remember(deps: Deps, uuid: string): Promise<boolean> {
  const known = await deps.db.prepare("SELECT 1 AS hit FROM orders WHERE groupon_order_uuid = ?1").bind(uuid).first<{ hit: number }>();
  if (known) return true;
  const now = deps.clock.now();
  const recent = await deps.db
    .prepare("SELECT COUNT(*) AS n FROM orders WHERE source = 'return' AND first_seen_at >= ?1")
    .bind(iso(now - HOUR_MS))
    .first<{ n: number }>();
  if (Number(recent?.n ?? 0) >= MAX_NEW_ORDERS_PER_HOUR) return false;
  await deps.db
    .prepare("INSERT OR IGNORE INTO orders (groupon_order_uuid, source, first_seen_at) VALUES (?1, 'return', ?2)")
    .bind(uuid, iso(now))
    .run();
  return true;
}

/** Asks Groupon. Any failure, including a lane that is not built yet, is an error value. */
async function askGroupon(deps: Deps, uuid: string): Promise<OrderStatusResult> {
  try {
    return await deps.shopping.getOrderStatus(uuid);
  } catch (cause) {
    return { kind: "error", code: "UNAVAILABLE", message: cause instanceof Error ? cause.message : "order read failed" };
  }
}

function parseView(json: string | null): OrderStatusResult | null {
  if (!json) return null;
  try {
    const view = JSON.parse(json) as OrderStatusResult;
    return view.kind === "order" || view.kind === "not_found" ? view : null;
  } catch {
    console.error(JSON.stringify({ at: "return.parseView", problem: "stored order view is not JSON" }));
    return null;
  }
}

const WAITING: OrderStatusResult = { kind: "error", code: "WAIT", message: "the order was read a moment ago" };

/**
 * The order as the shopper should see it now: the stored view while it is fresh, else one
 * guarded read. `WAITING` means "nothing to show yet, ask again"; the pages treat it as pending.
 */
async function readOrder(deps: Deps, uuid: string): Promise<OrderStatusResult> {
  const now = deps.clock.now();
  const row = await deps.db.prepare("SELECT view_json, view_at FROM orders WHERE groupon_order_uuid = ?1").bind(uuid).first<{ view_json: string | null; view_at: number | null }>();
  const stored = parseView(row?.view_json ?? null);
  const settled = stored !== null && !(stored.kind === "order" && stored.pending);
  if (stored !== null && row?.view_at != null && now - row.view_at < (settled ? SETTLED_FRESH_MS : PENDING_FRESH_MS)) return stored;

  // Take the turn first: of several requests that arrive together, one reads and the rest wait.
  const turn = await deps.db
    .prepare("UPDATE orders SET view_at = ?2 WHERE groupon_order_uuid = ?1 AND (view_at IS NULL OR view_at <= ?3)")
    .bind(uuid, now, now - PENDING_FRESH_MS)
    .run();
  if (Number(turn.meta.changes ?? 0) !== 1) return stored ?? WAITING;
  if (!(await withinMinuteLimit(deps.db, "return-order-read", READS_PER_MINUTE, now))) return stored ?? WAITING;

  const fresh = await askGroupon(deps, uuid);
  if (fresh.kind === "error") return stored ?? fresh;
  await deps.db.prepare("UPDATE orders SET view_json = ?2, view_at = ?3 WHERE groupon_order_uuid = ?1").bind(uuid, JSON.stringify(fresh), now).run();
  return fresh;
}

export const returnRoutes = new Hono<AppEnv>();

returnRoutes.get("/3pd/return", async (c) => {
  const uuid = c.req.query("grouponOrderUuid");
  if (!isUuid(uuid)) return page(renderReturn({ uuid: null, order: null }), 400);
  const id = uuid.toLowerCase();
  if (!(await remember(c.var.deps, id))) return page(renderReturn({ uuid: id, order: null }), 429);
  const order = await readOrder(c.var.deps, id);
  // Right after the redirect Groupon may not know the order yet (guide, Reading the order): the
  // page waits and polls instead of telling the shopper that the order does not exist.
  return page(renderReturn({ uuid: id, order: order.kind === "order" ? order : null }), 200);
});

returnRoutes.get("/3pd/return/status", async (c) => {
  const uuid = c.req.query("grouponOrderUuid");
  if (!isUuid(uuid)) return c.json({ kind: "not_found" } satisfies OrderStatusResult, 400, PRIVATE_HEADERS);
  const id = uuid.toLowerCase();
  const known = await c.var.deps.db.prepare("SELECT 1 AS hit FROM orders WHERE groupon_order_uuid = ?1").bind(id).first<{ hit: number }>();
  if (!known) return c.json({ kind: "not_found" } satisfies OrderStatusResult, 404, PRIVATE_HEADERS);
  return c.json(await readOrder(c.var.deps, id), 200, PRIVATE_HEADERS);
});
