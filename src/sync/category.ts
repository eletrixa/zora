/**
 * The daily category walk as one cycle: a category run per Groupon category1 value, walked one after
 * another inside one Workflow instance, things-to-do first. One bad category never stops the others.
 * Must not import cloudflare:workers (tests import this file).
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/sync/category.ts
 * Deps:    src/contracts/ports.ts, src/lib/clock.ts, src/sync/walk.ts
 * Tested:  test/sync/category.test.ts
 */
import type { Deps } from "../contracts/ports";
import { iso } from "../lib/clock";
import { failRun, readRun, runWalk, type StepRunner } from "./walk";

/**
 * The guide's 38 category1 values (Inventory scope values). things-to-do leads because the Top deals
 * page opens on it, so a cycle cut short still has it. The other 37 follow in the guide's order.
 */
export const CATEGORY1_VALUES: readonly string[] = [
  "things-to-do",
  "air-inclusive",
  "all-inclusive",
  "auto-and-home-improvement",
  "automotive",
  "baby-kids-and-toys",
  "beach-destinations",
  "beauty-and-spas",
  "casinos",
  "city",
  "cruises",
  "culinary",
  "electronics",
  "entertainment-and-media",
  "family-trips",
  "food-and-drink",
  "for-the-home",
  "gift-cards",
  "grocery-and-household",
  "health-and-beauty",
  "health-and-fitness",
  "home-improvement",
  "hotel-travel",
  "jewelry-and-watches",
  "luxury",
  "mens-clothing-shoes-and-accessories",
  "outdoor-activities-recreation",
  "personal-services",
  "pet-supplies",
  "retail",
  "romantic",
  "spa-and-wellness",
  "sports-and-outdoors",
  "toys",
  "unique-lodging",
  "v1-personalized-items",
  "waterparks",
  "womens-clothing-shoes-and-accessories",
];

/** The Workflow payload of a category cycle: the runs to walk, in order. */
export interface CycleParams {
  readonly cycle: true;
  readonly runIds: readonly string[];
}

export const categoryRunId = (cycleId: string, category1: string): string => `${cycleId}-${category1}`;

/**
 * Walks each run in order. A failed walk counts and the cycle goes on. A walk that throws (its step
 * retries are spent) is logged, its run marked failed through a `record-crash` step, and the cycle goes on.
 */
export async function runCategoryCycle(
  deps: Deps,
  runIds: readonly string[],
  stepsFor: (runId: string) => StepRunner,
): Promise<{ complete: number; failed: number }> {
  let complete = 0;
  let failed = 0;
  for (const runId of runIds) {
    const steps = stepsFor(runId);
    try {
      const outcome = await runWalk(deps, runId, steps);
      if (outcome.status === "complete") complete++;
      else failed++;
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : String(cause);
      console.error(JSON.stringify({ at: "sync.categoryCycle", runId, error }));
      // Without this the run stays running and the next start waits 6 hours for it.
      await steps.do("record-crash", async () => {
        const run = await readRun(deps.db, runId);
        if (run?.status === "running") await failRun(deps.db, runId, { code: "CRASH", message: error, requestId: null }, iso(deps.clock.now()));
        return null;
      });
      failed++;
    }
  }
  return { complete, failed };
}
