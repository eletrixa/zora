/**
 * Probe check "cart-lifecycle": create, read, add, change, remove, totals, abandon.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/probe/checks/cart-lifecycle.test.ts
 * Deps:    bun:test, src/probe/checks/cart-lifecycle.ts, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { check } from "../../../src/probe/checks/cart-lifecycle";
import type { PartnerClient, ProbeContext, ProbeStepResult } from "../../../src/contracts/ports";
import { FakeClock } from "../../fakes/clock";
import { createTestDb } from "../../fakes/d1";
import { makeWorld } from "../../fakes/env";
import { FakeCartService, FakeCatalogueStore } from "../../fakes/services";
import { makeProduct } from "../../fakes/fixtures";
import { FakePartnerClient, partnerError } from "../../fakes/partner";

/** A PartnerClient that delegates to `base` except for the methods named in `overrides`. */
function wrapPartner(base: FakePartnerClient, overrides: Partial<PartnerClient>): PartnerClient {
  return {
    getPartner: base.getPartner.bind(base),
    getSupplier: base.getSupplier.bind(base),
    listProducts: base.listProducts.bind(base),
    createCart: base.createCart.bind(base),
    getCart: base.getCart.bind(base),
    addCartItems: base.addCartItems.bind(base),
    updateCartItem: base.updateCartItem.bind(base),
    removeCartItem: base.removeCartItem.bind(base),
    abandonCart: base.abandonCart.bind(base),
    getBooking: base.getBooking.bind(base),
    raw: base.raw.bind(base),
    ...overrides,
  };
}

const SEED = "cart-lifecycle:2026-10-01";

function ctxFrom(world: ReturnType<typeof makeWorld>, overrides: Partial<ProbeContext> = {}): ProbeContext {
  return {
    partner: world.partner,
    carts: world.carts,
    catalogue: world.catalogue,
    db: world.db.d1,
    clock: world.clock,
    fetch: async () => new Response(null, { status: 200 }),
    config: { openapiUrl: "https://example.test/openapi.json", expectedDisplayName: "Zora Agent Lab", knownOrderUuid: null, checkoutHost: "partner.groupon.com" },
    ...overrides,
  };
}

function step(results: readonly ProbeStepResult[], name: string): ProbeStepResult {
  const found = results.find((result) => result.step === name);
  if (!found) throw new Error(`no step "${name}" in ${JSON.stringify(results)}`);
  return found;
}

function soloWorld() {
  const product = makeProduct({ id: "p-solo", title: "Solo Deal", short: "One option only.", categories: ["Solo"], places: [["Solo Spot", "Chicago", "IL", "60601"]], options: [{ id: "o-solo", title: "Solo Option", original: 5000, retail: 3000, isDefault: true }] });
  const clock = new FakeClock();
  const partner = new FakePartnerClient(clock, [product]);
  const catalogue = new FakeCatalogueStore([product], new Date(clock.now()).toISOString());
  const carts = new FakeCartService(partner, clock);
  return { clock, partner, catalogue, carts, db: createTestDb() };
}

