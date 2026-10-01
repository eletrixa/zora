/**
 * createPartnerClient against a scripted Fetch: headers, pacing, timeouts, the three error-body
 * shapes, the retry policy, and that the key never leaks.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/partner/index.test.ts
 * Deps:    bun:test, src/partner/index.ts, test/fakes/clock.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import type { Fetch, Pacer, PartnerConfig } from "../../src/contracts/ports";
import { createPartnerClient } from "../../src/partner/index";
import { FakeClock } from "../fakes/clock";
import { FAKE_KEY } from "../fakes/partner";

interface RecordedRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

interface ScriptedResponse {
  readonly status: number;
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
}

/** A Fetch that answers from a script, one entry per call (the last entry repeats after that). */
function scriptedFetch(responses: readonly ScriptedResponse[], calls: RecordedRequest[] = []): { fetch: Fetch; calls: RecordedRequest[] } {
  let index = 0;
  const fetch: Fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.toString();
    const headers: Record<string, string> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new Headers(init.headers as any).forEach((value, key) => {
      headers[key] = value;
    });
    const bodyText = typeof init.body === "string" ? init.body : undefined;
    calls.push({ method: init.method ?? "GET", url, headers, body: bodyText ? JSON.parse(bodyText) : undefined });
    const scripted = responses[Math.min(index, responses.length - 1)]!;
    index++;
    const body = scripted.body === undefined ? "" : JSON.stringify(scripted.body);
    return new Response(body, { status: scripted.status, headers: scripted.headers });
  };
  return { fetch, calls };
}

/** A Fetch that always rejects, as fetch does on a network failure or an aborted signal. */
function throwingFetch(name: string): Fetch {
  return async () => {
    throw Object.assign(new Error(name), { name });
  };
}

function makeConfig(overrides: Partial<PartnerConfig> = {}): PartnerConfig {
  return {
    baseUrl: "https://api.enc.groupon.com",
    apiKey: FAKE_KEY,
    userAgent: "zal-test/1.0 (+https://zorasocial.asajj.cz)",
    minIntervalMs: 1_000,
    timeoutMs: 5_000,
    ...overrides,
  };
}

const CART_BODY = { id: "cart-1", buyLink: "https://partner.groupon.com/checkout/cart/cart-1", items: [], totals: {} };

describe("createPartnerClient headers", () => {
  it("sends g-api-key, user-agent, accept and a fresh x-request-id, country=US as a query on a read", async () => {
    const { fetch, calls } = scriptedFetch([{ status: 200, body: { id: "groupon", name: "Groupon", endpoint: "x" } }]);
    const client = createPartnerClient(makeConfig(), new FakeClock(), fetch);
    await client.getSupplier();
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call!.headers["g-api-key"]).toBe(FAKE_KEY);
    expect(call!.headers["user-agent"]).toBe("zal-test/1.0 (+https://zorasocial.asajj.cz)");
    expect(call!.headers.accept).toBe("application/json");
    expect(call!.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(call!.headers.authorization).toBeUndefined();
  });

  it("sends country=US as a query on products.list and in the body on a cart write", async () => {
    const { fetch, calls } = scriptedFetch([
      { status: 200, body: { products: [], hasMore: false, timestamp: "2026-10-01T00:00:00Z" } },
      { status: 200, body: CART_BODY },
    ]);
    const client = createPartnerClient(makeConfig(), new FakeClock(), fetch);
    await client.listProducts({});
    await client.createCart([{ productId: "p1", optionId: "o1", quantity: 1 }]);
    expect(new URL(calls[0]!.url).searchParams.get("country")).toBe("US");
    expect(calls[1]!.body).toMatchObject({ country: "US" });
  });
});

describe("createPartnerClient NO_KEY", () => {
  it("sends nothing when config.apiKey is empty", async () => {
    const { fetch, calls } = scriptedFetch([{ status: 200, body: {} }]);
    const client = createPartnerClient(makeConfig({ apiKey: "" }), new FakeClock(), fetch);
    const result = await client.getPartner();
    expect(calls).toHaveLength(0);
    expect(result).toEqual({
      ok: false,
      error: { code: "NO_KEY", message: "no API key configured", retryable: false, shape: "none" },
      meta: { endpoint: "partners.me", requestId: "", httpStatus: null, latencyMs: 0, attempts: 0 },
    });
  });
});

