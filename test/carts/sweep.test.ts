/**
 * runCartSweep: per-source age, the 30-cart cap, and a summary that says how many failed.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/carts/sweep.test.ts
 * Deps:    bun:test, src/carts/index.ts, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it, spyOn } from "bun:test";
import { createCartService, runCartSweep, SWEEP_AFTER_MS } from "../../src/carts";
import type { Deps } from "../../src/contracts/ports";
import { FakeClock } from "../fakes/clock";
import { createTestDb } from "../fakes/d1";
import { makeEnv } from "../fakes/env";
import { FakePartnerClient } from "../fakes/partner";
import { FakeCatalogueStore, FakeSearchIndex, FakeShoppingService } from "../fakes/services";

function setup() {
  const clock = new FakeClock();
  const partner = new FakePartnerClient(clock);
  const db = createTestDb();
  const carts = createCartService(partner, db.d1, clock);
  const catalogue = new FakeCatalogueStore();
  const deps: Deps = {
    db: db.d1,
    clock,
    partner,
    catalogue,
    search: new FakeSearchIndex(catalogue),
    carts,
    shopping: new FakeShoppingService(),
  };
  return { clock, partner, db, carts, deps };
}

const LINE = { productId: "p-pizza-chi", optionId: "o-pizza-chi", quantity: 1, expectedPriceMinor: 2900 } as const;

describe("runCartSweep", () => {
  it("leaves a probe cart under an hour old alone, and abandons one over an hour old", async () => {
    const { clock, deps, carts, db } = setup();
    const old = await carts.create([LINE], "probe");
    if (old.kind !== "created") throw new Error("expected created");
    clock.advance(SWEEP_AFTER_MS.probe + 1);
    const young = await carts.create([{ ...LINE, optionId: "o-bowling-chi", productId: "p-bowling-chi", expectedPriceMinor: 3900 }], "probe");
    if (young.kind !== "created") throw new Error("expected created");

    const summary = await runCartSweep(deps, makeEnv());

    expect(summary.job).toBe("cart-sweep");
    expect(summary.ok).toBe(true);
    const rows = db.sqlite.query("SELECT cart_id, status FROM carts_log ORDER BY cart_id").all() as { cart_id: string; status: string }[];
    const statusOf = (id: string) => rows.find((row) => row.cart_id === id)?.status;
    expect(statusOf(old.cart.id)).toBe("abandoned");
    expect(statusOf(young.cart.id)).toBe("open");
  });

  it("uses the 24-hour threshold for web and agent-api carts", async () => {
    const { clock, deps, carts, db } = setup();
    const webCart = await carts.create([LINE], "web");
    if (webCart.kind !== "created") throw new Error("expected created");
    clock.advance(SWEEP_AFTER_MS.probe + 1); // past the probe threshold, not the web one
    await runCartSweep(deps, makeEnv());
    let row = db.sqlite.query("SELECT status FROM carts_log WHERE cart_id = ?").get(webCart.cart.id) as { status: string };
    expect(row.status).toBe("open");

    clock.advance(SWEEP_AFTER_MS.web);
    await runCartSweep(deps, makeEnv());
    row = db.sqlite.query("SELECT status FROM carts_log WHERE cart_id = ?").get(webCart.cart.id) as { status: string };
    expect(row.status).toBe("abandoned");
  });

  it("abandons at most 30 carts in one run", async () => {
    const { clock, deps, carts, db } = setup();
    for (let i = 0; i < 32; i++) {
      const outcome = await carts.create([{ ...LINE, optionId: "o-pizza-chi", productId: "p-pizza-chi" }], "monitor");
      if (outcome.kind !== "created") throw new Error("expected created");
    }
    clock.advance(SWEEP_AFTER_MS.monitor + 1);

    const summary = await runCartSweep(deps, makeEnv());

    expect(summary.summary).toContain("abandoned 30");
    const openLeft = db.sqlite.query("SELECT COUNT(*) as n FROM carts_log WHERE status = 'open'").get() as { n: number };
    expect(openLeft.n).toBe(2);
  });

  it("counts a failed abandon and reports ok: false", async () => {
    const { clock, deps, carts, db, partner } = setup();
    const outcome = await carts.create([LINE], "probe");
    if (outcome.kind !== "created") throw new Error("expected created");
    clock.advance(SWEEP_AFTER_MS.probe + 1);
    partner.failNext("carts.abandon", { code: "INTERNAL_SERVER_ERROR", message: "boom", retryable: true, shape: "flat" });
    const spy = spyOn(console, "error").mockImplementation(() => {});

    try {
      const summary = await runCartSweep(deps, makeEnv());

      expect(summary.ok).toBe(false);
      expect(summary.summary).toContain("1 failed");
      const row = db.sqlite.query("SELECT status FROM carts_log WHERE cart_id = ?").get(outcome.cart.id) as { status: string };
      expect(row.status).toBe("open");
    } finally {
      spy.mockRestore();
    }
  });

  it("logs each failed abandon and names the ids in the summary", async () => {
    const { clock, deps, carts, partner } = setup();
    const a = await carts.create([LINE], "probe");
    if (a.kind !== "created") throw new Error("expected created");
    const b = await carts.create([{ ...LINE, productId: "p-bowling-chi", optionId: "o-bowling-chi", expectedPriceMinor: 3900 }], "probe");
    if (b.kind !== "created") throw new Error("expected created");
    clock.advance(SWEEP_AFTER_MS.probe + 1);
    partner.failNext("carts.abandon", { code: "INTERNAL_SERVER_ERROR", message: "boom", retryable: true, shape: "flat" });
    partner.failNext("carts.abandon", { code: "INTERNAL_SERVER_ERROR", message: "boom", retryable: true, shape: "flat" });
    const spy = spyOn(console, "error").mockImplementation(() => {});

    try {
      const summary = await runCartSweep(deps, makeEnv());

      expect(summary.ok).toBe(false);
      expect(summary.summary).toContain("2 failed");
      expect(summary.summary).toContain(a.cart.id);
      expect(summary.summary).toContain(b.cart.id);
      expect(spy).toHaveBeenCalledTimes(2);
      const logged = JSON.parse(spy.mock.calls[0]?.[0] as string) as Record<string, unknown>;
      expect(logged.at).toBe("carts.sweep");
      expect(logged.problem).toBe("abandon failed");
      expect(logged.source).toBe("probe");
      expect(logged.code).toBe("INTERNAL_SERVER_ERROR");
      expect(typeof logged.cartId).toBe("string");
      expect(typeof logged.requestId).toBe("string");
    } finally {
      spy.mockRestore();
    }
  });

  it("names at most five failed cart ids in the summary", async () => {
    const { clock, deps, carts, partner } = setup();
    const created: string[] = [];
    for (let i = 0; i < 7; i++) {
      const outcome = await carts.create([{ ...LINE, optionId: `o-pizza-chi`, productId: "p-pizza-chi" }], "probe");
      if (outcome.kind !== "created") throw new Error("expected created");
      created.push(outcome.cart.id);
    }
    clock.advance(SWEEP_AFTER_MS.probe + 1);
    for (let i = 0; i < 7; i++) partner.failNext("carts.abandon", { code: "INTERNAL_SERVER_ERROR", message: "boom", retryable: true, shape: "flat" });
    const spy = spyOn(console, "error").mockImplementation(() => {});

    try {
      const summary = await runCartSweep(deps, makeEnv());
      expect(summary.summary).toContain("7 failed");
      for (const id of created.slice(0, 5)) expect(summary.summary).toContain(id);
      for (const id of created.slice(5)) expect(summary.summary).not.toContain(id);
    } finally {
      spy.mockRestore();
    }
  });
});
