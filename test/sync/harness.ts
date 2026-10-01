/**
 * Shared harness for the catalogue sync tests: a world of fakes, a Workflow binding that records its
 * create calls, upsert and retire that log their calls, a step runner and readers for the sync tables.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/sync/harness.ts
 * Deps:    src/sync/walk.ts, src/sync/workflow.ts, src/sync/category.ts, test/fakes/*
 * Tested:  n/a (used by test/sync/sync.test.ts and test/sync/category.test.ts)
 */
import type { Env } from "../../src/contracts/env";
import type { OctoProduct, ProductsQuery } from "../../src/contracts/partner";
import type { CycleParams } from "../../src/sync/category";
import type { StepRunner } from "../../src/sync/walk";
import type { SyncParams } from "../../src/sync/workflow";
import { FIXED_START } from "../fakes/clock";
import { makeEnv, makeWorld, type FakeWorld } from "../fakes/env";

export const iso = (ms: number): string => new Date(ms).toISOString();
export const TEN_MINUTES = 10 * 60_000;

export interface CreatedInstance {
  id?: string;
  params?: SyncParams | CycleParams;
}

export interface Harness {
  readonly world: FakeWorld;
  readonly env: Env;
  readonly created: CreatedInstance[];
  readonly retired: string[];
  readonly events: string[];
}

export function harness(pageSize = "5", products?: OctoProduct[]): Harness {
  const world = makeWorld();
  if (products) {
    world.partner.products = products;
    for (const product of products) world.partner.changedAt.set(product.id, iso(FIXED_START));
  }
  const created: CreatedInstance[] = [];
  const workflow = {
    create: async (options: CreatedInstance) => {
      created.push(options);
      return { id: options.id };
    },
  } as unknown as Workflow;
  const env = makeEnv({ DB: world.db.d1, SYNC_WORKFLOW: workflow, SYNC_PAGE_SIZE: pageSize });
  const retired: string[] = [];
  const events: string[] = [];
  const upsert = world.catalogue.upsertProducts.bind(world.catalogue);
  world.catalogue.upsertProducts = async (products, runId, seenAt) => {
    events.push("upsert");
    return upsert(products, runId, seenAt);
  };
  const retire = world.catalogue.retireUnseen.bind(world.catalogue);
  world.catalogue.retireUnseen = async (runId) => {
    events.push("retire");
    retired.push(runId);
    return retire(runId);
  };
  return { world, env, created, retired, events };
}

/** Runs steps at once, like a Workflow on its first try. Every page step moves the clock one second. */
export function steps(world: FakeWorld, names: string[] = [], results: unknown[] = []): StepRunner {
  return {
    async do(name, fn) {
      names.push(name);
      if (name.startsWith("page-")) world.clock.advance(1000);
      const result = await fn();
      results.push(result);
      return result;
    },
  };
}

export const queries = (world: FakeWorld): ProductsQuery[] => world.partner.callsTo("products.list").map((call) => call.args[0] as ProductsQuery);

export function runRow(world: FakeWorld, runId: string): Record<string, unknown> {
  const row = world.db.sqlite.query("SELECT * FROM sync_runs WHERE run_id = ?1").get(runId) as Record<string, unknown> | null;
  if (!row) throw new Error(`no sync_runs row ${runId}`);
  return row;
}

export const watermark = (world: FakeWorld): string | null =>
  (world.db.sqlite.query("SELECT value FROM sync_state WHERE key = 'last_refresh_at'").get() as { value: string } | null)?.value ?? null;

export const setWatermark = (world: FakeWorld, value: string): void => {
  world.db.sqlite.query("INSERT INTO sync_state (key, value) VALUES ('last_refresh_at', ?1)").run(value);
};