describe("createPartnerClient pacing", () => {
  it("sleeps so two requests start at least minIntervalMs apart", async () => {
    const { fetch } = scriptedFetch([{ status: 200, body: { id: "groupon", name: "Groupon", endpoint: "x" } }]);
    const clock = new FakeClock();
    const client = createPartnerClient(makeConfig({ minIntervalMs: 1_000 }), clock, fetch);
    await client.getSupplier();
    await client.getSupplier();
    expect(clock.sleeps).toContain(1_000);
  });

  it("shares a pacer across clients so calls started together still queue up", async () => {
    const { fetch } = scriptedFetch([
      { status: 200, body: { id: "groupon", name: "Groupon", endpoint: "x" } },
      { status: 200, body: { id: "groupon", name: "Groupon", endpoint: "x" } },
      { status: 200, body: { id: "groupon", name: "Groupon", endpoint: "x" } },
    ]);
    const clock = new FakeClock();
    const pacer: Pacer = { nextFreeAt: -Infinity };
    const clientA = createPartnerClient(makeConfig({ minIntervalMs: 1_000, pacer }), clock, fetch);
    const clientB = createPartnerClient(makeConfig({ minIntervalMs: 1_000, pacer }), clock, fetch);
    await Promise.all([clientA.getSupplier(), clientB.getSupplier(), clientA.getSupplier()]);
    // Three slots 1000 ms apart (0, 1000, 2000 on the shared clock); only the two later
    // calls actually wait, each for the 1000 ms gap since the previous slot was reserved.
    expect(clock.sleeps).toEqual([1_000, 1_000]);
  });

  it("does not pace two clients against each other when no pacer is shared", async () => {
    const { fetch } = scriptedFetch([
      { status: 200, body: { id: "groupon", name: "Groupon", endpoint: "x" } },
      { status: 200, body: { id: "groupon", name: "Groupon", endpoint: "x" } },
    ]);
    const clock = new FakeClock();
    const clientA = createPartnerClient(makeConfig({ minIntervalMs: 1_000 }), clock, fetch);
    const clientB = createPartnerClient(makeConfig({ minIntervalMs: 1_000 }), clock, fetch);
    await Promise.all([clientA.getSupplier(), clientB.getSupplier()]);
    expect(clock.sleeps).toEqual([]);
  });
});

describe("createPartnerClient error shapes", () => {
  it("reads Shape A (flat): body.error", async () => {
    const { fetch } = scriptedFetch([{ status: 400, body: { error: "FORBIDDEN", errorMessage: "not registered", requestId: "r1" } }]);
    const client = createPartnerClient(makeConfig(), new FakeClock(), fetch);
    const result = await client.getSupplier();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error).toMatchObject({ code: "FORBIDDEN", shape: "flat", retryable: false });
  });

  it("reads Shape B (envelope): body.details.error, and carries PRICE_MISMATCH's currentPrice", async () => {
    const { fetch } = scriptedFetch([
      {
        status: 409,
        body: { code: "aborted", message: "Displayed price no longer valid", details: { error: "PRICE_MISMATCH", errorMessage: "price changed", currentPrice: 4900 } },
      },
    ]);
    const client = createPartnerClient(makeConfig(), new FakeClock(), fetch);
    const result = await client.updateCartItem("cart-1", "item-1", 2, 4500);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error).toMatchObject({ code: "PRICE_MISMATCH", shape: "envelope", retryable: false, currentPrice: 4900 });
  });

  it("reads Shape C (auth): body.code, no error field and no requestId", async () => {
    const { fetch } = scriptedFetch([{ status: 401, body: { code: "unauthenticated", message: "bad key", details: null } }]);
    const client = createPartnerClient(makeConfig(), new FakeClock(), fetch);
    const result = await client.getSupplier();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error).toMatchObject({ code: "unauthenticated", shape: "auth", retryable: false });
  });
});

