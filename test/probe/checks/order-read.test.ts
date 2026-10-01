/**
 * Tests for the order-read probe check.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/probe/checks/order-read.test.ts
 * Deps:    bun:test, src/probe/checks/order-read.ts, test/fakes/*
 * Tested:  src/probe/checks/order-read.ts
 */
import { describe, expect, it } from "bun:test";
import { check } from "../../../src/probe/checks/order-read";
import type { ProbeContext } from "../../../src/contracts/ports";
import type { Booking, PartnerBookingItem, PartnerBookingUnitItem } from "../../../src/contracts/partner";
import { makeWorld } from "../../fakes/env";

describe("order-read check", () => {
  it("skips when knownOrderUuid is null", async () => {
    const world = makeWorld();
    const ctx: ProbeContext = {
      partner: world.partner,
      carts: world.carts,
      catalogue: world.catalogue,
      db: world.db.d1,
      clock: world.clock,
      fetch: async () => new Response("not used"),
      config: { openapiUrl: "https://example.com/openapi.json", expectedDisplayName: "test", knownOrderUuid: null, checkoutHost: "partner.groupon.com" },
    };

    const steps = await check.run(ctx);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ step: "skip", verdict: "skip", detail: "no test order yet" });
  });

  it("passes all steps with a valid order", async () => {
    const world = makeWorld();
    const orderUuid = "12345678-1234-5678-1234-567812345678";

    const unitItem: PartnerBookingUnitItem = {
      uuid: "unit-1",
      status: "CONFIRMED",
      myGrouponUrl: "https://www.groupon.com/mygroupons/users/123/details/unit-1",
    };

    const item: PartnerBookingItem = {
      productId: "p-123",
      optionId: "o-123",
      quantity: 1,
      status: "CONFIRMED",
      unitItems: [unitItem],
    };

    const booking: Booking = {
      uuid: orderUuid,
      id: "order-1",
      status: "CONFIRMED",
      utcCreatedAt: new Date(world.clock.now()).toISOString(),
      items: [item],
    };

    world.partner.bookings.set(orderUuid, booking);

    const ctx: ProbeContext = {
      partner: world.partner,
      carts: world.carts,
      catalogue: world.catalogue,
      db: world.db.d1,
      clock: world.clock,
      fetch: async () => new Response("not used"),
      config: { openapiUrl: "https://example.com/openapi.json", expectedDisplayName: "test", knownOrderUuid: orderUuid, checkoutHost: "partner.groupon.com" },
    };

    const steps = await check.run(ctx);
    expect(steps).toHaveLength(3);
    expect(steps[0]).toMatchObject({ step: "read", verdict: "pass" });
    expect(steps[1]).toMatchObject({ step: "status", verdict: "pass" });
    expect(steps[2]).toMatchObject({ step: "items", verdict: "pass" });
  });

  it("fails read when getBooking returns an error", async () => {
    const world = makeWorld();
    const orderUuid = "12345678-1234-5678-1234-567812345678";
    world.partner.failNext("bookings.get", { code: "NOT_FOUND", message: "Order not found", retryable: false, shape: "flat" });

    const ctx: ProbeContext = {
      partner: world.partner,
      carts: world.carts,
      catalogue: world.catalogue,
      db: world.db.d1,
      clock: world.clock,
      fetch: async () => new Response("not used"),
      config: { openapiUrl: "https://example.com/openapi.json", expectedDisplayName: "test", knownOrderUuid: orderUuid, checkoutHost: "partner.groupon.com" },
    };

    const steps = await check.run(ctx);
    expect(steps[0]).toMatchObject({ step: "read", verdict: "fail" });
  });

  it("fails items when no items exist", async () => {
    const world = makeWorld();
    const orderUuid = "12345678-1234-5678-1234-567812345678";

    const booking: Booking = {
      uuid: orderUuid,
      id: "order-1",
      status: "CONFIRMED",
      utcCreatedAt: new Date(world.clock.now()).toISOString(),
      items: [],
    };

    world.partner.bookings.set(orderUuid, booking);

    const ctx: ProbeContext = {
      partner: world.partner,
      carts: world.carts,
      catalogue: world.catalogue,
      db: world.db.d1,
      clock: world.clock,
      fetch: async () => new Response("not used"),
      config: { openapiUrl: "https://example.com/openapi.json", expectedDisplayName: "test", knownOrderUuid: orderUuid, checkoutHost: "partner.groupon.com" },
    };

    const steps = await check.run(ctx);
    expect(steps[2]).toMatchObject({ step: "items", verdict: "fail" });
  });

  it("fails items when item has no optionId", async () => {
    const world = makeWorld();
    const orderUuid = "12345678-1234-5678-1234-567812345678";

    const unitItem: PartnerBookingUnitItem = {
      uuid: "unit-1",
      status: "CONFIRMED",
      myGrouponUrl: "https://www.groupon.com/mygroupons/users/123/details/unit-1",
    };

    const item: PartnerBookingItem = {
      productId: "p-123",
      optionId: "",
      quantity: 1,
      status: "CONFIRMED",
      unitItems: [unitItem],
    };

    const booking: Booking = {
      uuid: orderUuid,
      id: "order-1",
      status: "CONFIRMED",
      utcCreatedAt: new Date(world.clock.now()).toISOString(),
      items: [item],
    };

    world.partner.bookings.set(orderUuid, booking);

    const ctx: ProbeContext = {
      partner: world.partner,
      carts: world.carts,
      catalogue: world.catalogue,
      db: world.db.d1,
      clock: world.clock,
      fetch: async () => new Response("not used"),
      config: { openapiUrl: "https://example.com/openapi.json", expectedDisplayName: "test", knownOrderUuid: orderUuid, checkoutHost: "partner.groupon.com" },
    };

    const steps = await check.run(ctx);
    expect(steps[2]).toMatchObject({ step: "items", verdict: "fail" });
  });

  it("fails items when no unit items exist", async () => {
    const world = makeWorld();
    const orderUuid = "12345678-1234-5678-1234-567812345678";

    const item: PartnerBookingItem = {
      productId: "p-123",
      optionId: "o-123",
      quantity: 1,
      status: "CONFIRMED",
      unitItems: [],
    };

    const booking: Booking = {
      uuid: orderUuid,
      id: "order-1",
      status: "CONFIRMED",
      utcCreatedAt: new Date(world.clock.now()).toISOString(),
      items: [item],
    };

    world.partner.bookings.set(orderUuid, booking);

    const ctx: ProbeContext = {
      partner: world.partner,
      carts: world.carts,
      catalogue: world.catalogue,
      db: world.db.d1,
      clock: world.clock,
      fetch: async () => new Response("not used"),
      config: { openapiUrl: "https://example.com/openapi.json", expectedDisplayName: "test", knownOrderUuid: orderUuid, checkoutHost: "partner.groupon.com" },
    };

    const steps = await check.run(ctx);
    expect(steps[2]).toMatchObject({ step: "items", verdict: "fail" });
  });

  it("fails items when myGrouponUrl is not HTTPS", async () => {
    const world = makeWorld();
    const orderUuid = "12345678-1234-5678-1234-567812345678";

    const unitItem: PartnerBookingUnitItem = {
      uuid: "unit-1",
      status: "CONFIRMED",
      myGrouponUrl: "http://www.groupon.com/mygroupons/users/123/details/unit-1",
    };

    const item: PartnerBookingItem = {
      productId: "p-123",
      optionId: "o-123",
      quantity: 1,
      status: "CONFIRMED",
      unitItems: [unitItem],
    };

    const booking: Booking = {
      uuid: orderUuid,
      id: "order-1",
      status: "CONFIRMED",
      utcCreatedAt: new Date(world.clock.now()).toISOString(),
      items: [item],
    };

    world.partner.bookings.set(orderUuid, booking);

    const ctx: ProbeContext = {
      partner: world.partner,
      carts: world.carts,
      catalogue: world.catalogue,
      db: world.db.d1,
      clock: world.clock,
      fetch: async () => new Response("not used"),
      config: { openapiUrl: "https://example.com/openapi.json", expectedDisplayName: "test", knownOrderUuid: orderUuid, checkoutHost: "partner.groupon.com" },
    };

    const steps = await check.run(ctx);
    expect(steps[2]).toMatchObject({ step: "items", verdict: "fail" });
  });

  it("catches crashes and reports a fail", async () => {
    const world = makeWorld();
    const orderUuid = "12345678-1234-5678-1234-567812345678";
    const badPartner = {
      ...world.partner,
      getBooking: async () => {
        throw new Error("boom");
      },
    };
    const ctx: ProbeContext = {
      partner: badPartner as any,
      carts: world.carts,
      catalogue: world.catalogue,
      db: world.db.d1,
      clock: world.clock,
      fetch: async () => new Response("not used"),
      config: { openapiUrl: "https://example.com/openapi.json", expectedDisplayName: "test", knownOrderUuid: orderUuid, checkoutHost: "partner.groupon.com" },
    };

    const steps = await check.run(ctx);
    expect(steps.some((s) => s.step === "crashed")).toBe(true);
  });
});
