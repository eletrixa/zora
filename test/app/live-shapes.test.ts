/**
 * Shapes seen on the live API that differ from the guide. Each case pins the workaround.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/app/live-shapes.test.ts
 * Deps:    bun:test, src/partner/index.ts, test/fakes/clock.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import type { Fetch, PartnerConfig } from "../../src/contracts/ports";
import { createPartnerClient } from "../../src/partner";
import { FIXED_START, FakeClock } from "../fakes/clock";

const config: PartnerConfig = { baseUrl: "https://api.example.test", apiKey: "k".repeat(70), userAgent: "test", minIntervalMs: 0, timeoutMs: 30_000 };
const json = (body: unknown): Fetch => async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

describe("a products page without a timestamp (live API, 2026-09-30)", () => {
  it("is accepted, with the time of receipt as the page time", async () => {
    const clock = new FakeClock();
    const client = createPartnerClient(config, clock, json({ hasMore: true, nextCursor: "abc", products: [] }));
    const result = await client.listProducts({ limit: 2 });
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.timestamp).toBe(new Date(FIXED_START).toISOString());
    expect(result.ok && result.value.nextCursor).toBe("abc");
  });
  it("still prefers the server's timestamp when one comes", async () => {
    const client = createPartnerClient(config, new FakeClock(), json({ hasMore: false, nextCursor: null, products: [], timestamp: "2026-10-01T12:00:00.000Z" }));
    const result = await client.listProducts({});
    expect(result.ok && result.value.timestamp).toBe("2026-10-01T12:00:00.000Z");
  });
  it("still refuses a page without products or hasMore", async () => {
    const client = createPartnerClient(config, new FakeClock(), json({ nextCursor: null }));
    const result = await client.listProducts({});
    expect(!result.ok && result.error.code).toBe("UNPARSEABLE");
  });
});
