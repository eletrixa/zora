/**
 * The Hono app: route table and gates. Integrator-owned. Tests import this file, so it must not
 * import cloudflare:workers (src/index.ts does that).
 *
 * The pages are public since 2026-09-30 (the PIN gate was removed). Every answer, assets included,
 * carries X-Robots-Tag noindex and robots.txt disallows everything: public to a visitor with the
 * address, not to a crawler.
 *
 * Gates, in order:
 *   public        /health, /logo.png, /static/*, /3pd/return*, every page
 *   agent token   /api/v1/*, /mcp
 *   ingest token  /ingest/*
 *   admin token   /admin/*
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/app.ts
 * Deps:    hono, every route module
 * Tested:  test/app/gates.test.ts
 */
import { Hono } from "hono";
import { agentApi } from "./agent/api/routes";
import { agentMcp } from "./agent/mcp/routes";
import { buildDeps, buildReports, type Overrides } from "./container";
import type { AppEnv } from "./contracts/env";
import { isJobName, runJob } from "./cron";
import { PRIVATE_HEADERS, errorJson, requireToken } from "./lib/http";
import { NotBuiltError } from "./lib/not-built";
import { ingest } from "./monitor/routes";
import { returnRoutes } from "./return/routes";
import { pages } from "./ui/routes";
import { renderNotFound } from "./ui/pages/not-found";

const ASSET_PATHS = new Set(["/logo.png", "/favicon.ico", "/robots.txt"]);

export function createApp(overrides: Overrides = {}): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    const deps = buildDeps(c.env, overrides);
    c.set("deps", deps);
    c.set("reports", buildReports(c.env, deps, overrides));
    await next();
    // Assets come back from the ASSETS binding without the private headers; the tag must be on
    // every answer or a crawler that reaches a stylesheet has something to index. A fetched
    // response has immutable headers on Cloudflare, so the answer is rebuilt before the header is set.
    if (!c.res.headers.has("X-Robots-Tag")) {
      const res = new Response(c.res.body, c.res);
      res.headers.set("X-Robots-Tag", PRIVATE_HEADERS["X-Robots-Tag"] as string);
      c.res = res;
    }
  });

  // ---- public
  app.get("/health", (c) => c.text("ok", 200, PRIVATE_HEADERS));
  app.get("/static/*", (c) => c.env.ASSETS.fetch(c.req.raw));
  app.get("/:asset{(logo\\.png|favicon\\.ico|robots\\.txt)}", (c) => (ASSET_PATHS.has(c.req.path) ? c.env.ASSETS.fetch(c.req.raw) : c.notFound()));
  app.route("/", returnRoutes);

  // ---- tokens
  app.use("/api/v1/*", requireToken("ZAL_AGENT_TOKEN"));
  app.route("/api/v1", agentApi);
  app.use("/mcp", requireToken("ZAL_AGENT_TOKEN"));
  app.use("/mcp/*", requireToken("ZAL_AGENT_TOKEN"));
  app.route("/mcp", agentMcp);
  app.use("/ingest/*", requireToken("ZAL_INGEST_TOKEN"));
  app.route("/ingest", ingest);

  // ---- admin: start a job by hand
  app.use("/admin/*", requireToken("ZAL_ADMIN_TOKEN"));
  app.post("/admin/jobs/:job", async (c) => {
    const job = c.req.param("job");
    if (!isJobName(job)) return errorJson(c, 404, "unknown_job", `no job named ${job}`);
    const summary = await runJob(job, c.var.deps, c.env);
    return c.json(summary, summary.ok ? 200 : 500, PRIVATE_HEADERS);
  });

  // ---- pages
  app.route("/", pages);

  app.notFound(async (c) => new Response(await renderNotFound({ path: c.req.path }), { status: 404, headers: { ...PRIVATE_HEADERS, "Content-Type": "text/html; charset=utf-8" } }));

  app.onError((error, c) => {
    if (error instanceof NotBuiltError) return errorJson(c, 503, "not_built", error.message);
    console.error(JSON.stringify({ at: "app.onError", path: c.req.path, name: error.name, message: error.message }));
    return errorJson(c, 500, "internal", "something failed; the request id is in the logs");
  });

  return app;
}
