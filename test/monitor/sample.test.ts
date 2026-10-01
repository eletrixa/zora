/**
 * The daily cart sample: writes one row per sampled option, abandons every cart it opens, and
 * runs at most once per UTC day.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/monitor/sample.test.ts
 * Deps:    bun:test, src/monitor/sample.ts, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it, spyOn } from "bun:test";
import { runCartSample } from "../../src/monitor/sample";
import { makeEnv, makeWorld } from "../fakes/env";
import { partnerError } from "../fakes/partner";

interface Row {
  readonly day: string;
  readonly product_id: string;
  readonly option_id: string;
  readonly outcome: string;
  readonly cart_id: string | null;
  readonly current_minor: number | null;
}

describe("runCartSample", () => {
  it("writes one row per sampled option and abandons every cart it opens", async () => {
    const world = makeWorld();
    const env = makeEnv({ DB: world.db.d1, CART_SAMPLE_SIZE: "3" });
    const summary = await runCartSample(world.deps, env);
    expect(summary.job).toBe("cart-sample");
    expect(summary.ok).toBe(true);
    const rows = world.db.sqlite.query("SELECT day, product_id, option_id, outcome, cart_id, current_minor FROM cart_samples").all() as Row[];
    expect(rows.length).toBe(3);
    for (const row of rows) expect(row.outcome).toBe("matched");
    expect(world.carts.log.length).toBe(3);
    expect(world.carts.log.every((entry) => entry.status === "abandoned")).toBe(true);
  });

  it("records a mismatch when the price changed since the catalogue was read", async () => {
    const world = makeWorld();
    const env = makeEnv({ DB: world.db.d1, CART_SAMPLE_SIZE: "1" });
    const [option] = await world.catalogue.sampleListableOptions(1, "2026-10-01");
    if (!option) throw new Error("fixture has no listable option to sample");
    world.partner.setRetail(option.productId, option.optionId, option.retail + 500);

    await runCartSample(world.deps, env);

    const rows = world.db.sqlite.query("SELECT outcome, current_minor FROM cart_samples").all() as { outcome: string; current_minor: number | null }[];
    expect(rows).toEqual([{ outcome: "price_mismatch", current_minor: option.retail + 500 }]);
    // a rejected create opens no cart, so there is nothing left to abandon
    expect(world.carts.log.length).toBe(0);
  });

  it("does nothing on a second run the same day", async () => {
    const world = makeWorld();
    const env = makeEnv({ DB: world.db.d1, CART_SAMPLE_SIZE: "3" });
    await runCartSample(world.deps, env);
    const cartsAfterFirst = world.carts.log.length;
    const second = await runCartSample(world.deps, env);
    expect(second.summary).toContain("already sampled");
    expect(world.carts.log.length).toBe(cartsAfterFirst);
    const rows = world.db.sqlite.query("SELECT COUNT(*) AS n FROM cart_samples").all() as { n: number }[];
    expect(rows[0]?.n).toBe(3);
  });

  it("reports ok: false, names the count, and logs once when an abandon fails", async () => {
    const world = makeWorld();
    const env = makeEnv({ DB: world.db.d1, CART_SAMPLE_SIZE: "1" });
    world.partner.failNext("carts.abandon", partnerError("INTERNAL_SERVER_ERROR", "boom"));
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});

    const summary = await runCartSample(world.deps, env);

    expect(summary.ok).toBe(false);
    expect(summary.summary).toContain("1 abandon(s) failed");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(errorSpy.mock.calls[0]?.[0] as string)).toMatchObject({ at: "monitor.sample", problem: "abandon failed" });
    // the row still carries the sample's real outcome even though the abandon afterwards failed
    const rows = world.db.sqlite.query("SELECT outcome FROM cart_samples").all() as { outcome: string }[];
    expect(rows).toEqual([{ outcome: "matched" }]);

    errorSpy.mockRestore();
  });

  it("marks a refused option unavailable in the catalogue", async () => {
    const world = makeWorld();
    const env = makeEnv({ DB: world.db.d1, CART_SAMPLE_SIZE: "1" });
    world.partner.failNext("carts.create", partnerError("PRODUCT_NOT_CARTABLE", "no longer cartable", { shape: "envelope" }));
    const [option] = await world.catalogue.sampleListableOptions(1, "2026-10-01");
    if (!option) throw new Error("fixture has no listable option to sample");

    const summary = await runCartSample(world.deps, env);

    expect(summary.ok).toBe(true);
    const stored = await world.catalogue.getOption(option.productId, option.optionId);
    expect(stored?.active).toBe(false);
    const rows = world.db.sqlite.query("SELECT outcome FROM cart_samples").all() as { outcome: string }[];
    expect(rows).toEqual([{ outcome: "unavailable" }]);
  });

  it("writes nothing and reports ok: false for an empty catalogue copy", async () => {
    const world = makeWorld();
    world.catalogue.products.clear();
    const env = makeEnv({ DB: world.db.d1, CART_SAMPLE_SIZE: "3" });

    const summary = await runCartSample(world.deps, env);

    expect(summary.job).toBe("cart-sample");
    expect(summary.ok).toBe(false);
    expect(summary.summary).toBe("the catalogue copy is empty; no cart sampled");
    expect(world.carts.log.length).toBe(0);
    const rows = world.db.sqlite.query("SELECT COUNT(*) AS n FROM cart_samples").all() as { n: number }[];
    expect(rows[0]?.n).toBe(0);
  });
});
