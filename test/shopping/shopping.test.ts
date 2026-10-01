/**
 * The shopping service: search cards, deal detail, checkout link, order status, one
 * agent_requests row per call.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/shopping/shopping.test.ts
 * Deps:    src/shopping, test/fakes
 * Tested:  n/a (this is the test file)
 */
import { describe, expect, it, spyOn } from "bun:test";
import { createShoppingService } from "../../src/shopping";
import type { ShoppingService } from "../../src/contracts/ports";
import { formatMoney } from "../../src/lib/money";
import { makeWorld } from "../fakes/env";
import { cardOf } from "../fakes/services";
import { makeProduct } from "../fakes/fixtures";

function build(world: ReturnType<typeof makeWorld>): ShoppingService {
  return createShoppingService({
    search: world.search,
    catalogue: world.catalogue,
    carts: world.carts,
    partner: world.partner,
    db: world.db.d1,
    clock: world.clock,
  });
}

async function agentRequestRows(world: ReturnType<typeof makeWorld>): Promise<Record<string, unknown>[]> {
  const result = await world.db.d1.prepare("SELECT * FROM agent_requests ORDER BY id").all();
  return result.results as Record<string, unknown>[];
}

/** Desyncs the catalogue from the live partner data: marks a product listable and sellable in
 *  the catalogue while its underlying (availability-required) partner product still refuses a
 *  cart line, so createCheckoutLink's own pre-check passes but carts.create still declines it. */
function forceListable(world: ReturnType<typeof makeWorld>, productId: string): void {
  const product = world.catalogue.products.get(productId);
  if (!product) throw new Error(`fixture ${productId} is missing from the catalogue`);
  world.catalogue.products.set(productId, { ...product, listable: true, options: product.options.map((option) => ({ ...option, active: true })) });
}

describe("searchDeals", () => {
  it("answers a card equal to cardOf for every fixture hit, in the same order", async () => {
    const world = makeWorld();
    const service = build(world);
    const hits = await world.search.search({ text: "" });
    const cards = await service.searchDeals({ text: "" }, "agent-api");
    expect(cards.length).toBe(hits.length);
    expect(cards).toEqual(hits.map((hit) => cardOf(hit)));
  });

  it("logs one agent_requests row with outcome ok and the result count", async () => {
    const world = makeWorld();
    const service = build(world);
    await service.searchDeals({ text: "massage" }, "agent-api");
    const rows = await agentRequestRows(world);
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({ channel: "agent-api", tool: "search_deals", query_text: "massage", outcome: "ok" });
    expect(rows[0]?.result_count).toBeGreaterThan(0);
  });

  it("logs outcome empty when nothing matches", async () => {
    const world = makeWorld();
    const service = build(world);
    await service.searchDeals({ text: "no-such-thing-anywhere" }, "web");
    const rows = await agentRequestRows(world);
    expect(rows[0]).toMatchObject({ tool: "search_deals", outcome: "empty", result_count: 0 });
  });
});

