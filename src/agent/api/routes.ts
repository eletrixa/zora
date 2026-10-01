/**
 * HTTP API for agents, mounted at /api/v1 behind the agent token (the gate lives in src/app.ts).
 * No business logic here: the shopping service decides, this file only translates.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/agent/api/routes.ts
 * Deps:    hono, src/contracts, src/lib/http.ts, src/lib/crypto.ts
 * Tested:  test/agent/api/routes.test.ts
 */
import { Hono } from "hono";
import type { AppEnv } from "../../contracts/env";
import type { CartSource, CheckoutResult, OrderStatusResult } from "../../contracts/ports";
import { isUuid } from "../../lib/crypto";
import { errorJson, PRIVATE_HEADERS } from "../../lib/http";
import { parseCheckoutBody } from "./checkout-body";
import { parseSearchQuery } from "./query";

const CHANNEL: CartSource = "agent-api";

const CHECKOUT_STATUS: Readonly<Record<CheckoutResult["kind"], 200 | 404 | 409 | 502>> = {
  link: 200,
  price_changed: 409,
  unavailable: 409,
  not_found: 404,
  error: 502,
};

const ORDER_STATUS: Readonly<Record<OrderStatusResult["kind"], 200 | 404 | 502>> = {
  order: 200,
  not_found: 404,
  error: 502,
};

const API_DESCRIPTION = {
  name: "Zora Agent Lab shopping API",
  priceRule:
    "Pay `payMinor` / `payText`. A promo price is reported separately in `promo` and only applies when its code is typed at Groupon checkout; it is never the price to pay.",
  routes: [
    {
      method: "GET",
      path: "/api/v1/search",
      query: { q: "text", state: "string", city: "string", category: "string", maxPrice: "dollars", limit: "1-50, default 10" },
      note: "at least one of q, state, city, category, maxPrice is required",
      answers: "200 { deals: DealCard[], count } | 400 missing_criteria",
    },
    {
      method: "GET",
      path: "/api/v1/deals/:productId",
      answers: "200 DealDetail | 404 not_found",
    },
    {
      method: "POST",
      path: "/api/v1/checkout",
      body: "{ items: [{ productId, optionId, quantity }] } (1-20 items, quantity 1-100)",
      answers: "200 link | 409 price_changed | 409 unavailable | 404 not_found | 502 error, body is always the CheckoutResult",
    },
    {
      method: "GET",
      path: "/api/v1/orders/:uuid",
      answers: "200 order | 400 bad_uuid | 404 not_found | 502 error, body is always the OrderStatusResult",
    },
  ],
} as const;

export const agentApi = new Hono<AppEnv>();

agentApi.get("/", (c) => c.json(API_DESCRIPTION, 200, PRIVATE_HEADERS));

agentApi.get("/search", async (c) => {
  const parsed = parseSearchQuery(c.req.query());
  if (!parsed.ok) return errorJson(c, 400, parsed.error.code, parsed.error.message);
  const deals = await c.var.deps.shopping.searchDeals(parsed.query, CHANNEL);
  return c.json({ deals, count: deals.length }, 200, PRIVATE_HEADERS);
});

agentApi.get("/deals/:productId", async (c) => {
  const deal = await c.var.deps.shopping.getDeal(c.req.param("productId"));
  if (!deal) return errorJson(c, 404, "not_found", "no deal with that product id");
  return c.json(deal, 200, PRIVATE_HEADERS);
});

agentApi.post("/checkout", async (c) => {
  const parsed = await parseCheckoutBody(c.req.raw);
  if (!parsed.ok) return errorJson(c, 400, parsed.error.code, parsed.error.message);
  const result = await c.var.deps.shopping.createCheckoutLink(parsed.items, CHANNEL);
  return c.json(result, CHECKOUT_STATUS[result.kind], PRIVATE_HEADERS);
});

agentApi.get("/orders/:uuid", async (c) => {
  const uuid = c.req.param("uuid");
  if (!isUuid(uuid)) return errorJson(c, 400, "bad_uuid", "the order id must be a UUID");
  const result = await c.var.deps.shopping.getOrderStatus(uuid);
  return c.json(result, ORDER_STATUS[result.kind], PRIVATE_HEADERS);
});
