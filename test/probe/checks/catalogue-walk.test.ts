/**
 * Tests for the "catalogue-walk" probe check.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/probe/checks/catalogue-walk.test.ts
 * Deps:    bun:test, src/probe/checks/catalogue-walk.ts, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import type { ProbeContext } from "../../../src/contracts/ports";
import { check } from "../../../src/probe/checks/catalogue-walk";
import { makeWorld } from "../../fakes/env";
import { FIXTURE_PRODUCTS, freshProducts } from "../../fakes/fixtures";
import { partnerError } from "../../fakes/partner";

function contextOf(world: ReturnType<typeof makeWorld>): ProbeContext {
  return {
    partner: world.partner,
    carts: world.carts,
    catalogue: world.catalogue,
    db: world.db.d1,
    clock: world.clock,
    fetch: (() => Promise.reject(new Error("catalogue-walk never calls fetch"))) as ProbeContext["fetch"],
    config: {
      openapiUrl: "https://example.test/openapi.json",
      expectedDisplayName: "Zora Agent Lab",
      knownOrderUuid: null,
      checkoutHost: "partner.groupon.com",
    },
  };
}

describe("catalogue-walk", () => {
  it("passes every step over a walk that ends before three pages", async () => {
    // 13 fixture products at 10 per page: page-1 full, page-2 has the rest with hasMore false.
    const world = makeWorld();
    const steps = await check.run(contextOf(world));
    expect(steps.map((step) => step.step)).toEqual(["page-1", "page-2", "page-3", "no-repeat", "cursor"]);
    expect(steps.find((step) => step.step === "page-1")?.verdict).toBe("pass");
    expect(steps.find((step) => step.step === "page-2")?.verdict).toBe("pass");
    const page3 = steps.find((step) => step.step === "page-3");
    expect(page3?.verdict).toBe("skip");
    expect(page3?.detail).toContain("hasMore false");
    expect(steps.find((step) => step.step === "no-repeat")?.verdict).toBe("pass");
    expect(steps.find((step) => step.step === "cursor")?.verdict).toBe("pass");
  });

  it("walks all three pages when the catalogue is large enough", async () => {
    const world = makeWorld();
    world.partner.products = Array.from({ length: 25 }, (_, i) => ({ ...freshProducts()[0]!, id: `p-${i}` }));
    const steps = await check.run(contextOf(world));
    expect(steps.find((step) => step.step === "page-1")?.verdict).toBe("pass");
    expect(steps.find((step) => step.step === "page-2")?.verdict).toBe("pass");
    expect(steps.find((step) => step.step === "page-3")?.verdict).toBe("pass");
    expect(steps.find((step) => step.step === "no-repeat")?.verdict).toBe("pass");
  });

  it("fails no-repeat when a product id appears on two pages", async () => {
    const world = makeWorld();
    const original = world.partner.listProducts.bind(world.partner);
    let calls = 0;
    world.partner.listProducts = async (query) => {
      calls += 1;
      const result = await original(query);
      if (!result.ok) return result;
      if (calls === 2) {
        return { ...result, value: { ...result.value, products: [FIXTURE_PRODUCTS[0]!] } };
      }
      return result;
    };
    const steps = await check.run(contextOf(world));
    const noRepeat = steps.find((step) => step.step === "no-repeat");
    expect(noRepeat?.verdict).toBe("fail");
    expect(noRepeat?.detail).toContain(FIXTURE_PRODUCTS[0]!.id);
  });

  it("fails cursor when hasMore is true but nextCursor is missing", async () => {
    const world = makeWorld();
    const original = world.partner.listProducts.bind(world.partner);
    world.partner.listProducts = async (query) => {
      const result = await original(query);
      if (!result.ok) return result;
      return { ...result, value: { ...result.value, hasMore: true, nextCursor: null } };
    };
    const steps = await check.run(contextOf(world));
    const cursor = steps.find((step) => step.step === "cursor");
    expect(cursor?.verdict).toBe("fail");
    expect(cursor?.detail).toContain("hasMore true");
  });

  it("fails a page and skips the rest when a page call fails", async () => {
    const world = makeWorld();
    world.partner.failNext("products.list", partnerError("INTERNAL_SERVER_ERROR"));
    const steps = await check.run(contextOf(world));
    expect(steps.find((step) => step.step === "page-1")?.verdict).toBe("fail");
    expect(steps.find((step) => step.step === "page-2")?.detail).toContain("earlier page failed");
    expect(steps.find((step) => step.step === "page-3")?.verdict).toBe("skip");
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
      { check: "catalogue-walk", step: "crashed", verdict: "fail", httpStatus: null, errorCode: null, latencyMs: null, requestId: null, detail: "boom" },
    ]);
  });
});
