/**
 * The job table: wrangler.jsonc and src/cron.ts agree, and a crashing job becomes a failed row.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/app/cron.test.ts
 * Deps:    bun:test, src/cron.ts, wrangler.jsonc
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JOBS, SCHEDULE, isJobName, runJob, runSchedule } from "../../src/cron";
import { makeEnv, makeWorld } from "../fakes/env";

const wrangler = readFileSync(join(import.meta.dir, "..", "..", "wrangler.jsonc"), "utf8");

describe("schedule", () => {
  it("lists the same cron expressions as wrangler.jsonc", () => {
    const block = /"crons":\s*\[([^\]]*)\]/.exec(wrangler)?.[1] ?? "";
    const configured = [...block.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    expect(configured.sort()).toEqual(Object.keys(SCHEDULE).sort());
  });
  it("names only jobs that exist, and every job is scheduled", () => {
    const scheduled = Object.values(SCHEDULE).flat();
    for (const name of scheduled) expect(isJobName(name)).toBe(true);
    expect([...new Set<string>(scheduled)].sort()).toEqual(Object.keys(JOBS).sort());
  });
  // Workers Paid allows 250 cron triggers per account; five was the Free plan's cap.
  it("stays within six triggers", () => {
    expect(Object.keys(SCHEDULE).length).toBeLessThanOrEqual(6);
  });
});

describe("runJob", () => {
  it("turns a crash into a failed summary and a job_runs row", async () => {
    const world = makeWorld();
    const env = makeEnv({ DB: world.db.d1 });
    const crashing = {
      ...JOBS,
      "promo-gap": async () => {
        throw new Error("the database went away");
      },
    };
    const summary = await runJob("promo-gap", world.deps, env, crashing);
    expect(summary.ok).toBe(false);
    expect(summary.summary).toBe("crashed: the database went away");
    const rows = world.db.sqlite.query("SELECT job, ok FROM job_runs").all();
    expect(rows).toEqual([{ job: "promo-gap", ok: 0 }]);
  });

  it("records a finished job with its own summary", async () => {
    const world = makeWorld();
    const env = makeEnv({ DB: world.db.d1 });
    const fine = { ...JOBS, probe: async () => ({ job: "probe" as const, ok: true, startedAt: "2026-10-01T04:00:00.000Z", finishedAt: "2026-10-01T04:00:40.000Z", summary: "11 passed" }) };
    expect((await runJob("probe", world.deps, env, fine)).summary).toBe("11 passed");
    expect(world.db.sqlite.query("SELECT job, ok, summary FROM job_runs").all()).toEqual([{ job: "probe", ok: 1, summary: "11 passed" }]);
  });
  it("runs nothing for an unknown cron expression", async () => {
    const world = makeWorld();
    expect(await runSchedule("1 2 3 4 5", world.deps, makeEnv({ DB: world.db.d1 }))).toEqual([]);
  });
});
