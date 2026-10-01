/**
 * Tests for the openapi-drift probe check.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/probe/checks/openapi-drift.test.ts
 * Deps:    bun:test, src/probe/checks/openapi-drift.ts, test/fakes/*
 * Tested:  src/probe/checks/openapi-drift.ts
 */
import { describe, expect, it } from "bun:test";
import { check } from "../../../src/probe/checks/openapi-drift";
import type { ProbeContext, Fetch } from "../../../src/contracts/ports";
import { makeWorld } from "../../fakes/env";

describe("openapi-drift check", () => {
  it("passes fetch and hash when openapi is valid and no snapshot exists", async () => {
    const world = makeWorld();
    const fakeFetch: Fetch = async () => new Response(JSON.stringify({ paths: {} }), { status: 200 });
    const ctx: ProbeContext = {
      partner: world.partner,
      carts: world.carts,
      catalogue: world.catalogue,
      db: world.db.d1,
      clock: world.clock,
      fetch: fakeFetch,
      config: { openapiUrl: "https://api.example.com/openapi.json", expectedDisplayName: "test", knownOrderUuid: null, checkoutHost: "partner.groupon.com" },
    };

    const steps = await check.run(ctx);
    expect(steps).toHaveLength(2);
    expect(steps![0]).toMatchObject({ step: "fetch", verdict: "pass" });
    expect(steps![1]).toMatchObject({ step: "hash", verdict: "pass" });
    expect(steps![1]!.observed).toBeDefined();
    expect(steps![1]!.observed?.kind).toBe("openapi");
  });

  it("fails fetch when status is not 200", async () => {
    const world = makeWorld();
    const fakeFetch: Fetch = async () => new Response("not found", { status: 404 });
    const ctx: ProbeContext = {
      partner: world.partner,
      carts: world.carts,
      catalogue: world.catalogue,
      db: world.db.d1,
      clock: world.clock,
      fetch: fakeFetch,
      config: { openapiUrl: "https://api.example.com/openapi.json", expectedDisplayName: "test", knownOrderUuid: null, checkoutHost: "partner.groupon.com" },
    };

    const steps = await check.run(ctx);
    expect(steps![0]).toMatchObject({ step: "fetch", verdict: "fail", httpStatus: 404 });
  });

  it("fails fetch when response is not valid JSON", async () => {
    const world = makeWorld();
    const fakeFetch: Fetch = async () => new Response("not json", { status: 200 });
    const ctx: ProbeContext = {
      partner: world.partner,
      carts: world.carts,
      catalogue: world.catalogue,
      db: world.db.d1,
      clock: world.clock,
      fetch: fakeFetch,
      config: { openapiUrl: "https://api.example.com/openapi.json", expectedDisplayName: "test", knownOrderUuid: null, checkoutHost: "partner.groupon.com" },
    };

    const steps = await check.run(ctx);
    expect(steps![0]).toMatchObject({ step: "fetch", verdict: "fail" });
  });

  it("fails fetch when JSON has no paths object", async () => {
    const world = makeWorld();
    const fakeFetch: Fetch = async () => new Response(JSON.stringify({ info: {} }), { status: 200 });
    const ctx: ProbeContext = {
      partner: world.partner,
      carts: world.carts,
      catalogue: world.catalogue,
      db: world.db.d1,
      clock: world.clock,
      fetch: fakeFetch,
      config: { openapiUrl: "https://api.example.com/openapi.json", expectedDisplayName: "test", knownOrderUuid: null, checkoutHost: "partner.groupon.com" },
    };

    const steps = await check.run(ctx);
    expect(steps![0]).toMatchObject({ step: "fetch", verdict: "fail" });
  });

  it("fails hash when hash differs from snapshot", async () => {
    const world = makeWorld();
    const fakeFetch: Fetch = async () => new Response(JSON.stringify({ paths: {} }), { status: 200 });

    // Insert a snapshot with a different hash
    await world.db.d1.prepare("INSERT INTO contract_snapshots (kind, value, observed_at) VALUES (?1, ?2, ?3)").bind("openapi", "oldHash123456789", world.clock.now()).run();

    const ctx: ProbeContext = {
      partner: world.partner,
      carts: world.carts,
      catalogue: world.catalogue,
      db: world.db.d1,
      clock: world.clock,
      fetch: fakeFetch,
      config: { openapiUrl: "https://api.example.com/openapi.json", expectedDisplayName: "test", knownOrderUuid: null, checkoutHost: "partner.groupon.com" },
    };

    const steps = await check.run(ctx);
    expect(steps![0]).toMatchObject({ step: "fetch", verdict: "pass" });
    expect(steps![1]).toMatchObject({ step: "hash", verdict: "fail" });
  });

  it("includes first 12 chars of hashes in fail detail", async () => {
    const world = makeWorld();
    const fakeFetch: Fetch = async () => new Response(JSON.stringify({ paths: {} }), { status: 200 });

    await world.db.d1.prepare("INSERT INTO contract_snapshots (kind, value, observed_at) VALUES (?1, ?2, ?3)").bind("openapi", "0123456789abcdef", world.clock.now()).run();

    const ctx: ProbeContext = {
      partner: world.partner,
      carts: world.carts,
      catalogue: world.catalogue,
      db: world.db.d1,
      clock: world.clock,
      fetch: fakeFetch,
      config: { openapiUrl: "https://api.example.com/openapi.json", expectedDisplayName: "test", knownOrderUuid: null, checkoutHost: "partner.groupon.com" },
    };

    const steps = await check.run(ctx);
    expect(steps![1]!.detail).toContain("0123456789ab"); // 12 chars from the old hash
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
      fetch: async () => new Response(JSON.stringify({ paths: {} }), { status: 200 }),
      config: { openapiUrl: "https://api.example.com/openapi.json", expectedDisplayName: "test", knownOrderUuid: null, checkoutHost: "partner.groupon.com" },
    };

    const steps = await check.run(ctx);
    expect(steps.some((s) => s.step === "crashed")).toBe(true);
  });

  it("sends user-agent header in fetch", async () => {
    const world = makeWorld();
    let userAgent: string | null = null;
    const fakeFetch: Fetch = async (input: string | URL | Request, init?: RequestInit) => {
      if (input instanceof Request) {
        userAgent = input.headers.get("user-agent");
      } else if (init && init.headers) {
        const headers = init.headers as Record<string, string>;
        userAgent = headers["user-agent"] || null;
      }
      return new Response(JSON.stringify({ paths: {} }), { status: 200 });
    };

    const ctx: ProbeContext = {
      partner: world.partner,
      carts: world.carts,
      catalogue: world.catalogue,
      db: world.db.d1,
      clock: world.clock,
      fetch: fakeFetch,
      config: { openapiUrl: "https://api.example.com/openapi.json", expectedDisplayName: "test", knownOrderUuid: null, checkoutHost: "partner.groupon.com" },
    };

    await check.run(ctx);
    expect(userAgent).toBeDefined();
  });
});
