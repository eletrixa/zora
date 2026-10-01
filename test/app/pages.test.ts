/**
 * Pages get their data from the services and show the price rule; Top deals is the home page, the
 * finder lives at /find and the look switch is a cookie. Price truth and the Scorecard read the same
 * recorded sync runs (loop 5 CEO review round 1, row 4) and print the run state under the same stamp
 * (round 2): failed, late, or a run left open, which is never called late (round 3).
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/app/pages.test.ts
 * Deps:    bun:test, src/app.ts, src/ui/routes.ts, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { createApp } from "../../src/app";
import { featuredTheme, nextPathOf, queryOf, topDealsQueryOf, withTheme } from "../../src/ui/routes";
import { nextDeltaText } from "../../src/ui/pages/price-truth";
import { PROD, makeEnv, makeWorld } from "../fakes/env";
import { FIXTURE_PRODUCTS, makeProduct } from "../fakes/fixtures";
import { cardOf } from "../fakes/services";
import { seedCatalogue, seedCategories } from "../fakes/seed";

async function setup() {
  const world = makeWorld();
  const env = makeEnv({ DB: world.db.d1 });
  const app = createApp({ deps: world.deps });
  const get = (path: string) => app.fetch(new Request(`${PROD}${path}`), env);
  return { world, get };
}

async function setupWithApp() {
  const world = makeWorld();
  const env = makeEnv({ DB: world.db.d1 });
  const app = createApp({ deps: world.deps });
  const get = (path: string) => app.fetch(new Request(`${PROD}${path}`), env);
  return { world, env, app, get };
}

describe("queryOf", () => {
  it("reads the search form and turns dollars into minor units", () => {
    expect(queryOf({ q: " massage ", city: "Chicago", maxPrice: "50", limit: "500" })).toEqual({ text: "massage", state: undefined, city: "Chicago", category1: undefined, maxPriceMinor: 5000, limit: 50 });
  });
  it("reads the shared pickers: a place as city and state, and the category as a category1 slug", () => {
    expect(queryOf({ q: "massage", place: "New York, ny", category: "beauty-and-spas" })).toEqual({ text: "massage", state: "NY", city: "New York", category1: "beauty-and-spas", maxPriceMinor: undefined, limit: undefined });
    expect(queryOf({ place: "Chicago, IL", city: "Boston", state: "MA" }).city).toBe("Chicago");
  });
  it("ignores junk", () => {
    expect(queryOf({ maxPrice: "abc", limit: "-1" })).toEqual({ text: "", state: undefined, city: undefined, category1: undefined, maxPriceMinor: undefined, limit: undefined });
  });
});

describe("finder", () => {
  it("opens with today's picks instead of an empty page when nothing was searched", async () => {
    const { get, world } = await setup();
    const [hit] = await world.search.search({ text: "massage chicago" });
    if (!hit) throw new Error("no hit");
    world.shopping.cards = [cardOf(hit)];
    const response = await get("/find");
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Today's picks: ");
    expect(body).toContain("/deals/");
    expect(body).not.toContain("No deals found");
    expect(world.shopping.calls[0]).toEqual({ method: "searchDeals", args: [{ text: featuredTheme(world.clock.now()), limit: 9 }, "web"] });
  });
  it("rotates the featured theme by day", () => {
    expect(featuredTheme(0)).not.toBe(featuredTheme(86_400_000));
    expect(featuredTheme(0)).toBe(featuredTheme(10 * 86_400_000));
  });
  it("shows the price to pay and the promo as a separate sentence", async () => {
    const { get, world } = await setup();
    const [hit] = await world.search.search({ text: "massage chicago" });
    if (!hit) throw new Error("no hit");
    world.shopping.cards = [cardOf(hit)];
    const body = await (await get("/find?q=massage+chicago")).text();
    expect(body).toContain("$49.00");
    expect(body).toContain('<span class="promo-line">Type code SAVE20 at Groupon checkout to pay $39.20.</span>');
    expect(body.split("$39.20").length - 1).toBe(1);
    expect(world.shopping.calls[0]).toEqual({ method: "searchDeals", args: [expect.objectContaining({ text: "massage chicago" }), "web"] });
  });
  it("escapes what the visitor typed", async () => {
    const { get } = await setup();
    const body = await (await get(`/find?q=${encodeURIComponent('"><script>alert(1)</script>')}`)).text();
    expect(body).not.toContain("<script>alert(1)</script>");
  });
});

describe("finder on an empty catalogue", () => {
  it("says that nothing is loaded yet instead of 'No deals found', and does not search", async () => {
    const { get, world } = await setup();
    world.catalogue.products.clear();
    for (const path of ["/find?q=massage", "/find"]) {
      const body = await (await get(path)).text();
      expect(body).toContain("No deals are loaded yet.");
      expect(body).not.toContain("No deals found");
    }
    expect(world.shopping.calls).toHaveLength(0);
  });
  it("says 'No deals found' when the catalogue holds deals and none matches", async () => {
    const { get } = await setup();
    const body = await (await get("/find?q=zeppelin")).text();
    expect(body).toContain("No deals found");
    expect(body).not.toContain("No deals are loaded yet.");
  });
});

describe("password managers", () => {
  it("find no password field and no login to save on any page", async () => {
    const { get } = await setupWithApp();
    const finder = await (await get("/find?q=massage")).text();
    expect(finder).not.toContain('type="password"');
    expect(finder).toContain("data-1p-ignore");
    expect(finder).toContain('autocomplete="off"');
  });
});

describe("deal page", () => {
  it("answers 404 for an unknown deal", async () => {
    const { get } = await setup();
    expect((await get("/deals/nope")).status).toBe(404);
  });
});

describe("scorecard page", () => {
  it("says how old the latest probe run is, or that none ran", async () => {
    const { world, get } = await setup();
    expect(await (await get("/scorecard")).text()).toContain("No probe run yet.");
    const finished = new Date(world.clock.now() - 3 * 3_600_000).toISOString();
    await world.db.d1
      .prepare("INSERT INTO probe_runs (run_id, started_at, finished_at, verdict, passed, failed, skipped) VALUES ('r1', ?1, ?1, 'pass', 12, 0, 1)")
      .bind(finished)
      .run();
    const html = await (await get("/scorecard")).text();
    expect(html).toContain("Last probe run 3 hours ago");
    expect(html).toContain("12 passed, 0 failed, 1 skipped");
  });
});

describe("next delta sync", () => {
  it("names the next three-hour boundary in UTC", () => {
    expect(nextDeltaText(Date.UTC(2026, 8, 30, 11, 40))).toBe("12:00 UTC");
    expect(nextDeltaText(Date.UTC(2026, 8, 30, 23, 1))).toBe("00:00 UTC");
  });
});

describe("price truth page", () => {
  it("shows the four comparisons and the public-price verdict from real observations", async () => {
    const { world, get } = await setup();
    const empty = await (await get("/price-truth")).text();
    expect(empty).toContain("No snapshot yet");
    expect(empty).toContain("API against groupon.com");
    expect(empty).toContain(`The next one runs at ${nextDeltaText(world.clock.now())}`);
    seedCatalogue(world.db);
    await world.db.d1
      .prepare(
        "INSERT INTO public_price_observations (permalink, deal_url, source_url, title, merchant, currency, price_minor, list_price_minor, observed_at, collector, matched_product_id, matched_option_id) VALUES ('massage-chi', 'https://www.groupon.com/deals/massage-chi', 'https://www.groupon.com/local/chicago/massage', 'Massage', 'M', 'USD', 4900, 9000, ?1, 'test', 'p-massage-chi', 'o-massage-chi-60')",
      )
      .bind(new Date(world.clock.now()).toISOString())
      .run();
    const html = await (await get("/price-truth")).text();
    expect(html).toMatch(/Showed the price you pay<\/dt><dd[^>]*>1<\/dd>/);
  });
});

describe("topDealsQueryOf", () => {
  it("opens on things-to-do, the first city and the amount sort when nothing was asked", () => {
    expect(topDealsQueryOf({})).toEqual({ city: "", state: "", category1: "things-to-do", label: undefined, sort: "amount" });
  });
  it("splits a place into city and upper-cased state, keeps the label and reads only amount or percent as a sort", () => {
    expect(topDealsQueryOf({ place: "new york, ny", category: "beauty-and-spas", label: "Massage", sort: "percent" })).toEqual({ city: "new york", state: "NY", category1: "beauty-and-spas", label: "Massage", sort: "percent" });
    expect(topDealsQueryOf({ place: "Nowhere", sort: "price" })).toEqual({ city: "", state: "", category1: "things-to-do", label: undefined, sort: "amount" });
  });
  it("reads an empty category as every category", () => {
    expect(topDealsQueryOf({ category: "" }).category1).toBeUndefined();
  });
});

describe("top deals data", () => {
  it("/data/top-deals.json answers the first city with payMinor equal to retail and the original above it", async () => {
    const { world, get } = await setup();
    seedCatalogue(world.db);
    seedCategories(world.db);
    world.db.sqlite.exec("INSERT INTO top_cities (city, state, listable_products, rank, refreshed_at) VALUES ('Chicago', 'IL', 5, 1, '2026-10-01T00:30:00.000Z')");
    const response = await get("/data/top-deals.json");
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
    const report = (await response.json()) as { query: { city: string; category1?: string; sort: string }; rows: { productId: string; payMinor: number; originalMinor: number; rank: number }[] };
    expect(report.query).toMatchObject({ city: "Chicago", state: "IL", category1: "things-to-do", sort: "amount" });
    expect(report.rows.map((row) => row.productId)).toEqual(["p-bowling-chi"]);
    expect(report.rows[0]).toMatchObject({ rank: 1, payMinor: 3900, originalMinor: 9000 });
  });
  it("/ answers 200 with the noindex header on an empty catalogue", async () => {
    const { get } = await setup();
    const response = await get("/");
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
  });
  it("/top-deals answers a permanent redirect to / and keeps the query string", async () => {
    const { get } = await setup();
    const response = await get("/top-deals?category=beauty-and-spas&place=Chicago%2C+IL&sort=percent");
    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe("/?category=beauty-and-spas&place=Chicago%2C+IL&sort=percent");
    expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
  });
});

describe("top deals page", () => {
  const SPA = makeProduct({
    id: "p-spa-chi",
    title: "Spa Day at Grand Spa",
    short: "A full day.",
    categories: ["Beauty & Spas", "Spa"],
    places: [["Grand Spa", "Chicago", "IL", "60601"]],
    options: [{ id: "o-spa-chi", title: "Spa Day", original: 110000, retail: 60000, isDefault: true }],
  });
  const seeded = async () => {
    const world = makeWorld();
    const env = makeEnv({ DB: world.db.d1 });
    const app = createApp({ deps: world.deps });
    const get = (path: string) => app.fetch(new Request(`${PROD}${path}`), env);
    seedCatalogue(world.db, [...FIXTURE_PRODUCTS, SPA]);
    seedCategories(world.db, { "p-bowling-chi": ["things-to-do"], "p-kayak-chi": ["things-to-do"], "p-escape-nyc": ["things-to-do"], "p-massage-chi": ["beauty-and-spas"], "p-laser-chi": ["beauty-and-spas"], "p-spa-chi": ["beauty-and-spas"] });
    world.db.sqlite.exec("INSERT INTO top_cities (city, state, listable_products, rank, refreshed_at) VALUES ('Chicago', 'IL', 6, 1, '2026-10-01T00:30:00.000Z'), ('New York', 'NY', 2, 2, '2026-10-01T00:30:00.000Z')");
    // One complete category walk, so the page knows the tags are real and not merely absent.
    world.db.sqlite.exec("INSERT INTO sync_runs (run_id, kind, status, started_at, finished_at, page_size, category1) VALUES ('category-seed-things-to-do', 'category', 'complete', '2026-10-01T00:30:00.000Z', '2026-10-01T00:52:03.000Z', 50, 'things-to-do')");
    return { world, get };
  };
  const firstDeal = (html: string): string | undefined => /data-rank="1"[\s\S]*?href="\/deals\/([^"]+)"/.exec(html)?.[1];

  it("opens with real deals for the default pair when nothing was asked", async () => {
    const { get } = await seeded();
    const response = await get("/");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("All 1 discounted deal in Chicago, IL: Things To Do");
    expect(html).toContain('href="/deals/p-bowling-chi"');
    expect(html).toContain('data-label="Original">$90.00<');
    expect(html).toContain('data-label="You pay">$39.00<');
    expect(html).toContain("You save $51.00 · 56.7 %");
    expect(html).not.toContain('href="/deals/p-kayak-chi"');
    expect(html).toContain('<option value="things-to-do" selected>');
    expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
  });
  it("orders by percent when asked and marks that sort current, by amount otherwise", async () => {
    const { get } = await seeded();
    const byPercent = await (await get("/?category=beauty-and-spas&place=Chicago%2C+IL&sort=percent")).text();
    expect(firstDeal(byPercent)).toBe("p-laser-chi");
    expect(byPercent).toMatch(/sort=percent" aria-current="true"/);
    const byAmount = await (await get("/?category=beauty-and-spas&place=Chicago%2C+IL&sort=amount")).text();
    expect(firstDeal(byAmount)).toBe("p-spa-chi");
    expect(byAmount).toMatch(/sort=amount" aria-current="true"/);
  });
  it("offers only the labels of the chosen category and answers a stale label with a next step", async () => {
    const html = await (await (await seeded()).get("/?category=beauty-and-spas&label=Bowling&place=Chicago%2C+IL")).text();
    expect(html).toContain('<option value="Massage">');
    expect(html).not.toContain('<option value="Bowling">');
    expect(html).toContain("No discounted deals in Chicago, IL for Bowling.");
    expect(html).toContain("Try the whole of Beauty &amp; Spas");
  });
  it("answers a sentence, not a 500, for a city outside the list", async () => {
    const response = await (await seeded()).get("/?category=things-to-do&place=Nowhere%2C+ZZ");
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("No discounted deals in Nowhere, ZZ for Things To Do.");
  });
  it("says categories appear after the first walk when nothing is tagged", async () => {
    const world = makeWorld();
    const env = makeEnv({ DB: world.db.d1 });
    const app = createApp({ deps: world.deps });
    seedCatalogue(world.db);
    world.db.sqlite.exec("INSERT INTO top_cities (city, state, listable_products, rank, refreshed_at) VALUES ('Chicago', 'IL', 5, 1, '2026-10-01T00:30:00.000Z')");
    const html = await (await app.fetch(new Request(`${PROD}/`), env)).text();
    expect(html).toContain("Categories appear after the first category walk, tonight at 00:30 UTC.");
  });
  it("says nothing is loaded yet on an empty catalogue", async () => {
    const html = await (await (await setup()).get("/")).text();
    expect(html).toContain("No deals are loaded yet.");
  });
});

describe("the look switch", () => {
  it("keeps only a path that starts with one slash as the return address", () => {
    expect(nextPathOf("/find?q=massage")).toBe("/find?q=massage");
    expect(nextPathOf("//evil.example")).toBe("/");
    expect(nextPathOf("https://evil.example/")).toBe("/");
    expect(nextPathOf(undefined)).toBe("/");
  });
  it("marks the document with the chosen look and leaves the default alone", () => {
    expect(withTheme('<!doctype html><html lang="en"><head>', "pixel")).toContain('<html lang="en" data-theme="pixel">');
    expect(withTheme('<!doctype html><html lang="en"><head>', "lab")).toBe('<!doctype html><html lang="en"><head>');
  });
  it("POST /theme sets the cookie for a year, returns to the page, and the next page renders data-theme", async () => {
    const { app, env } = await setupWithApp();
    const body = new URLSearchParams({ theme: "pixel", next: "/find?q=massage" });
    const response = await app.fetch(new Request(`${PROD}/theme`, { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" } }), env);
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/find?q=massage");
    const cookie = response.headers.get("Set-Cookie") ?? "";
    expect(cookie).toContain("zal_theme=pixel");
    expect(cookie).toContain("Max-Age=31536000");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("SameSite=Lax");
    const html = await (await app.fetch(new Request(`${PROD}/find`, { headers: { cookie: "zal_theme=pixel" } }), env)).text();
    expect(html).toContain('<html lang="en" data-theme="pixel">');
    const plain = await (await app.fetch(new Request(`${PROD}/find`), env)).text();
    expect(plain).toContain('<html lang="en">');
    expect(plain).not.toContain("data-theme");
  });
  it("treats an unknown look and a bad return address as the default look and the home page", async () => {
    const { app, env } = await setupWithApp();
    const body = new URLSearchParams({ theme: "neon", next: "//evil.example" });
    const response = await app.fetch(new Request(`${PROD}/theme`, { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" } }), env);
    expect(response.headers.get("Location")).toBe("/");
    expect(response.headers.get("Set-Cookie") ?? "").toContain("zal_theme=lab");
  });
});

describe("the finder's shared pickers", () => {
  it("hands the finder the same cities and categories Top deals offers, and /data/pickers.json answers them", async () => {
    const { world, get } = await setup();
    seedCatalogue(world.db);
    seedCategories(world.db);
    world.db.sqlite.exec("INSERT INTO top_cities (city, state, listable_products, rank, refreshed_at) VALUES ('Chicago', 'IL', 5, 1, '2026-10-01T00:30:00.000Z'), ('New York', 'NY', 2, 2, '2026-10-01T00:30:00.000Z')");
    const pickers = (await (await get("/data/pickers.json")).json()) as { cities: { city: string }[]; categories: { category1: string }[]; citiesRefreshedAt: string };
    expect(pickers.cities.map((city) => city.city)).toEqual(["Chicago", "New York"]);
    expect(pickers.categories[0]?.category1).toBe("things-to-do");
    expect(pickers.categories.map((category) => category.category1)).toContain("beauty-and-spas");
    expect(pickers.citiesRefreshedAt).toBe("2026-10-01T00:30:00.000Z");
    expect((await get("/find")).status).toBe(200);
  });
});

describe("sync facts on Price truth and the Scorecard", () => {
  const SYNC_LABELS = ["Last delta sync", "Delta syncs today", "Last full load"] as const;
  const figure = (html: string, label: string): string | undefined =>
    html.match(new RegExp(`<dt>${label}</dt><dd[^>]*>([^<]*)</dd>`))?.[1];
  const stateLine = (html: string): string | undefined =>
    html.match(/<dt>Last delta sync<\/dt>[\s\S]*?<\/dl><p[^>]*>([^<]*)<\/p>/)?.[1];

  const HISTORIES: Record<string, ReadonlyArray<readonly [string, string, string, string, string | null]>> = {
    "a failed run in the current window": [
      ["full-1", "full", "complete", "2026-09-29T00:30:00.000Z", "2026-09-29T02:10:00.000Z"],
      ["full-2", "full", "failed", "2026-09-30T00:30:00.000Z", "2026-09-30T00:40:00.000Z"],
      ["delta-1", "delta", "complete", "2026-10-01T03:00:00.000Z", "2026-10-01T03:04:00.000Z"],
      ["delta-2", "delta", "complete", "2026-10-01T06:00:00.000Z", "2026-10-01T06:05:00.000Z"],
      ["delta-3", "delta", "failed", "2026-10-01T09:00:00.000Z", "2026-10-01T09:01:00.000Z"],
    ],
    "a late window after an earlier failed run": [
      ["delta-1", "delta", "complete", "2026-09-30T21:00:00.000Z", "2026-09-30T21:05:00.000Z"],
      ["delta-2", "delta", "failed", "2026-10-01T06:00:00.000Z", "2026-10-01T06:01:00.000Z"],
    ],
    "a run left open since an earlier window": [
      ["delta-1", "delta", "complete", "2026-09-30T21:00:00.000Z", "2026-09-30T21:05:00.000Z"],
      ["delta-2", "delta", "running", "2026-10-01T00:01:00.000Z", null],
    ],
  };
  // CEO review round 3 (loop 5): both pages said "Late: the 03:00 UTC sync has not started" beside a run
  // left open since 00:01 UTC, which each delta call continues. The state each history must print:
  const STATE: Record<keyof typeof HISTORIES, string> = {
    "a failed run in the current window": "Failed at 09:01 UTC.",
    "a late window after an earlier failed run": "Late: the 09:00 UTC sync has not started.",
    "a run left open since an earlier window": "Running since 00:01 UTC.",
  };

  for (const [name, runs] of Object.entries(HISTORIES)) {
    it(`print the same last delta sync, delta syncs today and last full load, with ${name}`, async () => {
      const { world, get } = await setup();
      seedCatalogue(world.db);
      const insert = world.db.sqlite.query("INSERT INTO sync_runs (run_id, kind, status, started_at, finished_at, page_size) VALUES (?1, ?2, ?3, ?4, ?5, 50)");
      for (const row of runs) insert.run(...row);
      // Price truth draws its Freshness card once a price change is on record.
      world.db.sqlite
        .query("INSERT INTO price_changes (product_id, option_id, field, old_minor, new_minor, detected_at, sync_run_id) VALUES ('p-massage-chi', 'o-massage-chi-60', 'retail', 5900, 4900, ?1, 'delta-1')")
        .run("2026-10-01T03:04:00.000Z");
      world.clock.advance(10 * 3_600_000 + 40 * 60_000);
      const priceTruth = await (await get("/price-truth")).text();
      const scorecard = await (await get("/scorecard")).text();
      for (const label of SYNC_LABELS) {
        expect(figure(priceTruth, label)).toBeDefined();
        expect(figure(priceTruth, label)).toBe(figure(scorecard, label));
      }
      // The run's open, failed or late state is its own line under the card's rows (CEO review round 2).
      expect(stateLine(priceTruth)).toBe(STATE[name]!);
      expect(stateLine(scorecard)).toBe(STATE[name]!);
    });
  }
});
