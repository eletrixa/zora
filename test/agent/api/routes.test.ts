/**
 * The agent API: each route's success, its status mapping, validation refusals, and that every
 * answer is private and calls the shopping service with channel "agent-api".
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/agent/api/routes.test.ts
 * Deps:    bun:test, src/app.ts, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { createApp } from "../../../src/app";
import type { CheckoutResult, DealCard, DealDetail, OrderStatusResult } from "../../../src/contracts/ports";
import { PROD, TEST_SECRETS, makeEnv, makeWorld } from "../../fakes/env";

function setup() {
  const world = makeWorld();
  const env = makeEnv({ DB: world.db.d1 });
  const app = createApp({ deps: world.deps });
  const headers = { authorization: `Bearer ${TEST_SECRETS.ZAL_AGENT_TOKEN}`, "content-type": "application/json" };
  const get = (path: string) => app.fetch(new Request(`${PROD}${path}`, { headers }), env);
  const post = (path: string, body: string) => app.fetch(new Request(`${PROD}${path}`, { method: "POST", headers, body }), env);
  return { world, get, post };
}

const CARD: DealCard = {
  productId: "p1",
  optionId: "o1",
  title: "Spa Day",
  optionTitle: "One massage",
  city: "Chicago",
  state: "IL",
  imageUrl: null,
  currency: "USD",
  precision: 2,
  listPriceMinor: 9900,
  payMinor: 4900,
  payText: "$49.00",
  promo: null,
};

const DEAL: DealDetail = {
  ...CARD,
  shortDescription: "short",
  description: "long",
  categoryLabels: ["Spa"],
  options: [],
  locations: [],
};

describe("GET /api/v1", () => {
  it("describes the routes and the price rule", async () => {
    const { get } = setup();
    const response = await get("/api/v1");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { routes: unknown[]; priceRule: string };
    expect(body.routes.length).toBe(4);
    expect(body.priceRule).toContain("payMinor");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});

describe("GET /api/v1/search", () => {
  it("answers deals and count, and calls the shopping service with channel agent-api", async () => {
    const { world, get } = setup();
    world.shopping.cards = [CARD];
    const response = await get("/api/v1/search?q=spa");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deals: [CARD], count: 1 });
    expect(world.shopping.calls[0]?.method).toBe("searchDeals");
    expect(world.shopping.calls[0]?.args[1]).toBe("agent-api");
  });

  it("converts maxPrice dollars into a minor-unit query", async () => {
    const { world, get } = setup();
    await get("/api/v1/search?maxPrice=49.50");
    const query = world.shopping.calls[0]?.args[0] as { maxPriceMinor?: number };
    expect(query.maxPriceMinor).toBe(4950);
  });

  it("refuses with 400 missing_criteria when no criteria are given", async () => {
    const { get } = setup();
    const response = await get("/api/v1/search");
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("missing_criteria");
  });

  it("marks the answer private", async () => {
    const { get } = setup();
    const response = await get("/api/v1/search?q=spa");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });
});

describe("GET /api/v1/deals/:productId", () => {
  it("answers the deal detail", async () => {
    const { world, get } = setup();
    world.shopping.deal = DEAL;
    const response = await get("/api/v1/deals/p1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(DEAL);
    expect(world.shopping.calls[0]).toEqual({ method: "getDeal", args: ["p1"] });
  });

  it("answers 404 not_found when the service has no deal", async () => {
    const { world, get } = setup();
    world.shopping.deal = null;
    const response = await get("/api/v1/deals/missing");
    expect(response.status).toBe(404);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("not_found");
  });
});

describe("POST /api/v1/checkout", () => {
  const body = JSON.stringify({ items: [{ productId: "p1", optionId: "o1", quantity: 1 }] });

  const checkoutCases: readonly { readonly result: CheckoutResult; readonly status: number }[] = [
    {
      result: {
        kind: "link",
        cartId: "c1",
        buyLink: "https://partner.groupon.com/checkout/c1",
        currency: "USD",
        precision: 2,
        totalMinor: 4900,
        totalText: "$49.00",
        lines: [],
        expiresAt: null,
      },
      status: 200,
    },
    { result: { kind: "price_changed", productId: "p1", optionId: "o1", wasMinor: 4900, nowMinor: 5900, nowText: "$59.00" }, status: 409 },
    { result: { kind: "unavailable", reason: "sold out" }, status: 409 },
    { result: { kind: "not_found", productId: "p1", optionId: "o1" }, status: 404 },
    { result: { kind: "error", code: "INTERNAL_SERVER_ERROR", message: "partner API failed" }, status: 502 },
  ];

  for (const { result, status } of checkoutCases) {
    it(`answers ${status} for a "${result.kind}" outcome, body is the CheckoutResult`, async () => {
      const { world, post } = setup();
      world.shopping.checkout = result;
      const response = await post("/api/v1/checkout", body);
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual(result);
      expect(world.shopping.calls[0]?.args[1]).toBe("agent-api");
    });
  }

  it("refuses more than 20 items", async () => {
    const { post } = setup();
    const items = Array.from({ length: 21 }, (_, i) => ({ productId: `p${i}`, optionId: "o1", quantity: 1 }));
    const response = await post("/api/v1/checkout", JSON.stringify({ items }));
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("invalid_items");
  });

  it("refuses a quantity outside 1..100", async () => {
    const { post } = setup();
    const response = await post("/api/v1/checkout", JSON.stringify({ items: [{ productId: "p1", optionId: "o1", quantity: 0 }] }));
    expect(response.status).toBe(400);
  });

  it("refuses a body over 16 KB", async () => {
    const { post } = setup();
    const huge = JSON.stringify({ items: [{ productId: "p1", optionId: "o1", quantity: 1, filler: "x".repeat(20_000) }] });
    const response = await post("/api/v1/checkout", huge);
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("bad_json");
  });

  it("refuses broken JSON with bad_json", async () => {
    const { post } = setup();
    const response = await post("/api/v1/checkout", "{not json");
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("bad_json");
  });
});

describe("GET /api/v1/orders/:uuid", () => {
  const UUID = "550e8400-e29b-41d4-a716-446655440000";

  const orderCases: readonly { readonly result: OrderStatusResult; readonly status: number }[] = [
    { result: { kind: "order", uuid: UUID, status: "fulfilled", pending: false, lines: [] }, status: 200 },
    { result: { kind: "not_found" }, status: 404 },
    { result: { kind: "error", code: "INTERNAL_SERVER_ERROR", message: "partner API failed" }, status: 502 },
  ];

  for (const { result, status } of orderCases) {
    it(`answers ${status} for a "${result.kind}" outcome, body is the OrderStatusResult`, async () => {
      const { world, get } = setup();
      world.shopping.order = result;
      const response = await get(`/api/v1/orders/${UUID}`);
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual(result);
      expect(world.shopping.calls[0]).toEqual({ method: "getOrderStatus", args: [UUID] });
    });
  }

  it("refuses a non-UUID with 400 bad_uuid, without calling the service", async () => {
    const { world, get } = setup();
    const response = await get("/api/v1/orders/not-a-uuid");
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("bad_uuid");
    expect(world.shopping.calls.length).toBe(0);
  });
});
