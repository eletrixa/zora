/**
 * Probe check "buy-link": the cart's checkout address is present, on the right host, reachable.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/probe/checks/buy-link.test.ts
 * Deps:    bun:test, src/probe/checks/buy-link.ts, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { check } from "../../../src/probe/checks/buy-link";
import type { Fetch, ProbeContext, ProbeStepResult } from "../../../src/contracts/ports";
import { makeWorld } from "../../fakes/env";
import { FakeCatalogueStore } from "../../fakes/services";
import { partnerError } from "../../fakes/partner";

const SEED = "buy-link:2026-10-01";
const CHECKOUT_HOST = "partner.groupon.com";

function ctxFrom(world: ReturnType<typeof makeWorld>, overrides: Partial<ProbeContext> = {}): ProbeContext {
  return {
    partner: world.partner,
    carts: world.carts,
    catalogue: world.catalogue,
    db: world.db.d1,
    clock: world.clock,
    fetch: async () => new Response(null, { status: 200 }),
    config: { openapiUrl: "https://example.test/openapi.json", expectedDisplayName: "Zora Agent Lab", knownOrderUuid: null, checkoutHost: CHECKOUT_HOST },
    ...overrides,
  };
}

function step(results: readonly ProbeStepResult[], name: string): ProbeStepResult {
  const found = results.find((result) => result.step === name);
  if (!found) throw new Error(`no step "${name}" in ${JSON.stringify(results)}`);
  return found;
}

describe("buy-link", () => {
  it("passes every step against the fakes", async () => {
    const world = makeWorld();
    const seen: { url: string | URL | Request; init?: RequestInit }[] = [];
    const fetch: Fetch = async (url, init) => {
      seen.push({ url, init });
      return new Response(null, { status: 200 });
    };
    const ctx = ctxFrom(world, { fetch });

    const results = await check.run(ctx);

    expect(results.map((result) => result.step)).toEqual(["present", "host", "reachable"]);
    for (const result of results) expect(result.verdict).toBe("pass");
    expect(seen).toHaveLength(1);
    expect(seen[0]?.init?.redirect).toBe("manual");
    expect((seen[0]?.init?.headers as Record<string, string>)?.["user-agent"]).toBeTruthy();
    expect([...world.partner.carts.values()].every((cart) => cart.status === "ABANDONED")).toBe(true);
  });

  it("passes reachable on a 3xx redirect, without following it", async () => {
    const world = makeWorld();
    const fetch: Fetch = async () => new Response(null, { status: 302, headers: { location: "https://partner.groupon.com/checkout/done" } });
    const ctx = ctxFrom(world, { fetch });

    const results = await check.run(ctx);

    expect(step(results, "reachable").verdict).toBe("pass");
    expect(step(results, "reachable").httpStatus).toBe(302);
  });

  it("fails present when the API returns no buyLink", async () => {
    const world = makeWorld();
    world.partner.onRaw = null;
    const originalCreate = world.partner.createCart.bind(world.partner);
    world.partner.createCart = async (items, ref) => {
      const result = await originalCreate(items, ref);
      if (!result.ok) return result;
      return { ...result, value: { ...result.value, buyLink: "" } };
    };
    const ctx = ctxFrom(world);

    const results = await check.run(ctx);

    expect(step(results, "present").verdict).toBe("fail");
    expect(step(results, "host").verdict).toBe("skip");
    expect(step(results, "reachable").verdict).toBe("skip");
  });

  it("fails host when the buyLink host is not the configured checkout host", async () => {
    const world = makeWorld();
    const ctx = ctxFrom(world, { config: { openapiUrl: "https://example.test/openapi.json", expectedDisplayName: "Zora Agent Lab", knownOrderUuid: null, checkoutHost: "wrong.example.test" } });

    const results = await check.run(ctx);

    expect(step(results, "host").verdict).toBe("fail");
    expect(step(results, "host").detail).toContain("wrong.example.test");
  });

  it("expects a non-checkout-host buyLink when the registration carries a CJ publisher id", async () => {
    const world = makeWorld();
    world.partner.registration = { ...world.partner.registration, cjPublisherId: "cj-12345" };
    const ctx = ctxFrom(world);

    const results = await check.run(ctx);

    // The fake's buyLink is always on the direct checkout host, so with a CJ id registered the
    // host check now correctly fails: production would have to actually route through CJ.
    expect(step(results, "host").verdict).toBe("fail");
    expect(step(results, "host").detail).toContain("CJ publisher id");
  });

  it("fails reachable when the buyLink answers an unexpected status", async () => {
    const world = makeWorld();
    const fetch: Fetch = async () => new Response(null, { status: 500 });
    const ctx = ctxFrom(world, { fetch });

    const results = await check.run(ctx);

    expect(step(results, "reachable").verdict).toBe("fail");
    expect(step(results, "reachable").httpStatus).toBe(500);
  });

  it("fails reachable when fetching the buyLink throws", async () => {
    const world = makeWorld();
    const fetch: Fetch = async () => {
      throw new Error("network unreachable");
    };
    const ctx = ctxFrom(world, { fetch });

    const results = await check.run(ctx);

    expect(step(results, "reachable").verdict).toBe("fail");
    expect(step(results, "reachable").detail).toContain("network unreachable");
  });

  it("skips every step when the catalogue copy is empty", async () => {
    const world = makeWorld();
    const ctx = ctxFrom(world, { catalogue: new FakeCatalogueStore([], "2026-01-01T00:00:00.000Z") });

    const results = await check.run(ctx);

    expect(results).toHaveLength(3);
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

    expect(results).toHaveLength(3);
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
