/**
 * Tests for the "catalogue-page" probe check.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/probe/checks/catalogue-page.test.ts
 * Deps:    bun:test, src/probe/checks/catalogue-page.ts, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import type { ProbeContext } from "../../../src/contracts/ports";
import { check } from "../../../src/probe/checks/catalogue-page";
import { makeWorld } from "../../fakes/env";
import { partnerError } from "../../fakes/partner";

function contextOf(world: ReturnType<typeof makeWorld>): ProbeContext {
  return {
    partner: world.partner,
    carts: world.carts,
    catalogue: world.catalogue,
    db: world.db.d1,
    clock: world.clock,
    fetch: (() => Promise.reject(new Error("catalogue-page never calls fetch"))) as ProbeContext["fetch"],
    config: {
      openapiUrl: "https://example.test/openapi.json",
      expectedDisplayName: "Zora Agent Lab",
      knownOrderUuid: null,
      checkoutHost: "partner.groupon.com",
    },
  };
}

describe("catalogue-page", () => {
  it("passes every step against the fixture catalogue", async () => {
    const world = makeWorld();
    const steps = await check.run(contextOf(world));
    expect(steps.map((step) => step.step)).toEqual(["read", "count", "shape", "promo", "timestamp"]);
    for (const step of steps) expect(step.verdict).toBe("pass");
  });

  it("fails count when the page holds more than 10 products", async () => {
    const world = makeWorld();
    const original = world.partner.listProducts.bind(world.partner);
    world.partner.listProducts = async (query) => {
      const result = await original(query);
      if (!result.ok) return result;
      const extra = Array.from({ length: 12 }, (_, i) => ({ ...result.value.products[0]!, id: `p-extra-${i}` }));
      return { ...result, value: { ...result.value, products: extra } };
    };
    const steps = await check.run(contextOf(world));
    const count = steps.find((step) => step.step === "count");
    expect(count?.verdict).toBe("fail");
    expect(count?.detail).toContain("expected 1 to 10 products");
  });

  it("fails count when the page holds zero products", async () => {
    const world = makeWorld();
    world.partner.products = [];
    const steps = await check.run(contextOf(world));
    const count = steps.find((step) => step.step === "count");
    expect(count?.verdict).toBe("fail");
    expect(count?.detail).toContain("got 0");
  });

  it("fails shape when a product is missing its title", async () => {
    const world = makeWorld();
    world.partner.products[0]!.title = "";
    const steps = await check.run(contextOf(world));
    const shape = steps.find((step) => step.step === "shape");
    expect(shape?.verdict).toBe("fail");
    expect(shape?.detail).toContain(world.partner.products[0]!.id);
    expect(shape?.detail).toContain("title");
  });

  it("fails shape when an option's price is not an integer", async () => {
    const world = makeWorld();
    (world.partner.products[0]!.options[0]!.units[0]!.pricing[0] as { retail: number }).retail = 49.5;
    const steps = await check.run(contextOf(world));
    const shape = steps.find((step) => step.step === "shape");
    expect(shape?.verdict).toBe("fail");
    expect(shape?.detail).toContain("retail");
  });

  it("fails promo when the promo price is above retail", async () => {
    const world = makeWorld();
    const pricing = world.partner.products[0]!.options[0]!.units[0]!.pricing[0]!;
    pricing.discountedPrice = { amount: pricing.retail + 100, promoCode: "TOOHIGH", endDate: null };
    const steps = await check.run(contextOf(world));
    const promo = steps.find((step) => step.step === "promo");
    expect(promo?.verdict).toBe("fail");
    expect(promo?.detail).toContain("above its retail");
  });

  it("fails timestamp when the page's timestamp does not parse", async () => {
    const world = makeWorld();
    world.partner.onRaw = null;
    const original = world.partner.listProducts.bind(world.partner);
    world.partner.listProducts = async (query) => {
      const result = await original(query);
      if (!result.ok) return result;
      return { ...result, value: { ...result.value, timestamp: "not-a-time" } };
    };
    const steps = await check.run(contextOf(world));
    const timestamp = steps.find((step) => step.step === "timestamp");
    expect(timestamp?.verdict).toBe("fail");
    expect(timestamp?.detail).toContain("not-a-time");
  });

  it("fails read when the call fails", async () => {
    const world = makeWorld();
    world.partner.failNext("products.list", partnerError("INTERNAL_SERVER_ERROR"));
    const steps = await check.run(contextOf(world));
    expect(steps).toHaveLength(1);
    expect(steps[0]?.step).toBe("read");
    expect(steps[0]?.verdict).toBe("fail");
    expect(steps[0]?.errorCode).toBe("INTERNAL_SERVER_ERROR");
  });

  it("skips every step with no API key", async () => {
    const world = makeWorld();
    world.partner.failNext("products.list", partnerError("NO_KEY", "no key"));
    const steps = await check.run(contextOf(world));
    expect(steps).toHaveLength(5);
    for (const step of steps) {
      expect(step.verdict).toBe("skip");
      expect(step.detail).toBe("no API key yet");
    }
  });

  it("reports a crash as a single failing step, never throwing", async () => {
    const world = makeWorld();
    const context = contextOf(world);
    context.partner.listProducts = () => {
      throw new Error("boom");
    };
    const steps = await check.run(context);
    expect(steps).toEqual([
      { check: "catalogue-page", step: "crashed", verdict: "fail", httpStatus: null, errorCode: null, latencyMs: null, requestId: null, detail: "boom" },
    ]);
  });
});
