/**
 * Test environment: production-shaped bindings on an in-memory D1, a Deps object built from the
 * fakes.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/fakes/env.ts
 * Deps:    test/fakes/*
 * Tested:  test/app/gates.test.ts
 */
import type { Env } from "../../src/contracts/env";
import type { Deps } from "../../src/contracts/ports";
import { FakeClock } from "./clock";
import { createTestDb, type TestDb } from "./d1";
import { FIXTURE_PRODUCTS } from "./fixtures";
import { FakePartnerClient } from "./partner";
import { FakeCartService, FakeCatalogueStore, FakeSearchIndex, FakeShoppingService } from "./services";

export const TEST_SECRETS = {
  ZAL_AGENT_TOKEN: "test-agent-token-0123456789",
  ZAL_INGEST_TOKEN: "test-ingest-token-0123456789",
  ZAL_ADMIN_TOKEN: "test-admin-token-0123456789",
} as const;

function frozen(body: string, contentType: string): Response {
  const response = new Response(body, { headers: { "content-type": contentType } });
  const headers = response.headers;
  for (const method of ["set", "append", "delete"] as const) {
    Object.defineProperty(headers, method, {
      value: () => {
        throw new TypeError("immutable");
      },
    });
  }
  return response;
}

/** Stand-in for the static assets binding: answers the public files, 404 otherwise. */
const ASSETS = {
  async fetch(input: RequestInfo | URL): Promise<Response> {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    // Answers are frozen like a real fetched response: Cloudflare gives them immutable headers.
    if (url.pathname === "/logo.png") return frozen("png", "image/png");
    if (url.pathname === "/static/app.css") return frozen("body{}", "text/css");
    if (url.pathname === "/robots.txt") return frozen("User-agent: *\nDisallow: /\n", "text/plain");
    return new Response("not found", { status: 404 });
  },
} as unknown as Fetcher;

const SYNC_WORKFLOW = {
  create: async () => {
    throw new Error("the test environment has no Workflow runtime");
  },
} as unknown as Workflow;

export function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: overrides.DB ?? createTestDb().d1,
    ASSETS,
    SYNC_WORKFLOW,
    ...TEST_SECRETS,
    GROUPON_PARTNER_API_KEY: undefined,
    PARTNER_BASE_URL: "https://api.enc.groupon.com",
    PARTNER_USER_AGENT: "ZoraAgentLab-test/1.0",
    PARTNER_MIN_INTERVAL_MS: "1000",
    SYNC_PAGE_SIZE: "5",
    CART_SAMPLE_SIZE: "3",
    ...overrides,
  };
}

export interface FakeWorld {
  readonly db: TestDb;
  readonly clock: FakeClock;
  readonly partner: FakePartnerClient;
  readonly catalogue: FakeCatalogueStore;
  readonly search: FakeSearchIndex;
  readonly carts: FakeCartService;
  readonly shopping: FakeShoppingService;
  readonly deps: Deps;
}

/** Everything a lane test needs, wired from fakes. The catalogue is seeded with the fixtures. */
export function makeWorld(): FakeWorld {
  const db = createTestDb();
  const clock = new FakeClock();
  const partner = new FakePartnerClient(clock);
  const catalogue = new FakeCatalogueStore(FIXTURE_PRODUCTS, new Date(clock.now()).toISOString());
  const search = new FakeSearchIndex(catalogue);
  const carts = new FakeCartService(partner, clock);
  const shopping = new FakeShoppingService();
  return { db, clock, partner, catalogue, search, carts, shopping, deps: { db: db.d1, clock, partner, catalogue, search, carts, shopping } };
}

export const PROD = "https://zorasocial.asajj.cz";
