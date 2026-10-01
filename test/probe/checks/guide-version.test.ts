/**
 * Tests for the guide-version probe check.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/probe/checks/guide-version.test.ts
 * Deps:    bun:test, src/probe/checks/guide-version.ts, test/fakes/*
 * Tested:  src/probe/checks/guide-version.ts
 */
import { describe, expect, it } from "bun:test";
import { check } from "../../../src/probe/checks/guide-version";
import type { ProbeContext } from "../../../src/contracts/ports";
import { makeWorld } from "../../fakes/env";

describe("guide-version check", () => {
  it("passes version when fresh observation has a version", async () => {
    const world = makeWorld();
    const now = world.clock.now();
    const observedAt = new Date(now).toISOString();
    await world.db.d1
      .prepare("INSERT INTO guide_observations (source_url, version, http_status, observed_at, collector) VALUES (?1, ?2, ?3, ?4, ?5)")
      .bind("https://guide.example.com", "v7.1.0", 200, observedAt, "test-collector")
      .run();

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
    expect(steps).toHaveLength(2);
    expect(steps![0]).toMatchObject({ step: "fresh", verdict: "pass" });
    expect(steps![1]).toMatchObject({ step: "version", verdict: "pass" });
    expect(steps![1]!.observed).toBeDefined();
    expect(steps![1]!.observed?.kind).toBe("guide");
    expect(steps![1]!.observed?.value).toBe("v7.1.0");
  });

  it("skips when no observations exist", async () => {
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
    expect(steps![0]).toMatchObject({ step: "fresh", verdict: "skip", detail: "no guide reading in the last 48 hours" });
  });

  it("skips when newest observation is older than 48 hours", async () => {
    const world = makeWorld();
    const now = world.clock.now();
    const old = new Date(now - 49 * 3600_000).toISOString(); // 49 hours ago
    await world.db.d1
      .prepare("INSERT INTO guide_observations (source_url, version, http_status, observed_at, collector) VALUES (?1, ?2, ?3, ?4, ?5)")
      .bind("https://guide.example.com", "v7.0.0", 200, old, "test-collector")
      .run();

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
    expect(steps![0]).toMatchObject({ step: "fresh", verdict: "skip" });
  });

  it("fails version when version is null", async () => {
    const world = makeWorld();
    const now = world.clock.now();
    const observedAt = new Date(now).toISOString();
    await world.db.d1
      .prepare("INSERT INTO guide_observations (source_url, version, http_status, observed_at, collector) VALUES (?1, ?2, ?3, ?4, ?5)")
      .bind("https://guide.example.com", null, 500, observedAt, "test-collector")
      .run();

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
    expect(steps![0]).toMatchObject({ step: "fresh", verdict: "pass" });
    expect(steps![1]).toMatchObject({ step: "version", verdict: "fail" });
    expect(steps![1]!.detail).toContain("HTTP 500");
  });

  it("fails version when it differs from snapshot", async () => {
    const world = makeWorld();
    const now = world.clock.now();
    const observedAt = new Date(now).toISOString();
    await world.db.d1
      .prepare("INSERT INTO guide_observations (source_url, version, http_status, observed_at, collector) VALUES (?1, ?2, ?3, ?4, ?5)")
      .bind("https://guide.example.com", "v7.1.0", 200, observedAt, "test-collector")
      .run();

    await world.db.d1
      .prepare("INSERT INTO contract_snapshots (kind, value, observed_at) VALUES (?1, ?2, ?3)")
      .bind("guide", "v7.0.0", new Date(now - 3600_000).toISOString())
      .run();

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
    expect(steps![1]).toMatchObject({ step: "version", verdict: "fail" });
    expect(steps![1]!.detail).toContain("v7.0.0");
    expect(steps![1]!.detail).toContain("v7.1.0");
  });

  it("catches crashes and reports a fail", async () => {
    const world = makeWorld();
    const badDb = {
      ...world.db.d1,
      prepare: () => {
        throw new Error("db error");
      },
    };
    const ctx: ProbeContext = {
      partner: world.partner,
      carts: world.carts,
      catalogue: world.catalogue,
      db: badDb as any,
      clock: world.clock,
      fetch: async () => new Response("not used"),
      config: { openapiUrl: "https://example.com/openapi.json", expectedDisplayName: "test", knownOrderUuid: null, checkoutHost: "partner.groupon.com" },
    };

    const steps = await check.run(ctx);
    expect(steps.some((s) => s.step === "crashed")).toBe(true);
  });
});
