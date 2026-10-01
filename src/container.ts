/**
 * Composition root: builds every service from the Worker bindings. The only file that knows
 * which implementation stands behind which port.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/container.ts
 * Deps:    every lane's factory
 * Tested:  test/app/container.test.ts
 */
import type { Env } from "./contracts/env";
import type { Clock, Deps, Fetch, Pacer, PartnerConfig, ProbeContext } from "./contracts/ports";
import type { Reports } from "./contracts/reports";
import { PARTNER_DISPLAY_NAME } from "./contracts/env";
import { createCartService } from "./carts";
import { createCatalogueStore } from "./catalogue";
import { systemClock } from "./lib/clock";
import { createPriceTruthReadModel } from "./monitor";
import { createPartnerClient } from "./partner";
import { createScorecardReadModel } from "./probe/scorecard";
import { createSearchIndex } from "./search";
import { createShoppingService } from "./shopping";
import { getSyncStatus } from "./sync";
import { createTopDealsReadModel } from "./top-deals";

export interface Overrides {
  readonly clock?: Clock;
  readonly fetch?: Fetch;
  /** Tests replace single services; production passes nothing. */
  readonly deps?: Partial<Deps>;
  readonly reports?: Partial<Reports>;
}

/**
 * One pacer per isolate: every request handled by this isolate shares it, so the partner API
 * sees at most one request start per second from here. Cloudflare may run several isolates;
 * the public return page has its own cap in D1 for that reason (src/return/routes.ts).
 */
const partnerPacer: Pacer = { nextFreeAt: 0 };

const workerFetch: Fetch = (input, init) => fetch(input, init);

const positive = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export function partnerConfig(env: Env): PartnerConfig {
  return {
    baseUrl: env.PARTNER_BASE_URL,
    apiKey: env.GROUPON_PARTNER_API_KEY ?? "",
    userAgent: env.PARTNER_USER_AGENT,
    minIntervalMs: positive(env.PARTNER_MIN_INTERVAL_MS, 1000),
    timeoutMs: 30_000,
    pacer: partnerPacer,
    maxWaitMs: 15_000,
  };
}

export function buildDeps(env: Env, overrides: Overrides = {}): Deps {
  const given = overrides.deps ?? {};
  const clock = given.clock ?? overrides.clock ?? systemClock;
  const fetchImpl = overrides.fetch ?? workerFetch;
  const db = given.db ?? env.DB;
  const partner = given.partner ?? createPartnerClient(partnerConfig(env), clock, fetchImpl);
  const catalogue = given.catalogue ?? createCatalogueStore(db, clock);
  const search = given.search ?? createSearchIndex(db);
  const carts = given.carts ?? createCartService(partner, db, clock);
  const shopping = given.shopping ?? createShoppingService({ search, catalogue, carts, partner, db, clock });
  return { db, clock, partner, catalogue, search, carts, shopping };
}

export function buildReports(env: Env, deps: Deps, overrides: Overrides = {}): Reports {
  return {
    priceTruth: overrides.reports?.priceTruth ?? createPriceTruthReadModel(env.DB),
    scorecard: overrides.reports?.scorecard ?? createScorecardReadModel(env.DB),
    topDeals: overrides.reports?.topDeals ?? createTopDealsReadModel(env.DB),
    syncStatus: overrides.reports?.syncStatus ?? (() => getSyncStatus(env.DB, deps.catalogue)),
  };
}

export function probeContext(env: Env, deps: Deps, overrides: Overrides = {}): ProbeContext {
  return {
    partner: deps.partner,
    carts: deps.carts,
    catalogue: deps.catalogue,
    db: deps.db,
    clock: deps.clock,
    fetch: overrides.fetch ?? workerFetch,
    config: {
      openapiUrl: `${env.PARTNER_BASE_URL}/octo-gateway/v1/openapi.json`,
      expectedDisplayName: PARTNER_DISPLAY_NAME,
      knownOrderUuid: env.KNOWN_ORDER_UUID?.trim() || null,
      checkoutHost: "partner.groupon.com",
    },
  };
}