describe("cart-lifecycle", () => {
  it("passes every step against the fakes", async () => {
    const world = makeWorld();
    const ctx = ctxFrom(world);
    const options = await world.catalogue.sampleListableOptions(2, SEED);
    expect(options.length).toBe(2);
    const [first, second] = options;

    const results = await check.run(ctx);

    expect(results.map((result) => result.step)).toEqual(["create", "read", "add", "change", "remove", "totals", "abandon"]);
    for (const result of results) expect(result.verdict).toBe("pass");
    expect(step(results, "totals").detail).toContain(String((first?.retail ?? 0) * 2));
    expect(second).toBeDefined();
  });

  it("skips add and remove, and still checks totals, with only one listable option", async () => {
    const solo = soloWorld();
    const ctx: ProbeContext = {
      partner: solo.partner,
      carts: solo.carts,
      catalogue: solo.catalogue,
      db: solo.db.d1,
      clock: solo.clock,
      fetch: async () => new Response(null, { status: 200 }),
      config: { openapiUrl: "https://example.test/openapi.json", expectedDisplayName: "Zora Agent Lab", knownOrderUuid: null, checkoutHost: "partner.groupon.com" },
    };

    const results = await check.run(ctx);

    expect(step(results, "create").verdict).toBe("pass");
    expect(step(results, "add").verdict).toBe("skip");
    expect(step(results, "remove").verdict).toBe("skip");
    expect(step(results, "change").verdict).toBe("pass");
    expect(step(results, "totals").verdict).toBe("pass");
    expect(step(results, "abandon").verdict).toBe("pass");
  });

  it("fails create and stops, when the API refuses to create the cart", async () => {
    const world = makeWorld();
    world.partner.failNext("carts.create", partnerError("INTERNAL_SERVER_ERROR"));
    const ctx = ctxFrom(world);

    const results = await check.run(ctx);

    expect(results).toHaveLength(1);
    expect(step(results, "create").verdict).toBe("fail");
    expect(step(results, "create").errorCode).toBe(null);
    expect(step(results, "create").detail).toContain("error");
  });

  it("fails read when the API cannot read the cart back", async () => {
    const world = makeWorld();
    world.partner.failNext("carts.get", partnerError("INTERNAL_SERVER_ERROR"));
    const ctx = ctxFrom(world);

    const results = await check.run(ctx);

    expect(step(results, "create").verdict).toBe("pass");
    expect(step(results, "read").verdict).toBe("fail");
    expect(step(results, "read").errorCode).toBe("INTERNAL_SERVER_ERROR");
  });

  it("fails add when the API refuses to add the second item", async () => {
    const world = makeWorld();
    world.partner.failNext("carts.items.add", partnerError("PRODUCT_NOT_CARTABLE"));
    const ctx = ctxFrom(world);

    const results = await check.run(ctx);

    expect(step(results, "add").verdict).toBe("fail");
    expect(step(results, "add").errorCode).toBe("PRODUCT_NOT_CARTABLE");
  });

  it("does not retry a timed-out add, and reports what the cart actually holds", async () => {
    const world = makeWorld();
    world.partner.failNext("carts.items.add", partnerError("TIMEOUT", "timed out"));
    const ctx = ctxFrom(world);

    const results = await check.run(ctx);

    expect(world.partner.callsTo("carts.items.add")).toHaveLength(1);
    expect(step(results, "add").verdict).toBe("fail");
    expect(step(results, "add").detail).toContain("timed out");
  });

  it("fails change when the API refuses the quantity update", async () => {
    const world = makeWorld();
    world.partner.failNext("carts.items.update", partnerError("BAD_REQUEST"));
    const ctx = ctxFrom(world);

    const results = await check.run(ctx);

    expect(step(results, "change").verdict).toBe("fail");
    expect(step(results, "change").errorCode).toBe("BAD_REQUEST");
  });

  it("fails remove and then fails totals, since the second item is still in the cart", async () => {
    const world = makeWorld();
    world.partner.failNext("carts.items.remove", partnerError("INTERNAL_SERVER_ERROR"));
    const ctx = ctxFrom(world);

    const results = await check.run(ctx);

    expect(step(results, "remove").verdict).toBe("fail");
    expect(step(results, "totals").verdict).toBe("fail");
  });

  it("fails abandon when the cart does not come back as ABANDONED", async () => {
    const world = makeWorld();
    world.partner.failNext("carts.abandon", partnerError("INTERNAL_SERVER_ERROR"));
    const ctx = ctxFrom(world);

    const results = await check.run(ctx);

    expect(step(results, "abandon").verdict).toBe("fail");
  });

  it("passes abandon when the cart reads back empty, even though status is not ABANDONED", async () => {
    const solo = soloWorld();
    const partner = wrapPartner(solo.partner, {
      abandonCart: async (cartId) => {
        const result = await solo.partner.abandonCart(cartId);
        const cart = solo.partner.carts.get(cartId);
        if (cart) {
          cart.items = [];
          cart.status = "ACTIVE";
        }
        return result;
      },
    });
    const carts = new FakeCartService(partner, solo.clock);
    const ctx: ProbeContext = {
      partner,
      carts,
      catalogue: solo.catalogue,
      db: solo.db.d1,
      clock: solo.clock,
      fetch: async () => new Response(null, { status: 200 }),
      config: { openapiUrl: "https://example.test/openapi.json", expectedDisplayName: "Zora Agent Lab", knownOrderUuid: null, checkoutHost: "partner.groupon.com" },
    };

    const results = await check.run(ctx);

    expect(step(results, "abandon").verdict).toBe("pass");
    expect(step(results, "abandon").detail).toContain("reads back empty after abandon");
  });

  it("fails abandon when the cart still holds items and is not ABANDONED", async () => {
    const solo = soloWorld();
    const partner = wrapPartner(solo.partner, {
      abandonCart: async () => ({
        ok: true,
        value: null,
        meta: { endpoint: "carts.abandon", requestId: "test-req", httpStatus: 204, latencyMs: 1, attempts: 1 },
      }),
    });
    const carts = new FakeCartService(partner, solo.clock);
    const ctx: ProbeContext = {
      partner,
      carts,
      catalogue: solo.catalogue,
      db: solo.db.d1,
      clock: solo.clock,
      fetch: async () => new Response(null, { status: 200 }),
      config: { openapiUrl: "https://example.test/openapi.json", expectedDisplayName: "Zora Agent Lab", knownOrderUuid: null, checkoutHost: "partner.groupon.com" },
    };

    const results = await check.run(ctx);

    expect(step(results, "abandon").verdict).toBe("fail");
    expect(step(results, "abandon").detail).toContain("1 item(s)");
    expect(step(results, "abandon").detail).toContain("status");
  });

  it("fails change with the returned quantity and lineTotal when the API did not apply the new quantity", async () => {
    const solo = soloWorld();
    const partner = wrapPartner(solo.partner, {
      updateCartItem: async (cartId, itemId, _quantity, expectedPrice) => solo.partner.updateCartItem(cartId, itemId, 1, expectedPrice ?? undefined),
    });
    const carts = new FakeCartService(partner, solo.clock);
    const ctx: ProbeContext = {
      partner,
      carts,
      catalogue: solo.catalogue,
      db: solo.db.d1,
      clock: solo.clock,
      fetch: async () => new Response(null, { status: 200 }),
      config: { openapiUrl: "https://example.test/openapi.json", expectedDisplayName: "Zora Agent Lab", knownOrderUuid: null, checkoutHost: "partner.groupon.com" },
    };

    const results = await check.run(ctx);

    expect(step(results, "change").verdict).toBe("fail");
    expect(step(results, "change").detail).toContain("quantity 1");
    expect(step(results, "change").detail).toContain("unitPrice 3000");
    expect(step(results, "change").detail).toContain("the API did not apply the new quantity");
    expect(step(results, "totals").verdict).toBe("fail");
  });

  it("fails change and totals naming the mismatch when the API kept quantity 2 but did not multiply lineTotal", async () => {
    const solo = soloWorld();
    const partner = wrapPartner(solo.partner, {
      updateCartItem: async (cartId, itemId, quantity, expectedPrice) => {
        const result = await solo.partner.updateCartItem(cartId, itemId, quantity, expectedPrice);
        if (result.ok) {
          const line = result.value.items.find((item) => item.id === itemId);
          if (line) line.lineTotal = line.pricing?.retail ?? line.lineTotal;
        }
        return result;
      },
    });
    const carts = new FakeCartService(partner, solo.clock);
    const ctx: ProbeContext = {
      partner,
      carts,
      catalogue: solo.catalogue,
      db: solo.db.d1,
      clock: solo.clock,
      fetch: async () => new Response(null, { status: 200 }),
      config: { openapiUrl: "https://example.test/openapi.json", expectedDisplayName: "Zora Agent Lab", knownOrderUuid: null, checkoutHost: "partner.groupon.com" },
    };

    const results = await check.run(ctx);

    expect(step(results, "change").verdict).toBe("fail");
    expect(step(results, "change").detail).toContain("quantity 2");
    expect(step(results, "change").detail).toContain("lineTotal 3000");
    expect(step(results, "change").detail).toContain("the API kept quantity 2 but did not multiply lineTotal");
    expect(step(results, "totals").verdict).toBe("fail");
    expect(step(results, "totals").detail).toContain("the API kept quantity 2 but did not multiply lineTotal");
  });

  it("skips every step when the catalogue copy is empty", async () => {
    const world = makeWorld();
    const ctx = ctxFrom(world, { catalogue: new FakeCatalogueStore([], "2026-01-01T00:00:00.000Z") });

    const results = await check.run(ctx);

    expect(results).toHaveLength(7);
    for (const result of results) {
      expect(result.verdict).toBe("skip");
      expect(result.detail).toBe("the catalogue copy is empty");
    }
  });

  it("skips every step when there is no API key yet", async () => {
    const world = makeWorld();
    world.partner.failNext("carts.create", partnerError("NO_KEY", "no API key configured"));
    const ctx = ctxFrom(world);

    const results = await check.run(ctx);

    expect(results).toHaveLength(7);
    for (const result of results) {
      expect(result.verdict).toBe("skip");
      expect(result.detail).toBe("no API key yet");
    }
  });

  it("reports a crash as one failing step named crashed", async () => {
    const world = makeWorld();
    const ctx = ctxFrom(world, {
      catalogue: {
        ...world.catalogue,
        sampleListableOptions: async () => {
          throw new Error("boom");
        },
      } as unknown as ProbeContext["catalogue"],
    });

    const results = await check.run(ctx);

    expect(results).toHaveLength(1);
    expect(results[0]?.step).toBe("crashed");
    expect(results[0]?.verdict).toBe("fail");
    expect(results[0]?.detail).toContain("boom");
  });
});
