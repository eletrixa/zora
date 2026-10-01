/**
 * The daily top cities job, checked against the fixtures and against hand-built catalogues.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/top-deals/cities.test.ts
 * Deps:    bun:test, src/top-deals/cities.ts, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { TOP_CITY_COUNT, runTopCitiesRefresh } from "../../src/top-deals/cities";
import { makeEnv, makeWorld } from "../fakes/env";
import { makeProduct } from "../fakes/fixtures";
import { seedCatalogue } from "../fakes/seed";

interface CityRow {
  readonly city: string;
  readonly state: string;
  readonly listable_products: number;
  readonly rank: number;
  readonly refreshed_at: string;
}

function rankedRows(sqlite: ReturnType<typeof makeWorld>["db"]["sqlite"]): CityRow[] {
  return sqlite.query("SELECT city, state, listable_products, rank, refreshed_at FROM top_cities ORDER BY rank ASC").all() as CityRow[];
}

describe("runTopCitiesRefresh", () => {
  it("ranks cities by listable products keyed by city and state", async () => {
    const world = makeWorld();
    seedCatalogue(world.db);
    const env = makeEnv({ DB: world.db.d1 });
    const summary = await runTopCitiesRefresh(world.deps, env);
    expect(summary.job).toBe("top-cities");
    expect(summary.ok).toBe(true);
    const rows = rankedRows(world.db.sqlite);
    expect(rows.map((row) => [row.city, row.state, row.listable_products])).toEqual([
      ["Chicago", "IL", 5],
      ["New York", "NY", 2],
      ["Los Angeles", "CA", 1],
      ["Miami", "FL", 1],
      ["Evanston", "IL", 1],
      ["Austin", "TX", 1],
    ]);
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("counts a product with two locations in one city once", async () => {
    const world = makeWorld();
    const twoInChicago = makeProduct({
      id: "p-two-chicago",
      title: "Two Locations in Chicago",
      short: "short",
      categories: ["Test"],
      places: [
        ["Loop Branch", "Chicago", "IL", "60601"],
        ["Wicker Park Branch", "Chicago", "IL", "60622"],
      ],
      options: [{ id: "o-two-chicago", title: "Option", original: 1000, retail: 900, isDefault: true }],
    });
    seedCatalogue(world.db, [twoInChicago]);
    const env = makeEnv({ DB: world.db.d1 });
    await runTopCitiesRefresh(world.deps, env);
    const rows = rankedRows(world.db.sqlite);
    expect(rows).toEqual([expect.objectContaining({ city: "Chicago", state: "IL", listable_products: 1 })]);
  });

  it("replaces yesterday's list in one write", async () => {
    const world = makeWorld();
    world.db.sqlite.query("INSERT INTO top_cities (city, state, listable_products, rank, refreshed_at) VALUES (?1, ?2, ?3, ?4, ?5)").run("Stale Town", "ZZ", 999, 1, "2026-09-30T00:00:00.000Z");
    seedCatalogue(world.db);
    const env = makeEnv({ DB: world.db.d1 });
    await runTopCitiesRefresh(world.deps, env);
    const rows = rankedRows(world.db.sqlite);
    expect(rows.some((row) => row.city === "Stale Town")).toBe(false);
    expect(rows[0]?.city).toBe("Chicago");
  });

  it("keeps the old list when the catalogue has no listable product", async () => {
    const world = makeWorld();
    world.db.sqlite.query("INSERT INTO top_cities (city, state, listable_products, rank, refreshed_at) VALUES (?1, ?2, ?3, ?4, ?5)").run("Old City", "OH", 3, 1, "2026-09-30T00:00:00.000Z");
    const env = makeEnv({ DB: world.db.d1 });
    const summary = await runTopCitiesRefresh(world.deps, env);
    expect(summary.ok).toBe(false);
    expect(summary.summary).toBe("No listable product has a city yet; the list was left as it was.");
    const rows = rankedRows(world.db.sqlite);
    expect(rows).toEqual([expect.objectContaining({ city: "Old City", state: "OH", listable_products: 3 })]);
  });

  it("caps the list at 50", async () => {
    const world = makeWorld();
    const products = Array.from({ length: 55 }, (_, i) => {
      const n = String(i + 1).padStart(2, "0");
      return makeProduct({
        id: `p-city-${n}`,
        title: `Deal in City ${n}`,
        short: "short",
        categories: ["Test"],
        places: [[`Place ${n}`, `City${n}`, "ZZ", "00000"]],
        options: [{ id: `o-city-${n}`, title: "Option", original: 1000, retail: 900, isDefault: true }],
      });
    });
    seedCatalogue(world.db, products);
    const env = makeEnv({ DB: world.db.d1 });
    const summary = await runTopCitiesRefresh(world.deps, env);
    expect(summary.ok).toBe(true);
    const rows = rankedRows(world.db.sqlite);
    expect(rows.length).toBe(TOP_CITY_COUNT);
    expect(rows.some((row) => row.city === "City55")).toBe(false);
    expect(rows[0]?.city).toBe("City01");
  });

  it("answers a job summary that names the first city", async () => {
    const world = makeWorld();
    seedCatalogue(world.db);
    const env = makeEnv({ DB: world.db.d1 });
    const summary = await runTopCitiesRefresh(world.deps, env);
    expect(summary.summary).toBe("6 cities ranked by listable products; Chicago, IL leads with 5.");
  });
});
