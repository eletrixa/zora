/**
 * Cloudflare Workflow shell around src/sync/walk.ts: one durable step per catalogue page. An instance
 * walks either one run (full load) or a category cycle (many runs, one after another).
 * The only sync file that imports cloudflare:workers.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/sync/workflow.ts
 * Deps:    cloudflare:workers, src/container.ts, src/sync/walk.ts, src/sync/category.ts
 * Tested:  n/a (what it runs is tested in test/sync/sync.test.ts and test/sync/category.test.ts)
 */
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { buildDeps } from "../container";
import type { Env } from "../contracts/env";
import { iso } from "../lib/clock";
import { runCategoryCycle, type CycleParams } from "./category";
import { failRun, readRun, runWalk, type StepRunner } from "./walk";

export interface SyncParams {
  readonly runId: string;
  readonly pageSize: number;
}

export class CatalogueSyncWorkflow extends WorkflowEntrypoint<Env, SyncParams | CycleParams> {
  async run(event: WorkflowEvent<SyncParams | CycleParams>, step: WorkflowStep): Promise<void> {
    const deps = buildDeps(this.env);
    if ("cycle" in event.payload) {
      // Step names must be unique in the instance, and every run has its own page-1.
      const outcome = await runCategoryCycle(deps, event.payload.runIds, (runId) => ({
        do: (name, fn) => step.do(`${runId}:${name}`, fn as () => Promise<never>),
      }));
      if (outcome.failed > 0) console.error(JSON.stringify({ at: "sync.workflow", cycle: event.instanceId, outcome }));
      return;
    }
    const { runId } = event.payload;
    // Step results are plain JSON objects; the generic runner type cannot prove that to Rpc.Serializable.
    const steps: StepRunner = { do: (name, fn) => step.do(name, fn as () => Promise<never>) };
    try {
      const outcome = await runWalk(deps, runId, steps);
      if (outcome.status !== "complete") console.error(JSON.stringify({ at: "sync.workflow", runId, outcome }));
    } catch (cause) {
      // The step retries are spent. Record the failure so the start guard does not wait 6 hours for this run.
      const message = cause instanceof Error ? cause.message : String(cause);
      console.error(JSON.stringify({ at: "sync.workflow", runId, error: message }));
      await step.do("record-crash", async () => {
        const run = await readRun(deps.db, runId);
        if (run?.status === "running") await failRun(deps.db, runId, { code: "CRASH", message, requestId: null }, iso(deps.clock.now()));
        return null;
      });
      throw cause;
    }
  }
}
