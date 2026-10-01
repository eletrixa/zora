/**
 * Ranking regressions found against production on 2026-09-30: "cheap X" let the filler word
 * "cheap" outrank the actual service, a place name in the query text outranked a real service
 * match once the AND pass failed and fell back to OR, and "service near a place with no exact
 * match there" returned an unrelated same-place listing instead of the real service elsewhere.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/search/ranking.test.ts
 * Deps:    bun:test, src/search/index.ts, test/fakes/d1.ts, test/fakes/seed.ts, test/fakes/fixtures.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { createSearchIndex } from "../../src/search/index";
import { createTestDb } from "../fakes/d1";
import { makeProduct, type ProductSpec } from "../fakes/fixtures";
import { seedCatalogue } from "../fakes/seed";

describe("\"cheap\" is filler, not a ranked word", () => {
  it("still finds the oil change first, ahead of unrelated products that only say cheap", async () => {
    const specs: ProductSpec[] = [
      {
        id: "p-cheap-unrelated",
        title: "Find Cheap Thrills at a Pinball Arcade",
        short: "Cheap, cheap, cheap fun for everyone.",
        categories: ["Arcade"],
        places: [["Pinball Palace", "Chicago", "IL", "60601"]],
        options: [{ id: "o-cheap-unrelated", title: "Session", original: 3000, retail: 2100, isDefault: true }],
      },
      {
        id: "p-oil-change",
        title: "Up to 40% Off on Oil Change at Finish Line Auto",
        short: "A full-service oil change.",
        categories: ["Automotive"],
        places: [["Finish Line Auto", "Chicago", "IL", "60601"]],
        options: [{ id: "o-oil-change", title: "Service", original: 8000, retail: 4000, isDefault: true }],
      },
    ];
    const db = createTestDb();
    seedCatalogue(db, specs.map(makeProduct));
    const index = createSearchIndex(db.d1);

    const hits = await index.search({ text: "cheap oil change" });

    expect(hits[0]?.productId).toBe("p-oil-change");
  });
});

describe("a place name in the text is a filter, not a ranked term", () => {
  it("keeps a real Dallas detailing shop ahead of an unrelated Dallas business", async () => {
    const specs: ProductSpec[] = [
      {
        id: "p-massage-dallas",
        title: "Couples Massage Therapy",
        short: "A relaxing massage, nothing to do with cars.",
        categories: ["Beauty & Spas", "Massage"],
        places: [["Massage Heights", "Dallas", "TX", "75201"]],
        options: [{ id: "o-massage-dallas", title: "Session", original: 20000, retail: 17998, isDefault: true }],
      },
      {
        id: "p-detail-dallas",
        title: "Interior and Exterior Detailing",
        short: "Full car detailing package.",
        categories: ["Automotive", "Car Wash"],
        places: [["2Pros Handwash and Detail", "Dallas", "TX", "75201"]],
        options: [{ id: "o-detail-dallas", title: "Package", original: 8000, retail: 4800, isDefault: true }],
      },
    ];
    const db = createTestDb();
    seedCatalogue(db, specs.map(makeProduct));
    const index = createSearchIndex(db.d1);

    const hits = await index.search({ text: "car detailing in Dallas" });

    expect(hits[0]?.productId).toBe("p-detail-dallas");
  });

  it("falls back to a real match elsewhere when nothing matches the named place", async () => {
    // Reproduces the exact production shape: "wine tasting near Boston" real-world MISS came
    // from a Boston cooking class whose long `description` copy happens to say "wine" and
    // "tasting" (e.g. "pairs with a wine tasting flight"), even though its title, short
    // description and categories never mention either. `makeProduct` derives `description` from
    // `short`, so the coincidental match is built by hand here, independent of `short`, exactly
    // as production's own scraped copy is independent of its short description.
    const cookingBoston = {
      ...makeProduct({
        id: "p-cooking-boston",
        title: "Fun Cooking Classes, Multiple Locations Available",
        short: "Hands-on cooking classes with top chefs.",
        categories: ["Food & Drink", "Classes"],
        places: [["City Cooking Co", "Boston", "MA", "02108"]],
        options: [{ id: "o-cooking-boston", title: "Class", original: 9000, retail: 6900, isDefault: true }],
      }),
      description: "Hands-on cooking classes with top chefs. Some sessions pair a course with a wine tasting flight.",
    };
    const specs: ProductSpec[] = [
      {
        id: "p-wine-amherst",
        title: "Wine Tasting at LaBelle Winery",
        short: "A guided wine tasting flight.",
        categories: ["Food & Drink", "Wine"],
        places: [["LaBelle Winery", "Amherst", "MA", "01002"]],
        options: [{ id: "o-wine-amherst", title: "Tasting", original: 6000, retail: 3500, isDefault: true }],
      },
    ];
    const db = createTestDb();
    seedCatalogue(db, [cookingBoston, ...specs.map(makeProduct)]);
    const index = createSearchIndex(db.d1);

    const hits = await index.search({ text: "wine tasting near Boston" });

    // Once the place-gated tiers (which correctly exclude the Boston class — its title, short
    // description and categories never say "wine" or "tasting") find nothing, the query falls
    // back to an unrestricted, place-agnostic match: the real wine tasting business ranks first
    // on its strong title match, ahead of the Boston class's coincidental description mention.
    expect(hits[0]?.productId).toBe("p-wine-amherst");
  });
});

describe("a Title Case service word without a location preposition stays a ranked word", () => {
  it("still requires both words of \"Wine Tasting in Napa\", not just the first", async () => {
    const specs: ProductSpec[] = [
      {
        id: "p-wine-bar-napa",
        // Matches "wine" but never "tasting": would wrongly pass an AND search if "Tasting"
        // (Title Case, but not after "in"/"at"/"near") had been misread as a second place word
        // and dropped from the ranked terms instead of staying required.
        title: "Wine Bar Happy Hour",
        short: "Half off wine by the glass.",
        categories: ["Food & Drink", "Bar"],
        places: [["Napa Wine Bar", "Napa", "CA", "94558"]],
        options: [{ id: "o-wine-bar-napa", title: "Happy Hour", original: 4000, retail: 2000, isDefault: true }],
      },
      {
        id: "p-wine-tasting-napa",
        title: "Wine Tasting Experience",
        short: "A guided flight of four wines.",
        categories: ["Food & Drink", "Wine"],
        places: [["Napa Valley Vineyards", "Napa", "CA", "94558"]],
        options: [{ id: "o-wine-tasting-napa", title: "Flight", original: 6000, retail: 4500, isDefault: true }],
      },
    ];
    const db = createTestDb();
    seedCatalogue(db, specs.map(makeProduct));
    const index = createSearchIndex(db.d1);

    const hits = await index.search({ text: "Wine Tasting in Napa" });

    expect(hits.map((hit) => hit.productId)).toEqual(["p-wine-tasting-napa"]);
  });
});
