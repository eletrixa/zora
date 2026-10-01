/**
 * The /ingest/observations route: token gate (owned by src/app.ts), oversize body, bad JSON,
 * and a valid batch through the full app.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/monitor/routes.test.ts
 * Deps:    bun:test, src/app.ts, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { createApp } from "../../src/app";
import { TEST_SECRETS, makeEnv, makeWorld } from "../fakes/env";
import { seedCatalogue } from "../fakes/seed";

const PROD = "https://zorasocial.asajj.cz";

function setup() {
  const world = makeWorld();
  seedCatalogue(world.db);
  const env = makeEnv({ DB: world.db.d1 });
  const app = createApp({ deps: world.deps });
  const post = (path: string, body: unknown, extraHeaders: Record<string, string> = {}) =>
    app.fetch(
      new Request(`${PROD}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${TEST_SECRETS.ZAL_INGEST_TOKEN}`, ...extraHeaders },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
      env,
    );
  return { world, env, app, post };
}

describe("POST /ingest/observations", () => {
  it("accepts a valid batch and answers the receipt", async () => {
    const { post } = setup();
    const response = await post("/ingest/observations", {
      kind: "public_prices",
      collector: "c1",
      observations: [
        {
          sourceUrl: "https://www.groupon.com/deals/p-massage-chi-permalink",
          dealUrl: "https://www.groupon.com/deals/p-massage-chi-permalink",
          permalink: "p-massage-chi-permalink",
          title: "Swedish Massage at Foot Smile Spa",
          merchant: "Foot Smile Spa",
          currency: "USD",
          priceMinor: 4900,
          listPriceMinor: 8000,
          observedAt: "2026-10-01T12:00:00.000Z",
        },
      ],
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ accepted: 1, rejected: 0, reasons: [] });
  });

  it("refuses a body over 512 KB", async () => {
    const { post } = setup();
    const observations = Array.from({ length: 2000 }, (_, i) => ({
      sourceUrl: "https://www.groupon.com/deals/x",
      dealUrl: "https://www.groupon.com/deals/x",
      permalink: `x-${i}`,
      title: "x".repeat(400),
      merchant: null,
      currency: "USD",
      priceMinor: 100,
      listPriceMinor: null,
      observedAt: "2026-10-01T12:00:00.000Z",
    }));
    const response = await post("/ingest/observations", { kind: "public_prices", collector: "c1", observations });
    expect(response.status).toBe(413);
  });

  it("refuses invalid JSON", async () => {
    const { post } = setup();
    const response = await post("/ingest/observations", "{not json");
    expect(response.status).toBe(400);
  });

  it("requires the ingest token", async () => {
    const { post } = setup();
    const response = await post("/ingest/observations", { kind: "guide_version", collector: "c1", observation: null }, { authorization: "Bearer wrong-token-0123456789" });
    expect(response.status).toBe(401);
  });
});
