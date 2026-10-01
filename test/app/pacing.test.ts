/**
 * Pacing of the partner client when callers really arrive together. The lane's own tests use
 * FakeClock, whose sleep moves time at once, so a burst never queues there; this test parks
 * the sleepers as a real clock would.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/app/pacing.test.ts
 * Deps:    bun:test, src/partner/index.ts, test/fakes/clock.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import type { Fetch, Pacer, PartnerConfig } from "../../src/contracts/ports";
import { createPartnerClient } from "../../src/partner";
import { FIXED_START, QueueClock } from "../fakes/clock";

const page = JSON.stringify({ products: [], hasMore: false, nextCursor: null, timestamp: "2026-10-01T00:00:00.000Z", requestId: "r" });

function setup(maxWaitMs?: number) {
  const clock = new QueueClock();
  const pacer: Pacer = { nextFreeAt: 0 };
  const startedAt: number[] = [];
  const fetchImpl: Fetch = async () => {
    startedAt.push(clock.now() - FIXED_START);
    return new Response(page, { status: 200, headers: { "content-type": "application/json" } });
  };
  const config: PartnerConfig = { baseUrl: "https://api.example.test", apiKey: "k".repeat(70), userAgent: "test", minIntervalMs: 1000, timeoutMs: 30_000, pacer, ...(maxWaitMs === undefined ? {} : { maxWaitMs }) };
  // A new client per call, as the Worker builds one per request; only the pacer is shared.
  const call = () => createPartnerClient(config, clock, fetchImpl).listProducts({ limit: 1 });
  return { clock, pacer, startedAt, call };
}

describe("partner pacing under a burst", () => {
  it("starts requests that arrive together one second apart", async () => {
    const { clock, startedAt, call } = setup();
    const all = Promise.all([call(), call(), call(), call()]);
    await clock.drain();
    const results = await all;
    expect(results.every((result) => result.ok)).toBe(true);
    expect(startedAt).toEqual([0, 1000, 2000, 3000]);
  });

  it("answers BUSY to the caller whose wait would pass the bound, and sends nothing for it", async () => {
    const { clock, pacer, startedAt, call } = setup(3000);
    const all = Promise.all([call(), call(), call(), call(), call()]);
    await clock.drain();
    const results = await all;
    expect(results.map((result) => (result.ok ? "sent" : result.error.code))).toEqual(["sent", "sent", "sent", "sent", "BUSY"]);
    expect(startedAt).toEqual([0, 1000, 2000, 3000]);
    expect(pacer.nextFreeAt - FIXED_START).toBe(4000);
  });

  it("never lets a burst of fifty queue anyone for longer than the default fifteen seconds", async () => {
    const { clock, startedAt, call } = setup();
    const all = Promise.all(Array.from({ length: 50 }, () => call()));
    await clock.drain();
    const results = await all;
    expect(results.filter((result) => result.ok)).toHaveLength(16);
    expect(results.filter((result) => !result.ok && result.error.code === "BUSY")).toHaveLength(34);
    expect(Math.max(...startedAt)).toBe(15_000);
  });
});
