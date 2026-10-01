/**
 * The fakes behave as the contracts and the guide say. Lanes trust these fakes, so their
 * behaviour is pinned here.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/contracts/ports.test.ts
 * Deps:    bun:test, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import type { OctoProduct } from "../../src/contracts/partner";
import { FakeClock } from "../fakes/clock";
import { makeWorld } from "../fakes/env";
import { FIXTURE_PRODUCTS, LISTABLE_IDS } from "../fakes/fixtures";
import { FakePartnerClient, partnerError } from "../fakes/partner";
import { cardOf, fakeIsListable } from "../fakes/services";

describe("fixtures", () => {
  it("mark exactly the listable products as listable", () => {
    const listable = FIXTURE_PRODUCTS.filter(fakeIsListable).map((product) => product.id);
    expect(listable.sort()).toEqual([...LISTABLE_IDS].sort());
  });
});

describe("FakePartnerClient catalogue", () => {
  it("walks every product once with cursors", async () => {
    const partner = new FakePartnerClient();
    const seen: OctoProduct[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const result = await partner.listProducts({ limit: 5, cursor });
      if (!result.ok) throw new Error(result.error.code);
      seen.push(...result.value.products);
      if (!result.value.hasMore) break;
      cursor = result.value.nextCursor ?? undefined;
    }
    expect(seen.map((product) => product.id)).toEqual(FIXTURE_PRODUCTS.map((product) => product.id));
    expect(partner.callsTo("products.list")).toHaveLength(3);
  });

  it("filters by full state name, not by code", async () => {
    const partner = new FakePartnerClient();
    const byName = await partner.listProducts({ state: "New York" });
    const byCode = await partner.listProducts({ state: "NY" });
    expect(byName.ok && byName.value.products.map((product) => product.id)).toEqual(["p-massage-nyc", "p-escape-nyc"]);
    expect(byCode.ok && byCode.value.products).toEqual([]);
  });

  it("filters by category1 like the products API, so bowling sits in two categories", async () => {
    const partner = new FakePartnerClient();
    const things = await partner.listProducts({ category1: "things-to-do" });
    const food = await partner.listProducts({ category1: "food-and-drink" });
    const unknown = await partner.listProducts({ category1: "zeppelins" });
    expect(things.ok && things.value.products.map((product) => product.id)).toEqual(["p-bowling-chi", "p-escape-nyc", "p-kayak-chi"]);
    expect(food.ok && food.value.products.map((product) => product.id)).toEqual(["p-bowling-chi", "p-pizza-chi"]);
    expect(unknown.ok && unknown.value.products).toEqual([]);
  });

  it("returns only changed products on a delta", async () => {
    const clock = new FakeClock();
    const partner = new FakePartnerClient(clock);
    const watermark = new Date(clock.now() + 1).toISOString();
    clock.advance(60_000);
    partner.setRetail("p-pizza-chi", "o-pizza-chi", 3100);
    const delta = await partner.listProducts({ updatedSince: watermark });
    expect(delta.ok && delta.value.products.map((product) => product.id)).toEqual(["p-pizza-chi"]);
  });

  it("fails once when scripted, then works", async () => {
    const partner = new FakePartnerClient();
    partner.failNext("products.list", partnerError("INTERNAL_SERVER_ERROR"));
    const first = await partner.listProducts({});
    const second = await partner.listProducts({});
    expect(first.ok).toBe(false);
    expect(!first.ok && first.error.retryable).toBe(true);
    expect(second.ok).toBe(true);
  });
});

describe("FakePartnerClient carts", () => {
  it("creates a cart with a verbatim buyLink and retail totals", async () => {
    const partner = new FakePartnerClient();
    const result = await partner.createCart([{ productId: "p-massage-chi", optionId: "o-massage-chi-60", quantity: 2, expectedPrice: 4900 }]);
    if (!result.ok) throw new Error(result.error.code);
    expect(result.value.buyLink).toBe(`https://partner.groupon.com/checkout/cart/${result.value.id}`);
    expect(result.value.totals.grandTotal).toBe(9800);
  });

  it("answers PRICE_MISMATCH with the current price", async () => {
    const partner = new FakePartnerClient();
    const result = await partner.createCart([{ productId: "p-massage-chi", optionId: "o-massage-chi-60", quantity: 1, expectedPrice: 3920 }]);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("PRICE_MISMATCH");
    expect(!result.ok && result.error.currentPrice).toBe(4900);
  });

  it("refuses a product that needs a date", async () => {
    const partner = new FakePartnerClient();
    const result = await partner.createCart([{ productId: "p-kayak-chi", optionId: "o-kayak-chi", quantity: 1, expectedPrice: 4200 }]);
    expect(!result.ok && result.error.code).toBe("PRODUCT_NOT_CARTABLE");
  });

  it("answers 401 in the auth shape without a key", async () => {
    const partner = new FakePartnerClient();
    const result = await partner.raw({ method: "GET", path: "/octo-gateway/v1/products", auth: "none" });
    expect(result.ok && result.value.httpStatus).toBe(401);
    expect(result.ok && result.value.body).toEqual({ code: "unauthenticated", message: "missing or invalid API key", details: null });
  });
});

describe("service fakes", () => {
  it("search finds a massage in Chicago and hides what cannot be bought", async () => {
    const { search } = makeWorld();
    const hits = await search.search({ text: "massage in Chicago" });
    expect(hits.map((hit) => hit.productId)).toEqual(["p-massage-chi"]);
  });

  it("a card shows retail as the price to pay and keeps the promo apart", async () => {
    const { search } = makeWorld();
    const [hit] = await search.search({ text: "massage chicago" });
    if (!hit) throw new Error("no hit");
    const card = cardOf(hit);
    expect(card.payMinor).toBe(4900);
    expect(card.payText).toBe("$49.00");
    expect(card.promo?.priceMinor).toBe(3920);
    expect(card.promo?.instruction).toBe("Type code SAVE20 at Groupon checkout to pay $39.20. Without it you pay $49.00.");
  });

  it("the cart service reports a changed price as a value", async () => {
    const { carts } = makeWorld();
    const outcome = await carts.create([{ productId: "p-massage-chi", optionId: "o-massage-chi-60", quantity: 1, expectedPriceMinor: 1 }], "probe");
    expect(outcome.kind).toBe("price_changed");
    expect(outcome.kind === "price_changed" && outcome.currentPriceMinor).toBe(4900);
  });

  it("the catalogue store records a price change on upsert", async () => {
    const { catalogue, partner } = makeWorld();
    partner.setRetail("p-pizza-chi", "o-pizza-chi", 3100);
    const stats = await catalogue.upsertProducts(partner.products, "run-2", "2026-10-02T00:00:00.000Z");
    expect(stats).toEqual({ inserted: 0, updated: 1, unchanged: 12, priceChanges: 1 });
    expect(await catalogue.priceHistory("p-pizza-chi", 5)).toEqual([{ productId: "p-pizza-chi", optionId: "o-pizza-chi", field: "retail", oldMinor: 2900, newMinor: 3100, detectedAt: "2026-10-02T00:00:00.000Z" }] as never);
  });
});
