/**
 * Tests for the "refusals" probe check.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/probe/checks/refusals.test.ts
 * Deps:    bun:test, src/probe/checks/refusals.ts, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import type { ProbeContext, RawRequest, RawResponse } from "../../../src/contracts/ports";
import { check } from "../../../src/probe/checks/refusals";
import { makeWorld } from "../../fakes/env";
import { partnerError } from "../../fakes/partner";

function contextOf(world: ReturnType<typeof makeWorld>): ProbeContext {
  return {
    partner: world.partner,
    carts: world.carts,
    catalogue: world.catalogue,
    db: world.db.d1,
    clock: world.clock,
    fetch: (() => Promise.reject(new Error("refusals never calls fetch"))) as ProbeContext["fetch"],
    config: {
      openapiUrl: "https://example.test/openapi.json",
      expectedDisplayName: "Zora Agent Lab",
      knownOrderUuid: null,
      checkoutHost: "partner.groupon.com",
    },
  };
}

describe("refusals", () => {
  it("passes every step against the default fake behaviour", async () => {
    const world = makeWorld();
    const steps = await check.run(contextOf(world));
    expect(steps.map((step) => step.step)).toEqual(["no-key", "bearer", "state-code", "bad-cursor"]);
    for (const step of steps) expect(step.verdict).toBe("pass");
  });

  it("fails no-key when a missing key does not answer 401 unauthenticated", async () => {
    const world = makeWorld();
    world.partner.onRaw = (request: RawRequest): RawResponse => {
      if (request.auth === "none") return { httpStatus: 200, headers: {}, body: { products: [] } };
      return { httpStatus: 401, headers: {}, body: { code: "unauthenticated", message: "x", details: null } };
    };
    const steps = await check.run(contextOf(world));
    const noKey = steps.find((step) => step.step === "no-key");
    expect(noKey?.verdict).toBe("fail");
    expect(noKey?.detail).toContain("HTTP 200");
  });

  it("fails bearer when a Bearer header is not refused", async () => {
    const world = makeWorld();
    world.partner.onRaw = (request: RawRequest): RawResponse => {
      if (request.auth === "bearer") return { httpStatus: 200, headers: {}, body: { products: [] } };
      if (request.auth === "none") return { httpStatus: 401, headers: {}, body: { code: "unauthenticated", message: "x", details: null } };
      if (request.query?.state === "IL") return { httpStatus: 200, headers: {}, body: { products: [], hasMore: false, nextCursor: null, timestamp: new Date().toISOString() } };
      return { httpStatus: 400, headers: {}, body: { error: "BAD_REQUEST", errorMessage: "bad cursor", requestId: "r-1" } };
    };
    const steps = await check.run(contextOf(world));
    const bearer = steps.find((step) => step.step === "bearer");
    expect(bearer?.verdict).toBe("fail");
    expect(bearer?.detail).toContain("HTTP 200");
  });

  it("fails state-code when a state outside scope returns products instead of an empty page", async () => {
    const world = makeWorld();
    world.partner.onRaw = (request: RawRequest): RawResponse => {
      if (request.auth !== "key") return { httpStatus: 401, headers: {}, body: { code: "unauthenticated", message: "x", details: null } };
      if (request.query?.state === "IL") {
        return { httpStatus: 200, headers: {}, body: { products: [{ id: "p-1" }], hasMore: false, nextCursor: null, timestamp: new Date().toISOString() } };
      }
      return { httpStatus: 400, headers: {}, body: { error: "BAD_REQUEST", errorMessage: "bad cursor", requestId: "r-1" } };
    };
    const steps = await check.run(contextOf(world));
    const stateCode = steps.find((step) => step.step === "state-code");
    expect(stateCode?.verdict).toBe("fail");
    expect(stateCode?.detail).toContain("1 products");
  });

  it("fails bad-cursor when a 200 with products comes back instead of an error", async () => {
    const world = makeWorld();
    world.partner.onRaw = (request: RawRequest): RawResponse => {
      if (request.auth !== "key") return { httpStatus: 401, headers: {}, body: { code: "unauthenticated", message: "x", details: null } };
      if (request.query?.state === "IL") return { httpStatus: 200, headers: {}, body: { products: [], hasMore: false, nextCursor: null, timestamp: new Date().toISOString() } };
      return { httpStatus: 200, headers: {}, body: { products: [{ id: "p-1" }], hasMore: false, nextCursor: null, timestamp: new Date().toISOString() } };
    };
    const steps = await check.run(contextOf(world));
    const badCursor = steps.find((step) => step.step === "bad-cursor");
    expect(badCursor?.verdict).toBe("fail");
    expect(badCursor?.detail).toContain("never products");
  });

  it("passes bad-cursor when raw() fails with a partner error code", async () => {
    const world = makeWorld();
    world.partner.onRaw = (request: RawRequest): RawResponse => {
      if (request.auth !== "key") return { httpStatus: 401, headers: {}, body: { code: "unauthenticated", message: "x", details: null } };
      if (request.query?.cursor === "not-a-cursor") throw partnerError("BAD_REQUEST", "bad cursor");
      return { httpStatus: 200, headers: {}, body: { products: [], hasMore: false, nextCursor: null, timestamp: new Date().toISOString() } };
    };
    const steps = await check.run(contextOf(world));
    const badCursor = steps.find((step) => step.step === "bad-cursor");
    expect(badCursor?.verdict).toBe("pass");
    expect(badCursor?.detail).toContain("BAD_REQUEST");
  });

  it("skips every step with no API key", async () => {
    const world = makeWorld();
    world.partner.failNext("raw", partnerError("NO_KEY", "no key"));
    const steps = await check.run(contextOf(world));
    expect(steps).toHaveLength(4);
    for (const step of steps) {
      expect(step.verdict).toBe("skip");
      expect(step.detail).toBe("no API key yet");
    }
  });

  it("reports a crash as a single failing step, never throwing", async () => {
    const world = makeWorld();
    const context = contextOf(world);
    context.partner.raw = () => {
      throw new Error("boom");
    };
    const steps = await check.run(context);
    expect(steps).toEqual([{ check: "refusals", step: "crashed", verdict: "fail", httpStatus: null, errorCode: null, latencyMs: null, requestId: null, detail: "boom" }]);
  });
});