describe("createPartnerClient retry policy", () => {
  it("retries HTTP 400 INTERNAL_SERVER_ERROR and then succeeds", async () => {
    const { fetch } = scriptedFetch([
      { status: 400, body: { error: "INTERNAL_SERVER_ERROR", errorMessage: "boom", requestId: "r1" } },
      { status: 200, body: { id: "groupon", name: "Groupon", endpoint: "x" } },
    ]);
    const clock = new FakeClock();
    const client = createPartnerClient(makeConfig(), clock, fetch);
    const result = await client.getSupplier();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.meta.attempts).toBe(2);
    expect(clock.sleeps).toContain(2_000);
  });

  it("gives up after five tries with attempts: 5", async () => {
    const failure = { status: 400, body: { error: "INTERNAL_SERVER_ERROR", errorMessage: "boom", requestId: "r1" } };
    const { fetch } = scriptedFetch([failure, failure, failure, failure, failure]);
    const clock = new FakeClock();
    const client = createPartnerClient(makeConfig(), clock, fetch);
    const result = await client.getSupplier();
    expect(result.ok).toBe(false);
    expect(result.meta.attempts).toBe(5);
    expect(clock.sleeps).toEqual([2_000, 4_000, 8_000, 16_000]);
  });

  it("waits at least Retry-After before the next try", async () => {
    const { fetch } = scriptedFetch([
      { status: 429, headers: { "retry-after": "5" }, body: { error: "RATE_LIMITED", errorMessage: "slow down", requestId: "r1" } },
      { status: 200, body: { id: "groupon", name: "Groupon", endpoint: "x" } },
    ]);
    const clock = new FakeClock();
    const client = createPartnerClient(makeConfig(), clock, fetch);
    const result = await client.getSupplier();
    expect(result.ok).toBe(true);
    expect(clock.sleeps).toContain(5_000);
  });

  it("never retries addCartItems, even after a timeout", async () => {
    const client = createPartnerClient(makeConfig(), new FakeClock(), throwingFetch("TimeoutError"));
    const result = await client.addCartItems("cart-1", [{ productId: "p1", optionId: "o1", quantity: 1 }]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("TIMEOUT");
    expect(result.meta.attempts).toBe(1);
  });

  it("never retries raw", async () => {
    const failure = { status: 500, body: { error: "INTERNAL_SERVER_ERROR", errorMessage: "boom", requestId: "r1" } };
    const success = { status: 200, body: { ok: true } };
    const { fetch, calls } = scriptedFetch([failure, success]);
    const client = createPartnerClient(makeConfig(), new FakeClock(), fetch);
    const result = await client.raw({ method: "GET", path: "/octo-gateway/v1/products", auth: "key" });
    expect(calls).toHaveLength(1);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success shape");
    expect(result.value.httpStatus).toBe(500);
    expect(result.value.body).toEqual(failure.body);
  });

  it("retries listProducts on the general schedule", async () => {
    const failure = { status: 400, body: { error: "INTERNAL_SERVER_ERROR", errorMessage: "boom", requestId: "r1" } };
    const { fetch } = scriptedFetch([failure, failure, failure, failure, failure]);
    const clock = new FakeClock();
    const client = createPartnerClient(makeConfig(), clock, fetch);
    const result = await client.listProducts({});
    expect(result.ok).toBe(false);
    expect(result.meta.attempts).toBe(5);
    expect(clock.sleeps).toEqual([2_000, 4_000, 8_000, 16_000]);
  });

  it("retries getBooking on the guide's polling schedule (2, 4, 8, 15, 30 s), not the general one", async () => {
    const failure = { status: 400, body: { error: "INTERNAL_SERVER_ERROR", errorMessage: "boom", requestId: "r1" } };
    const { fetch } = scriptedFetch([failure, failure, failure, failure, failure]);
    const clock = new FakeClock();
    const client = createPartnerClient(makeConfig(), clock, fetch);
    const result = await client.getBooking("5d0c2f3a-8b1e-4c7d-a9f0-1e2d3c4b5a69");
    expect(result.ok).toBe(false);
    expect(result.meta.attempts).toBe(5);
    expect(clock.sleeps).toEqual([2_000, 4_000, 8_000, 15_000, 30_000].slice(0, 4));
  });
});

describe("createPartnerClient UNPARSEABLE", () => {
  it("reports UNPARSEABLE when a 2xx body is missing a required field", async () => {
    const { fetch } = scriptedFetch([{ status: 200, body: { hasMore: false } }]);
    const client = createPartnerClient(makeConfig(), new FakeClock(), fetch);
    const result = await client.listProducts({});
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("UNPARSEABLE");
    expect(result.error.retryable).toBe(false);
  });
});

