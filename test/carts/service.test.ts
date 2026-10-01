/**
 * createCartService: refusals, outcome mapping, the carts_log row, the unavailable-line
 * abandon, and abandon's idempotence against a real (sqlite-backed) D1.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/carts/service.test.ts
 * Deps:    bun:test, src/carts/index.ts, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it, spyOn } from "bun:test";
import { createCartService } from "../../src/carts";
import type { CartLineRequest } from "../../src/contracts/ports";
import { FakeClock } from "../fakes/clock";
import { createTestDb } from "../fakes/d1";
import { FakePartnerClient } from "../fakes/partner";

function line(over: Partial<CartLineRequest> = {}): CartLineRequest {
  return { productId: "p-pizza-chi", optionId: "o-pizza-chi", quantity: 1, expectedPriceMinor: 2900, ...over };
}

function setup() {
  const clock = new FakeClock();
  const partner = new FakePartnerClient(clock);
  const db = createTestDb();
  const carts = createCartService(partner, db.d1, clock);
  return { clock, partner, db, carts };
}

describe("create: refusals (nothing is sent)", () => {
  it("refuses zero lines", async () => {
    const { carts, partner } = setup();
    const outcome = await carts.create([], "web");
    expect(outcome.kind).toBe("error");
    expect(outcome.kind === "error" && outcome.error.code).toBe("BAD_REQUEST");
    expect(outcome.kind === "error" && outcome.meta.httpStatus).toBeNull();
    expect(partner.calls).toHaveLength(0);
  });

  it("refuses more than 20 lines", async () => {
    const { carts, partner } = setup();
    const lines = Array.from({ length: 21 }, (_, i) => line({ optionId: `o-${i}` }));
    const outcome = await carts.create(lines, "web");
    expect(outcome.kind === "error" && outcome.error.code).toBe("BAD_REQUEST");
    expect(partner.calls).toHaveLength(0);
  });

  it("refuses a quantity outside 1..100", async () => {
    const { carts, partner } = setup();
    const outcome = await carts.create([line({ quantity: 0 })], "web");
    expect(outcome.kind === "error" && outcome.error.code).toBe("BAD_REQUEST");
    expect(partner.calls).toHaveLength(0);
    const outcome2 = await carts.create([line({ quantity: 101 })], "web");
    expect(outcome2.kind === "error" && outcome2.error.code).toBe("BAD_REQUEST");
  });

  it("refuses a non-integer or negative expectedPriceMinor", async () => {
    const { carts, partner } = setup();
    const outcome = await carts.create([line({ expectedPriceMinor: 29.5 })], "web");
    expect(outcome.kind === "error" && outcome.error.code).toBe("BAD_REQUEST");
    const outcome2 = await carts.create([line({ expectedPriceMinor: -1 })], "web");
    expect(outcome2.kind === "error" && outcome2.error.code).toBe("BAD_REQUEST");
    expect(partner.calls).toHaveLength(0);
  });

  it("refuses two lines naming the same option", async () => {
    const { carts, partner } = setup();
    const outcome = await carts.create([line(), line({ quantity: 2 })], "web");
    expect(outcome.kind === "error" && outcome.error.code).toBe("BAD_REQUEST");
    expect(partner.calls).toHaveLength(0);
  });
});

describe("create: outcomes", () => {
  it("answers created and logs an open carts_log row", async () => {
    const { carts, db, clock } = setup();
    const outcome = await carts.create([line()], "agent-api");
    expect(outcome.kind).toBe("created");
    if (outcome.kind !== "created") throw new Error("expected created");
    expect(outcome.cart.items).toHaveLength(1);
    const row = db.sqlite.query("SELECT * FROM carts_log WHERE cart_id = ?").get(outcome.cart.id) as Record<string, unknown>;
    expect(row.source).toBe("agent-api");
    expect(row.status).toBe("open");
    expect(row.line_count).toBe(1);
    expect(row.total_minor).toBe(outcome.cart.totals.grandTotal);
    expect(row.created_at).toBe(new Date(clock.now()).toISOString());
  });

  it("answers price_changed naming the first line on several", async () => {
    const { carts } = setup();
    const outcome = await carts.create([line({ expectedPriceMinor: 1 }), line({ productId: "p-bowling-chi", optionId: "o-bowling-chi", expectedPriceMinor: 1 })], "web");
    expect(outcome.kind).toBe("price_changed");
    if (outcome.kind !== "price_changed") throw new Error("expected price_changed");
    expect(outcome.productId).toBe("p-pizza-chi");
    expect(outcome.optionId).toBe("o-pizza-chi");
    expect(outcome.currentPriceMinor).toBe(2900);
  });

  it("answers unavailable for a product that needs a date, naming the one line", async () => {
    const { carts } = setup();
    const outcome = await carts.create([line({ productId: "p-kayak-chi", optionId: "o-kayak-chi", expectedPriceMinor: 4200 })], "web");
    expect(outcome.kind).toBe("unavailable");
    if (outcome.kind !== "unavailable") throw new Error("expected unavailable");
    expect(outcome.code).toBe("PRODUCT_NOT_CARTABLE");
    expect(outcome.productId).toBe("p-kayak-chi");
    expect(outcome.optionId).toBe("o-kayak-chi");
  });

  it("leaves the ids out of an unavailable outcome when the request had several lines", async () => {
    const { carts } = setup();
    const outcome = await carts.create(
      [line({ productId: "p-kayak-chi", optionId: "o-kayak-chi", expectedPriceMinor: 4200 }), line({ productId: "p-bowling-chi", optionId: "o-bowling-chi", expectedPriceMinor: 3900 })],
      "web",
    );
    expect(outcome.kind).toBe("unavailable");
    if (outcome.kind !== "unavailable") throw new Error("expected unavailable");
    expect(outcome.productId).toBeUndefined();
    expect(outcome.optionId).toBeUndefined();
  });

  it("answers error for an unmapped failure", async () => {
    const { carts, partner } = setup();
    partner.failNext("carts.create", { code: "INTERNAL_SERVER_ERROR", message: "boom", retryable: true, shape: "flat" });
    const outcome = await carts.create([line()], "web");
    expect(outcome.kind).toBe("error");
    if (outcome.kind !== "error") throw new Error("expected error");
    expect(outcome.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});

describe("create: unavailable line abandons the cart", () => {
  it("abandons a cart created with a sold-out option and reports it unavailable, naming the line", async () => {
    const { carts, partner, db } = setup();
    const outcome = await carts.create([{ productId: "p-soldout-chi", optionId: "o-soldout-chi", quantity: 1, expectedPriceMinor: 6500 }], "web");
    expect(outcome.kind).toBe("unavailable");
    if (outcome.kind !== "unavailable") throw new Error("expected unavailable");
    expect(outcome.code).toBe("SOLD_OUT");
    expect(outcome.productId).toBe("p-soldout-chi");
    expect(outcome.optionId).toBe("o-soldout-chi");
    expect(partner.callsTo("carts.abandon")).toHaveLength(1);
    const row = db.sqlite.query("SELECT status FROM carts_log").get() as Record<string, unknown>;
    expect(row.status).toBe("abandoned");
  });

  it("logs and leaves the row open when the follow-up abandon fails, but still answers unavailable", async () => {
    const { carts, partner, db } = setup();
    const spy = spyOn(console, "error").mockImplementation(() => {});
    try {
      partner.failNext("carts.abandon", { code: "INTERNAL_SERVER_ERROR", message: "boom", retryable: true, shape: "flat" });
      const outcome = await carts.create([{ productId: "p-soldout-chi", optionId: "o-soldout-chi", quantity: 1, expectedPriceMinor: 6500 }], "web");
      expect(outcome.kind).toBe("unavailable");
      if (outcome.kind !== "unavailable") throw new Error("expected unavailable");
      expect(outcome.code).toBe("SOLD_OUT");
      expect(spy).toHaveBeenCalledTimes(1);
      const logged = JSON.parse(spy.mock.calls[0]?.[0] as string) as Record<string, unknown>;
      expect(logged.at).toBe("carts.create");
      expect(logged.problem).toBe("abandon failed");
      expect(logged.code).toBe("INTERNAL_SERVER_ERROR");
      expect(typeof logged.cartId).toBe("string");
      expect(typeof logged.requestId).toBe("string");
      const row = db.sqlite.query("SELECT status FROM carts_log").get() as Record<string, unknown>;
      expect(row.status).toBe("open");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("abandon", () => {
  it("marks the row abandoned", async () => {
    const { carts, db } = setup();
    const created = await carts.create([line()], "web");
    if (created.kind !== "created") throw new Error("expected created");
    const result = await carts.abandon(created.cart.id);
    expect(result.ok).toBe(true);
    const row = db.sqlite.query("SELECT status, closed_at FROM carts_log WHERE cart_id = ?").get(created.cart.id) as Record<string, unknown>;
    expect(row.status).toBe("abandoned");
    expect(row.closed_at).not.toBeNull();
  });

  it("is safe to call twice", async () => {
    const { carts } = setup();
    const created = await carts.create([line()], "web");
    if (created.kind !== "created") throw new Error("expected created");
    const first = await carts.abandon(created.cart.id);
    const second = await carts.abandon(created.cart.id);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
  });

  it("marks a logged row expired when the API says INVALID_CART_ID, and returns ok", async () => {
    const { carts, db } = setup();
    // A row whose cart the fake partner never created, standing in for a cart already gone at the API.
    db.sqlite.run("INSERT INTO carts_log (cart_id, source, status, created_at, line_count, total_minor) VALUES ('cart-ghost', 'web', 'open', '2026-10-01T00:00:00.000Z', 1, 100)");
    const result = await carts.abandon("cart-ghost");
    expect(result.ok).toBe(true);
    const row = db.sqlite.query("SELECT status FROM carts_log WHERE cart_id = 'cart-ghost'").get() as Record<string, unknown>;
    expect(row.status).toBe("expired");
  });

  it("still abandons at the API a cart we never logged", async () => {
    const { carts, partner, db } = setup();
    const cart = await partner.createCart([{ productId: "p-pizza-chi", optionId: "o-pizza-chi", quantity: 1 }]);
    if (!cart.ok) throw new Error("fixture cart failed");
    const result = await carts.abandon(cart.value.id);
    expect(result.ok).toBe(true);
    expect(partner.callsTo("carts.abandon")).toHaveLength(1);
    const row = db.sqlite.query("SELECT * FROM carts_log WHERE cart_id = ?").get(cart.value.id);
    expect(row).toBeNull();
  });
});

describe("listOpen", () => {
  it("returns open rows older than the cutoff, oldest first", async () => {
    const { carts, clock } = setup();
    const first = await carts.create([line()], "web");
    clock.advance(1_000);
    const second = await carts.create([line({ productId: "p-bowling-chi", optionId: "o-bowling-chi", expectedPriceMinor: 3900 })], "probe");
    clock.advance(10 * 60_000);
    const rows = await carts.listOpen(5 * 60_000);
    if (first.kind !== "created" || second.kind !== "created") throw new Error("expected created");
    expect(rows.map((r) => r.cartId)).toEqual([first.cart.id, second.cart.id]);
  });

  it("excludes rows created after the cutoff", async () => {
    const { carts, clock } = setup();
    await carts.create([line()], "web");
    const rows = await carts.listOpen(60_000);
    expect(rows).toHaveLength(0);
    void clock;
  });
});
