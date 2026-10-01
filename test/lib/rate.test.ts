/**
 * The per-minute counter in D1.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/lib/rate.test.ts
 * Deps:    bun:test, src/lib/rate.ts, test/fakes/d1.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { withinMinuteLimit } from "../../src/lib/rate";
import { createTestDb } from "../fakes/d1";

const T0 = Date.parse("2026-10-01T00:00:10.000Z");

describe("withinMinuteLimit", () => {
  it("allows up to the limit in one minute and refuses the next", async () => {
    const { d1 } = createTestDb();
    const answers: boolean[] = [];
    for (let i = 0; i < 4; i++) answers.push(await withinMinuteLimit(d1, "k", 3, T0 + i * 1000));
    expect(answers).toEqual([true, true, true, false]);
  });
  it("starts again in the next minute and keeps keys apart", async () => {
    const { d1 } = createTestDb();
    for (let i = 0; i < 3; i++) await withinMinuteLimit(d1, "k", 2, T0);
    expect(await withinMinuteLimit(d1, "k", 2, T0 + 60_000)).toBe(true);
    expect(await withinMinuteLimit(d1, "other", 2, T0)).toBe(true);
  });
  it("drops windows older than an hour", async () => {
    const { d1, sqlite } = createTestDb();
    await withinMinuteLimit(d1, "k", 5, T0);
    await withinMinuteLimit(d1, "k", 5, Date.parse("2026-10-01T02:00:00.000Z"));
    expect((sqlite.query("SELECT COUNT(*) AS n FROM rate_windows").get() as { n: number }).n).toBe(1);
  });
});
