/**
 * Tests for the "catalogue-delta" probe check.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/probe/checks/catalogue-delta.test.ts
 * Deps:    bun:test, src/probe/checks/catalogue-delta.ts, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import type { ProbeContext } from "../../../src/contracts/ports";
import { check } from "../../../src/probe/checks/catalogue-delta";
import { makeWorld } from "../../fakes/env";
import { partnerError } from "../../fakes/partner";

function contextOf(world: ReturnType<typeof makeWorld>): ProbeContext {
  return {
    partner: world.partner,
    carts: world.carts,
    catalogue: world.catalogue,
    db: world.db.d1,
    clock: world.clock,
    fetch: (() => Promise.reject(new Error("catalogue-delta never calls fetch"))) as ProbeContext["fetch"],
    config: {
      openapiUrl: "https://example.test/openapi.json",
      expectedDisplayName: "Zora Agent Lab",
      knownOrderUuid: null,
      checkoutHost: "partner.groupon.com",
    },
  };
}

async function setWatermark(world: ReturnType<typeof makeWorld>, value: string): Promise<void> {
  await world.db.d1.prepare("INSERT INTO sync_state (key, value) VALUES (?1, ?2)").bind("last_refresh_at", value).run();
}

describe("catalogue-delta", () => {
  it("skips with no full load yet when sync_state has no watermark", async () => {
    const world = makeWorld();
    const steps = await check.run(contextOf(world));
    expect(steps).toEqual([{ check: "catalogue-delta", step: "watermark", verdict: "skip", httpStatus: null, errorCode: null, latencyMs: null, requestId: null, detail: "no full load yet" }]);
  });

  it("passes read and shape once a watermark exists, without sending active", async () => {
    const world = makeWorld();
    await setWatermark(world, new Date(world.clock.now()).toISOString());
    world.partner.setRetail("p-pizza-chi", "o-pizza-chi", 3100);
    const steps = await check.run(contextOf(world));
    expect(steps.map((step) => step.step)).toEqual(["read", "shape"]);
    for (const step of steps) expect(step.verdict).toBe("pass");
    const [query] = world.partner.callsTo("products.list")[0]!.args as [{ active?: boolean }];
    expect(query.active).toBeUndefined();
    expect(steps[1]?.detail).toContain("product(s) changed");
  });

  it("passes shape with an empty page when nothing changed", async () => {
    const world = makeWorld();
    await setWatermark(world, new Date(world.clock.now() + 3_600_000).toISOString());
    const steps = await check.run(contextOf(world));
    expect(steps.find((step) => step.step === "shape")?.detail).toContain("0 product(s)");
  });

  it("fails read when the delta call fails", async () => {
    const world = makeWorld();
    await setWatermark(world, new Date(world.clock.now()).toISOString());
    world.partner.failNext("products.list", partnerError("INTERNAL_SERVER_ERROR"));
    const steps = await check.run(contextOf(world));
    expect(steps).toHaveLength(1);
    expect(steps[0]?.step).toBe("read");
    expect(steps[0]?.verdict).toBe("fail");
    expect(steps[0]?.errorCode).toBe("INTERNAL_SERVER_ERROR");
  });

  it("skips every step with no API key", async () => {
    const world = makeWorld();
    await setWatermark(world, new Date(world.clock.now()).toISOString());
    world.partner.failNext("products.list", partnerError("NO_KEY", "no key"));
    const steps = await check.run(contextOf(world));
    expect(steps).toHaveLength(2);
    for (const step of steps) {
      expect(step.verdict).toBe("skip");
      expect(step.detail).toBe("no API key yet");
    }
  });

  it("reports a crash as a single failing step, never throwing", async () => {
    const world = makeWorld();
    const context = contextOf(world);
    context.db.prepare = () => {
      throw new Error("boom");
    };
    const steps = await check.run(context);
    expect(steps).toEqual([
      { check: "catalogue-delta", step: "crashed", verdict: "fail", httpStatus: null, errorCode: null, latencyMs: null, requestId: null, detail: "boom" },
    ]);
  });
});