describe("createPartnerClient raw()", () => {
  it("sends the key header for auth: key, a bearer header for auth: bearer, and nothing for auth: none", async () => {
    const { fetch, calls } = scriptedFetch([{ status: 200, body: {} }, { status: 200, body: {} }, { status: 200, body: {} }]);
    const client = createPartnerClient(makeConfig(), new FakeClock(), fetch);
    await client.raw({ method: "GET", path: "/octo-gateway/v1/partners/me", auth: "key" });
    await client.raw({ method: "GET", path: "/octo-gateway/v1/partners/me", auth: "bearer" });
    await client.raw({ method: "GET", path: "/octo-gateway/v1/partners/me", auth: "none" });
    expect(calls[0]!.headers["g-api-key"]).toBe(FAKE_KEY);
    expect(calls[1]!.headers.authorization).toBe(`Bearer ${FAKE_KEY}`);
    expect(calls[2]!.headers["g-api-key"]).toBeUndefined();
    expect(calls[2]!.headers.authorization).toBeUndefined();
  });

  it("answers NO_KEY without a request when auth is key and the key is empty", async () => {
    const { fetch, calls } = scriptedFetch([{ status: 200, body: {} }]);
    const client = createPartnerClient(makeConfig({ apiKey: "" }), new FakeClock(), fetch);
    const result = await client.raw({ method: "GET", path: "/octo-gateway/v1/partners/me", auth: "key" });
    expect(calls).toHaveLength(0);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("NO_KEY");
  });
});

describe("createPartnerClient key secrecy", () => {
  it("never puts the key in an error, its message or the call meta", async () => {
    const { fetch } = scriptedFetch([{ status: 401, body: { code: "unauthenticated", message: "bad key", details: null } }]);
    const client = createPartnerClient(makeConfig(), new FakeClock(), fetch);
    const result = await client.getSupplier();
    const dumped = JSON.stringify(result);
    expect(dumped.includes(FAKE_KEY)).toBe(false);
  });
});

