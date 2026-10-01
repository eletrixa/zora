/**
 * Probe check "price-mismatch": expectedPrice one cent above retail must be refused.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/probe/checks/price-mismatch.test.ts
 * Deps:    bun:test, src/probe/checks/price-mismatch.ts, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { check } from "../../../src/probe/checks/price-mismatch";
import type { ProbeContext, ProbeStepResult } from "../../../src/contracts/ports";
import { makeWorld } from "../../fakes/env";
import { FakeCatalogueStore } from "../../fakes/services";
import { partnerError } from "../../fakes/partner";

const SEED = "price-mismatch:2026-10-01";

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

describe("price-mismatch", () => {
  it("passes both steps: refused with PRICE_MISMATCH, currentPrice matches the catalogue", async () => {
    const world = makeWorld();
    const ctx = ctxFrom(world);
    const options = await world.catalogue.sampleListableOptions(2, SEED);
    const option = options[0];
    expect(option).toBeDefined();

    const results = await check.run(ctx);

    expect(results.map((result) => result.step)).toEqual(["refused", "current-price"]);
    expect(step(results, "refused").verdict).toBe("pass");
    expect(step(results, "current-price").verdict).toBe("pass");
    expect(step(results, "current-price").detail).toContain(String(option?.retail));
    expect([...world.partner.carts.values()].every((cart) => cart.status === "ABANDONED")).toBe(true);
  });

  it("reports the catalogue as stale, but still passes, when currentPrice differs from the catalogue", async () => {
    const world = makeWorld();
    const options = await world.catalogue.sampleListableOptions(2, SEED);
    const option = options[0];
    if (!option) throw new Error("fixture catalogue produced no option");
    world.partner.setRetail(option.productId, option.optionId, option.retail + 500);
    const ctx = ctxFrom(world);

    const results = await check.run(ctx);

    expect(step(results, "current-price").verdict).toBe("pass");
    expect(step(results, "current-price").detail).toStartWith("catalogue copy is stale:");
  });

  it("fails refused, and skips current-price, when the API answers something other than PRICE_MISMATCH", async () => {
    const world = makeWorld();
    world.partner.failNext("carts.create", partnerError("INTERNAL_SERVER_ERROR"));
    const ctx = ctxFrom(world);

    const results = await check.run(ctx);

    expect(step(results, "refused").verdict).toBe("fail");
    expect(step(results, "refused").errorCode).toBe("INTERNAL_SERVER_ERROR");
    expect(step(results, "current-price").verdict).toBe("skip");
  });

  it("fails refused and abandons the cart, when the mismatched price is accepted", async () => {
    const world = makeWorld();
    const options = await world.catalogue.sampleListableOptions(2, SEED);
    const option = options[0];
    if (!option) throw new Error("fixture catalogue produced no option");
    // Bump the live retail so it matches the wrong expectedPrice the check sends, simulating the
    // API failing to reject a stale price.
    world.partner.setRetail(option.productId, option.optionId, option.retail + 1);
    const ctx = ctxFrom(world);

    const results = await check.run(ctx);

    expect(step(results, "refused").verdict).toBe("fail");
    expect(step(results, "refused").detail).toContain("a cart was created");
    expect(step(results, "current-price").verdict).toBe("skip");
    expect([...world.partner.carts.values()].every((cart) => cart.status === "ABANDONED")).toBe(true);
  });

  it("skips both steps when the catalogue copy is empty", async () => {
    const world = makeWorld();
    const ctx = ctxFrom(world, { catalogue: new FakeCatalogueStore([], "2026-01-01T00:00:00.000Z") });

    const results = await check.run(ctx);

    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result.verdict).toBe("skip");
      expect(result.detail).toBe("the catalogue copy is empty");
    }
  });

  it("skips both steps when there is no API key yet", async () => {
    const world = makeWorld();
    world.partner.failNext("carts.create", partnerError("NO_KEY", "no API key configured"));
    const ctx = ctxFrom(world);

    const results = await check.run(ctx);

    expect(results).toHaveLength(2);
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