describe("getDeal", () => {
  it("answers null for an unknown product and logs not_found", async () => {
    const world = makeWorld();
    const service = build(world);
    const deal = await service.getDeal("no-such-product");
    expect(deal).toBeNull();
    const rows = await agentRequestRows(world);
    expect(rows[0]).toMatchObject({ tool: "get_deal", query_text: "no-such-product", outcome: "not_found" });
  });

  it("answers null for a product that is not listable (availability required)", async () => {
    const world = makeWorld();
    const service = build(world);
    const deal = await service.getDeal("p-kayak-chi");
    expect(deal).toBeNull();
  });

  it("gives the with-code promo instruction sentence", async () => {
    const world = makeWorld();
    const service = build(world);
    const deal = await service.getDeal("p-massage-chi");
    expect(deal?.promo?.instruction).toBe("Type code SAVE20 at Groupon checkout to pay $39.20. Without it you pay $49.00.");
  });

  it("gives the without-code promo instruction sentence", async () => {
    const world = makeWorld();
    const service = build(world);
    const deal = await service.getDeal("p-yoga-austin");
    expect(deal?.promo?.instruction).toBe("Groupon may offer $36.00 at checkout. Expect to pay $45.00.");
  });

  it("carries no promo when the option has none", async () => {
    const world = makeWorld();
    const service = build(world);
    const deal = await service.getDeal("p-massage-nyc");
    expect(deal?.promo).toBeNull();
  });

  it("never sets a promo whose amount is not lower than retail", async () => {
    const world = makeWorld();
    const service = build(world);
    const bogus = makeProduct({
      id: "p-bogus-promo",
      title: "Bogus Promo Deal",
      short: "A deal whose promo is not actually cheaper.",
      categories: ["Test"],
      places: [["Test Place", "Chicago", "IL", "60601"]],
      options: [{ id: "o-bogus-promo", title: "Standard", original: 8000, retail: 4900, promo: { amount: 6000, code: "NOPE", endDate: null }, isDefault: true }],
    });
    await world.catalogue.upsertProducts([bogus], "run-bogus", new Date(world.clock.now()).toISOString());
    const deal = await service.getDeal("p-bogus-promo");
    expect(deal?.promo).toBeNull();
  });

  it("describes the cheapest sellable option and lists every option with its sellable flag", async () => {
    const world = makeWorld();
    const service = build(world);
    const deal = await service.getDeal("p-laser-chi");
    expect(deal?.optionId).toBe("o-laser-chi-small");
    expect(deal?.payMinor).toBe(9900);
    expect(deal?.options).toHaveLength(2);
    const inactive = deal?.options.find((option) => option.optionId === "o-laser-chi-old");
    expect(inactive?.sellable).toBe(false);
  });
});