describe("createPartnerClient BUSY (a queue longer than maxWaitMs)", () => {
  // FakeClock.sleep() advances its own time the instant it is called (see test/fakes/clock.ts),
  // before the caller's `await` even resumes. A burst of same-pacer calls kicked off together
  // therefore always sees exactly minIntervalMs of wait relative to its own `clock.now()` at the
  // moment it checks in, because the previous call's sleep has already fast-forwarded the shared
  // clock to that call's own start: the gap can never accumulate past minIntervalMs inside one
  // Promise.all burst. A real Clock (setTimeout-backed) would not do this: two calls fired at the
  // same wall-clock instant both read close to the same `now`, so waits genuinely stack up as
  // 0, 1000, 2000, ... and a late arrival can see a queue longer than maxWaitMs. These tests seed
  // `Pacer.nextFreeAt` directly to stand in for "other calls already queued", which drives the
  // exact same #pace()/#attempt code path deterministically without fighting FakeClock's fast
  // forward, plus one Promise.all test that exercises the ordinary (non-busy) queueing path.

  it("answers BUSY without sending when the next slot is further than maxWaitMs away", async () => {
    const clock = new FakeClock();
    const pacer: Pacer = { nextFreeAt: clock.now() + 3_001 };
    const { fetch, calls } = scriptedFetch([{ status: 200, body: { id: "groupon", name: "Groupon", endpoint: "x" } }]);
    const client = createPartnerClient(makeConfig({ minIntervalMs: 1_000, maxWaitMs: 3_000, pacer }), clock, fetch);
    const before = pacer.nextFreeAt;
    const result = await client.getSupplier();
    expect(calls).toHaveLength(0);
    expect(pacer.nextFreeAt).toBe(before);
    expect(result).toEqual({
      ok: false,
      error: { code: "BUSY", message: "the queue to the partner API is too long", retryable: false, shape: "none" },
      meta: { endpoint: "supplier", requestId: "", httpStatus: null, latencyMs: 0, attempts: 1 },
    });
  });

  it("still sends when the next slot is exactly maxWaitMs away", async () => {
    const clock = new FakeClock();
    const pacer: Pacer = { nextFreeAt: clock.now() + 3_000 };
    const { fetch, calls } = scriptedFetch([{ status: 200, body: { id: "groupon", name: "Groupon", endpoint: "x" } }]);
    const client = createPartnerClient(makeConfig({ minIntervalMs: 1_000, maxWaitMs: 3_000, pacer }), clock, fetch);
    const result = await client.getSupplier();
    expect(calls).toHaveLength(1);
    expect(result.ok).toBe(true);
  });

  it("defaults maxWaitMs to 15000 when it is omitted", async () => {
    const clock = new FakeClock();
    const pacer: Pacer = { nextFreeAt: clock.now() + 15_001 };
    const { fetch, calls } = scriptedFetch([{ status: 200, body: { id: "groupon", name: "Groupon", endpoint: "x" } }]);
    const client = createPartnerClient(makeConfig({ minIntervalMs: 1_000, pacer }), clock, fetch);
    const result = await client.getSupplier();
    expect(calls).toHaveLength(0);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("BUSY");
  });

  it("lets a new call through once the clock catches up to a queue that used to be full", async () => {
    const clock = new FakeClock();
    const pacer: Pacer = { nextFreeAt: clock.now() + 10_000 };
    const { fetch, calls } = scriptedFetch([{ status: 200, body: { id: "groupon", name: "Groupon", endpoint: "x" } }]);
    const client = createPartnerClient(makeConfig({ minIntervalMs: 1_000, maxWaitMs: 3_000, pacer }), clock, fetch);
    const busy = await client.getSupplier();
    if (busy.ok) throw new Error("expected BUSY");
    expect(busy.error.code).toBe("BUSY");
    expect(calls).toHaveLength(0);

    clock.advance(9_000); // the reserved slot is now only 1000 ms out: inside maxWaitMs again
    const ok = await client.getSupplier();
    expect(ok.ok).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("ends a retry with BUSY, instead of waiting, when the queue fills up during the backoff", async () => {
    const clock = new FakeClock();
    const pacer: Pacer = { nextFreeAt: -Infinity };
    let fetchCalls = 0;
    const fetchImpl: Fetch = async () => {
      fetchCalls++;
      // Stand in for other traffic reserving the pacer's later slots while this call backs off.
      pacer.nextFreeAt = clock.now() + 10_000;
      return new Response(JSON.stringify({ error: "INTERNAL_SERVER_ERROR", errorMessage: "boom", requestId: "r1" }), { status: 400 });
    };
    const client = createPartnerClient(makeConfig({ minIntervalMs: 1_000, maxWaitMs: 3_000, pacer }), clock, fetchImpl);
    const result = await client.getSupplier();
    expect(fetchCalls).toBe(1); // the retry never reached fetch: it hit BUSY in #pace() first
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("BUSY");
    expect(result.meta.attempts).toBe(2);
  });

  it("raw() answers BUSY too, without sending, when the queue is full", async () => {
    const clock = new FakeClock();
    const pacer: Pacer = { nextFreeAt: clock.now() + 10_000 };
    const { fetch, calls } = scriptedFetch([{ status: 200, body: {} }]);
    const client = createPartnerClient(makeConfig({ minIntervalMs: 1_000, maxWaitMs: 3_000, pacer }), clock, fetch);
    const result = await client.raw({ method: "GET", path: "/octo-gateway/v1/partners/me", auth: "key" });
    expect(calls).toHaveLength(0);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("BUSY");
    expect(result.meta.attempts).toBe(1);
  });

  it("queues concurrent calls on a shared pacer instead of sending them all at once", async () => {
    const { fetch, calls } = scriptedFetch([
      { status: 200, body: { id: "groupon", name: "Groupon", endpoint: "x" } },
      { status: 200, body: { id: "groupon", name: "Groupon", endpoint: "x" } },
      { status: 200, body: { id: "groupon", name: "Groupon", endpoint: "x" } },
    ]);
    const clock = new FakeClock();
    const pacer: Pacer = { nextFreeAt: -Infinity };
    const config = makeConfig({ minIntervalMs: 1_000, maxWaitMs: 3_000, pacer });
    const clientA = createPartnerClient(config, clock, fetch);
    const clientB = createPartnerClient(config, clock, fetch);
    const results = await Promise.all([clientA.getSupplier(), clientB.getSupplier(), clientA.getSupplier()]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(calls).toHaveLength(3);
  });
});
