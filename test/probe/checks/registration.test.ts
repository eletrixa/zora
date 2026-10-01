/**
 * Tests for the registration probe check.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/probe/checks/registration.test.ts
 * Deps:    bun:test, src/probe/checks/registration.ts, test/fakes/*
 * Tested:  src/probe/checks/registration.ts
 */
import { describe, expect, it } from "bun:test";
import { check } from "../../../src/probe/checks/registration";
import type { ProbeContext } from "../../../src/contracts/ports";
import { makeWorld } from "../../fakes/env";
import { partnerError } from "../../fakes/partner";

describe("registration check", () => {
  it("passes when getPartner and getSupplier succeed with all fields set", async () => {
    const world = makeWorld();
    const ctx: ProbeContext = {
      partner: world.partner,
      carts: world.carts,
      catalogue: world.catalogue,
      db: world.db.d1,
      clock: world.clock,
      fetch: async () => new Response("not used"),
      config: { openapiUrl: "https://example.com/openapi.json", expectedDisplayName: "Zora Agent Lab", knownOrderUuid: null, checkoutHost: "partner.groupon.com" },
    };

    const steps = await check.run(ctx);
    expect(steps).toHaveLength(5);
    expect(steps![0]).toMatchObject({ step: "read", verdict: "pass" });
    expect(steps![1]).toMatchObject({ step: "name", verdict: "pass" });
    expect(steps![2]).toMatchObject({ step: "active", verdict: "pass" });
    expect(steps![3]).toMatchObject({ step: "urls", verdict: "pass" });
    expect(steps![4]).toMatchObject({ step: "supplier", verdict: "pass" });
  });

  it("fails at read when getPartner returns an error", async () => {
    const world = makeWorld();
    world.partner.failNext("partners.me", partnerError("API_ERROR", "API error"));
    const ctx: ProbeContext = {
      partner: world.partner,
      carts: world.carts,
      catalogue: world.catalogue,
      db: world.db.d1,
      clock: world.clock,
      fetch: async () => new Response("not used"),
      config: { openapiUrl: "https://example.com/openapi.json", expectedDisplayName: "Zora Agent Lab", knownOrderUuid: null, checkoutHost: "partner.groupon.com" },
    };

    const steps = await check.run(ctx);
    expect(steps![0]).toMatchObject({ step: "read", verdict: "fail" });
    expect(steps![0]!.detail).toContain("API_ERROR");
  });

  it("fails at name when displayName does not match", async () => {
    const world = makeWorld();
    const ctx: ProbeContext = {
      partner: world.partner,
      carts: world.carts,
      catalogue: world.catalogue,
      db: world.db.d1,
      clock: world.clock,
      fetch: async () => new Response("not used"),
      config: { openapiUrl: "https://example.com/openapi.json", expectedDisplayName: "Different Name", knownOrderUuid: null, checkoutHost: "partner.groupon.com" },
    };

    const steps = await check.run(ctx);
    expect(steps![0]).toMatchObject({ step: "read", verdict: "pass" });
    expect(steps![1]).toMatchObject({ step: "name", verdict: "fail" });
  });

  it("fails at active when status is not active", async () => {
    const world = makeWorld();
    world.partner.registration = { ...world.partner.registration, status: "deactivated" };
    const ctx: ProbeContext = {
      partner: world.partner,
      carts: world.carts,
      catalogue: world.catalogue,
      db: world.db.d1,
      clock: world.clock,
      fetch: async () => new Response("not used"),
      config: { openapiUrl: "https://example.com/openapi.json", expectedDisplayName: "Zora Agent Lab", knownOrderUuid: null, checkoutHost: "partner.groupon.com" },
    };

    const steps = await check.run(ctx);
    expect(steps![0]).toMatchObject({ step: "read", verdict: "pass" });
    expect(steps![1]).toMatchObject({ step: "name", verdict: "pass" });
    expect(steps![2]).toMatchObject({ step: "active", verdict: "fail" });
  });

  it("fails at urls when logoUrl is missing", async () => {
    const world = makeWorld();
    world.partner.registration = { ...world.partner.registration, logoUrl: null };
    const ctx: ProbeContext = {
      partner: world.partner,
      carts: world.carts,
      catalogue: world.catalogue,
      db: world.db.d1,
      clock: world.clock,
      fetch: async () => new Response("not used"),
      config: { openapiUrl: "https://example.com/openapi.json", expectedDisplayName: "Zora Agent Lab", knownOrderUuid: null, checkoutHost: "partner.groupon.com" },
    };

    const steps = await check.run(ctx);
    const urlsStep = steps.find((s) => s.step === "urls");
    expect(urlsStep).toMatchObject({ step: "urls", verdict: "fail" });
  });

  it("fails at urls when logoUrl does not start with https", async () => {
    const world = makeWorld();
    world.partner.registration = { ...world.partner.registration, logoUrl: "http://example.com/logo.png" };
    const ctx: ProbeContext = {
      partner: world.partner,
      carts: world.carts,
      catalogue: world.catalogue,
      db: world.db.d1,
      clock: world.clock,
      fetch: async () => new Response("not used"),
      config: { openapiUrl: "https://example.com/openapi.json", expectedDisplayName: "Zora Agent Lab", knownOrderUuid: null, checkoutHost: "partner.groupon.com" },
    };

    const steps = await check.run(ctx);
    const urlsStep = steps.find((s) => s.step === "urls");
    expect(urlsStep).toMatchObject({ step: "urls", verdict: "fail" });
  });

  it("fails at supplier when getSupplier returns an error", async () => {
    const world = makeWorld();
    world.partner.failNext("supplier", partnerError("API_ERROR"));
    const ctx: ProbeContext = {
      partner: world.partner,
      carts: world.carts,
      catalogue: world.catalogue,
      db: world.db.d1,
      clock: world.clock,
      fetch: async () => new Response("not used"),
      config: { openapiUrl: "https://example.com/openapi.json", expectedDisplayName: "Zora Agent Lab", knownOrderUuid: null, checkoutHost: "partner.groupon.com" },
    };

    const steps = await check.run(ctx);
    const supplierStep = steps.find((s) => s.step === "supplier");
    expect(supplierStep).toMatchObject({ step: "supplier", verdict: "fail" });
  });

  it("skips all steps when API key is not set", async () => {
    const world = makeWorld();
    world.partner.failNext("partners.me", partnerError("NO_KEY"));
    const ctx: ProbeContext = {
      partner: world.partner,
      carts: world.carts,
      catalogue: world.catalogue,
      db: world.db.d1,
      clock: world.clock,
      fetch: async () => new Response("not used"),
      config: { openapiUrl: "https://example.com/openapi.json", expectedDisplayName: "Zora Agent Lab", knownOrderUuid: null, checkoutHost: "partner.groupon.com" },
    };

    const steps = await check.run(ctx);
    expect(steps.every((s) => s.verdict === "skip")).toBe(true);
    expect(steps.every((s) => s.detail === "no API key yet")).toBe(true);
  });

  it("catches crashes and reports a fail", async () => {
    const world = makeWorld();
    const badPartner = {
      ...world.partner,
      getPartner: async () => {
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
      config: { openapiUrl: "https://example.com/openapi.json", expectedDisplayName: "Zora Agent Lab", knownOrderUuid: null, checkoutHost: "partner.groupon.com" },
    };

    const steps = await check.run(ctx);
    expect(steps.some((s) => s.step === "crashed")).toBe(true);
  });
});