describe("createCheckoutLink", () => {
  it("rejects zero items as BAD_REQUEST without touching the partner", async () => {
    const world = makeWorld();
    const service = build(world);
    const result = await service.createCheckoutLink([], "agent-api");
    expect(result).toMatchObject({ kind: "error", code: "BAD_REQUEST" });
    expect(world.partner.callsTo("carts.create")).toHaveLength(0);
  });

  it("rejects more than 20 items as BAD_REQUEST", async () => {
    const world = makeWorld();
    const service = build(world);
    const items = Array.from({ length: 21 }, () => ({ productId: "p-massage-chi", optionId: "o-massage-chi-60", quantity: 1 }));
    const result = await service.createCheckoutLink(items, "agent-api");
    expect(result).toMatchObject({ kind: "error", code: "BAD_REQUEST" });
  });

  it("rejects a quantity outside 1..100 as BAD_REQUEST", async () => {
    const world = makeWorld();
    const service = build(world);
    const result = await service.createCheckoutLink([{ productId: "p-massage-chi", optionId: "o-massage-chi-60", quantity: 0 }], "agent-api");
    expect(result).toMatchObject({ kind: "error", code: "BAD_REQUEST" });
  });

  it("answers not_found for an unknown option", async () => {
    const world = makeWorld();
    const service = build(world);
    const result = await service.createCheckoutLink([{ productId: "p-massage-chi", optionId: "no-such-option", quantity: 1 }], "agent-api");
    expect(result).toEqual({ kind: "not_found", productId: "p-massage-chi", optionId: "no-such-option" });
  });

  it("answers unavailable for a bookable (availability-required) product", async () => {
    const world = makeWorld();
    const service = build(world);
    const result = await service.createCheckoutLink([{ productId: "p-kayak-chi", optionId: "o-kayak-chi", quantity: 1 }], "agent-api");
    expect(result.kind).toBe("unavailable");
  });

  it("answers unavailable for an inactive option", async () => {
    const world = makeWorld();
    const service = build(world);
    const result = await service.createCheckoutLink([{ productId: "p-carwash-chi", optionId: "o-carwash-chi", quantity: 1 }], "agent-api");
    expect(result.kind).toBe("unavailable");
  });

  it("marks a refused option unavailable in the catalogue after the partner declines it", async () => {
    const world = makeWorld();
    const service = build(world);
    forceListable(world, "p-kayak-chi");
    const result = await service.createCheckoutLink([{ productId: "p-kayak-chi", optionId: "o-kayak-chi", quantity: 1 }], "agent-api");
    expect(result.kind).toBe("unavailable");
    const option = await world.catalogue.getOption("p-kayak-chi", "o-kayak-chi");
    expect(option?.active).toBe(false);
    const deal = await service.getDeal("p-kayak-chi");
    expect(deal).toBeNull();
  });

  it("marks nothing when the unavailable outcome carries no ids", async () => {
    const world = makeWorld();
    const service = build(world);
    forceListable(world, "p-kayak-chi");
    let markCalls = 0;
    const original = world.catalogue.markUnavailable.bind(world.catalogue);
    world.catalogue.markUnavailable = async (productId: string, optionId: string) => {
      markCalls++;
      return original(productId, optionId);
    };
    const result = await service.createCheckoutLink(
      [
        { productId: "p-massage-chi", optionId: "o-massage-chi-60", quantity: 1 },
        { productId: "p-kayak-chi", optionId: "o-kayak-chi", quantity: 1 },
      ],
      "agent-api",
    );
    expect(result.kind).toBe("unavailable");
    expect(markCalls).toBe(0);
    const option = await world.catalogue.getOption("p-kayak-chi", "o-kayak-chi");
    expect(option?.active).toBe(true);
  });

  it("logs a throwing markUnavailable but still answers unavailable", async () => {
    const world = makeWorld();
    const service = build(world);
    forceListable(world, "p-kayak-chi");
    world.catalogue.markUnavailable = async () => {
      throw new Error("d1 is down");
    };
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await service.createCheckoutLink([{ productId: "p-kayak-chi", optionId: "o-kayak-chi", quantity: 1 }], "agent-api");
      expect(result.kind).toBe("unavailable");
      expect(errorSpy).toHaveBeenCalledTimes(1);
      const logged = JSON.parse(errorSpy.mock.calls[0]?.[0] as string);
      expect(logged).toMatchObject({ at: "shopping.createCheckoutLink", problem: "markUnavailable failed", productId: "p-kayak-chi", optionId: "o-kayak-chi", message: "d1 is down" });
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("creates a cart and answers the buyLink verbatim", async () => {
    const world = makeWorld();
    const service = build(world);
    const result = await service.createCheckoutLink([{ productId: "p-massage-chi", optionId: "o-massage-chi-60", quantity: 2 }], "agent-api");
    expect(result.kind).toBe("link");
    if (result.kind !== "link") throw new Error("expected link");
    const cart = await world.partner.getCart(result.cartId);
    if (!cart.ok) throw new Error("cart vanished");
    expect(result.buyLink).toBe(cart.value.buyLink);
    expect(result.totalMinor).toBe(cart.value.totals.grandTotal);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.quantity).toBe(2);
    const rows = await agentRequestRows(world);
    expect(rows[0]).toMatchObject({ tool: "create_checkout_link", outcome: "ok" });
  });

  it("answers price_changed after the live price moves", async () => {
    const world = makeWorld();
    const service = build(world);
    world.partner.setRetail("p-massage-chi", "o-massage-chi-60", 5500);
    const result = await service.createCheckoutLink([{ productId: "p-massage-chi", optionId: "o-massage-chi-60", quantity: 1 }], "agent-api");
    expect(result).toMatchObject({ kind: "price_changed", productId: "p-massage-chi", optionId: "o-massage-chi-60", wasMinor: 4900, nowMinor: 5500, nowText: formatMoney(5500, "USD", 2) });
    const rows = await agentRequestRows(world);
    expect(rows[0]).toMatchObject({ tool: "create_checkout_link", outcome: "price_changed" });
  });
});

describe("getOrderStatus", () => {
  it("answers not_found for an unknown order and logs it", async () => {
    const world = makeWorld();
    const service = build(world);
    const result = await service.getOrderStatus("no-such-order");
    expect(result).toEqual({ kind: "not_found" });
    const rows = await agentRequestRows(world);
    expect(rows[0]).toMatchObject({ tool: "get_order_status", query_text: "no-such-order", outcome: "not_found" });
  });

  it("reads a pending order and inserts an orders row", async () => {
    const world = makeWorld();
    const service = build(world);
    world.partner.bookings.set("order-1", {
      uuid: "order-1",
      id: "order-1",
      status: "ON_HOLD",
      utcCreatedAt: new Date(world.clock.now()).toISOString(),
      items: [
        {
          productId: "p-massage-chi",
          optionId: "o-massage-chi-60",
          quantity: 1,
          status: "ON_HOLD",
          unitItems: [{ uuid: "unit-1", status: "ON_HOLD", myGrouponUrl: "https://www.groupon.com/mygroupons/units/unit-1" }],
        },
      ],
    });
    const result = await service.getOrderStatus("order-1");
    expect(result).toMatchObject({ kind: "order", uuid: "order-1", status: "ON_HOLD", pending: true });
    if (result.kind !== "order") throw new Error("expected order");
    expect(result.lines[0]).toMatchObject({ productId: "p-massage-chi", title: "Swedish Massage at Foot Smile Spa" });
    expect(result.lines[0]?.vouchers).toEqual([{ status: "ON_HOLD", url: "https://www.groupon.com/mygroupons/units/unit-1" }]);
    const row = await world.db.sqlite.query("SELECT * FROM orders WHERE groupon_order_uuid = ?1").get("order-1");
    expect(row).toMatchObject({ groupon_order_uuid: "order-1", source: "manual", status: "ON_HOLD" });
  });

  it("reads a confirmed order with vouchers, not pending, and updates an existing orders row", async () => {
    const world = makeWorld();
    const service = build(world);
    world.db.sqlite.run("INSERT INTO orders (groupon_order_uuid, source, first_seen_at) VALUES ('order-2', 'return', ?1)", [new Date(world.clock.now()).toISOString()]);
    world.partner.bookings.set("order-2", {
      uuid: "order-2",
      id: "order-2",
      status: "CONFIRMED",
      utcCreatedAt: new Date(world.clock.now()).toISOString(),
      items: [
        {
          productId: "p-massage-chi",
          optionId: "o-massage-chi-60",
          quantity: 1,
          status: "CONFIRMED",
          unitItems: [{ uuid: "unit-2", status: "CONFIRMED", myGrouponUrl: "https://www.groupon.com/mygroupons/units/unit-2" }],
        },
      ],
    });
    const result = await service.getOrderStatus("order-2");
    expect(result).toMatchObject({ kind: "order", status: "CONFIRMED", pending: false });
    const row = world.db.sqlite.query("SELECT * FROM orders WHERE groupon_order_uuid = ?1").get("order-2") as Record<string, unknown>;
    expect(row.source).toBe("return");
    expect(row.status).toBe("CONFIRMED");
  });

  it("gives a null title when the product has left the catalogue", async () => {
    const world = makeWorld();
    const service = build(world);
    world.partner.bookings.set("order-3", {
      uuid: "order-3",
      id: "order-3",
      status: "CONFIRMED",
      utcCreatedAt: new Date(world.clock.now()).toISOString(),
      items: [{ productId: null, optionId: "gone-option", quantity: 1, status: "CONFIRMED", unitItems: [] }],
    });
    const result = await service.getOrderStatus("order-3");
    if (result.kind !== "order") throw new Error("expected order");
    expect(result.lines[0]).toMatchObject({ productId: null, title: null });
  });
});
