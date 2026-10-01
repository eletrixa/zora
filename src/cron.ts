/**
 * Every scheduled and hand-triggered job, in one table. Integrator-owned. A job never throws
 * out of here: a crash becomes a failed job_runs row.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/cron.ts
 * Deps:    src/container.ts, every lane's job function
 * Tested:  test/app/cron.test.ts
 */
import type { Env } from "./contracts/env";
import type { Deps, Job, JobSummary } from "./contracts/ports";
import { runCartSweep } from "./carts";
import { probeContext } from "./container";
import { iso } from "./lib/clock";
import { runCartSample, runPromoGapSnapshot } from "./monitor";
import { ALL_CHECKS } from "./probe/checks";
import { runProbe } from "./probe/run";
import { runDeltaSync, startCategoryWalk, startFullSync } from "./sync";
import { runTopCitiesRefresh } from "./top-deals";

export type JobName = JobSummary["job"];

export const JOBS: Readonly<Record<JobName, Job>> = {
  "sync-full": startFullSync,
  "sync-delta": runDeltaSync,
  probe: (deps, env) => runProbe(probeContext(env, deps), ALL_CHECKS),
  "cart-sample": runCartSample,
  "promo-gap": runPromoGapSnapshot,
  "cart-sweep": runCartSweep,
  "top-cities": runTopCitiesRefresh,
  "category-walk": startCategoryWalk,
};

/** Cron expression (as written in wrangler.jsonc) to the jobs it starts, in order. */
export const SCHEDULE: Readonly<Record<string, readonly JobName[]>> = {
  "0 */3 * * *": ["sync-delta"],
  "0 4 * * *": ["probe"],
  "30 4 * * *": ["promo-gap", "cart-sample"],
  "15 * * * *": ["cart-sweep"],
  "0 5 * * 1": ["sync-full"],
  // 00:30 UTC: after the 00:00 delta, long before the 03:00 delta, the 04:00 probe and the Monday 05:00 full load.
  "30 0 * * *": ["top-cities", "category-walk"],
};

export const isJobName = (value: string): value is JobName => Object.hasOwn(JOBS, value);

export async function runJob(name: JobName, deps: Deps, env: Env, jobs: Readonly<Record<JobName, Job>> = JOBS): Promise<JobSummary> {
  const startedAt = iso(deps.clock.now());
  let summary: JobSummary;
  try {
    summary = await jobs[name](deps, env);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    summary = { job: name, ok: false, startedAt, finishedAt: iso(deps.clock.now()), summary: `crashed: ${message}`.slice(0, 500) };
  }
  try {
    await deps.db
      .prepare("INSERT INTO job_runs (job, ok, started_at, finished_at, summary) VALUES (?1, ?2, ?3, ?4, ?5)")
      .bind(summary.job, summary.ok ? 1 : 0, summary.startedAt, summary.finishedAt, summary.summary)
      .run();
  } catch {
    /* the job result still goes back to the caller; a missing history row must not hide it */
  }
  return summary;
}

export async function runSchedule(cron: string, deps: Deps, env: Env): Promise<readonly JobSummary[]> {
  const results: JobSummary[] = [];
  for (const name of SCHEDULE[cron] ?? []) results.push(await runJob(name, deps, env));
  return results;
}
