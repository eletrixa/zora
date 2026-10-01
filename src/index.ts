/**
 * Worker entry: HTTP, cron and the Workflow export. Integrator-owned.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/index.ts
 * Deps:    src/app.ts, src/cron.ts, src/sync/workflow.ts
 * Tested:  test/app/gates.test.ts (through src/app.ts)
 */
import { createApp } from "./app";
import { buildDeps } from "./container";
import type { Env } from "./contracts/env";
import { runSchedule } from "./cron";

export { CatalogueSyncWorkflow } from "./sync/workflow";

const app = createApp();

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => app.fetch(request, env, ctx),
  scheduled: (controller: ScheduledController, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(runSchedule(controller.cron, buildDeps(env), env));
  },
} satisfies ExportedHandler<Env>;
