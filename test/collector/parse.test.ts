/**
 * Parsing: listing page JSON-LD to price observations, guide version from guide text.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/collector/parse.test.ts
 * Deps:    bun:test, collector/parse.ts
 * Tested:  this file
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { countListedEntries, parseGuideVersion, parseListing, parsePriceToMinor } from "../../collector/parse";

const FIXTURE = readFileSync(join(import.meta.dir, "fixtures", "listing.html"), "utf8");
const OBSERVED_AT = "2026-09-29T05:30:00.000Z";

describe("parsePriceToMinor", () => {
  it("parses whole and decimal prices without multiplying a float", () => {
    expect(parsePriceToMinor("49.00")).toBe(4900);
    expect(parsePriceToMinor("49")).toBe(4900);
    expect(parsePriceToMinor("1,299.00")).toBe(129900);
    expect(parsePriceToMinor("94")).toBe(9400);
  });

  it("rejects text that is not a plain decimal amount", () => {
    expect(parsePriceToMinor("free")).toBeNull();
    expect(parsePriceToMinor("")).toBeNull();
    expect(parsePriceToMinor("$49.00")).toBeNull();
    expect(parsePriceToMinor("49.999")).toBeNull();
  });
});

describe("parseListing", () => {
  it("parses the listing fixture to the expected observations", () => {
    const observations = parseListing(FIXTURE, "https://www.groupon.com/local/chicago/massage", OBSERVED_AT);
    expect(observations).toHaveLength(9);
    expect(observations[0]).toEqual({
      sourceUrl: "https://www.groupon.com/local/chicago/massage",
      dealUrl: "https://www.groupon.com/deals/pure-serenity-spa-1",
      permalink: "pure-serenity-spa-1",
      title: "Solo or Couples Deep-Tissue or Swedish Massage with Hot Stones & More",
      merchant: "Pure Serenity Spa",
      currency: "USD",
      priceMinor: 9400,
      listPriceMinor: 13000,
      observedAt: OBSERVED_AT,
    });
    expect(observations[1]).toEqual({
      sourceUrl: "https://www.groupon.com/local/chicago/massage",
      dealUrl: "https://www.groupon.com/deals/foot-smile-spa-5",
      permalink: "foot-smile-spa-5",
      title: "65, 90-Minute Foot Reflexology & Bath and Body Massage: Head to Toes!",
      merchant: "Foot Smile Spa - Chicago",
      currency: "USD",
      priceMinor: 4900,
      listPriceMinor: 8000,
      observedAt: OBSERVED_AT,
    });
    expect(observations[8]).toEqual({
      sourceUrl: "https://www.groupon.com/local/chicago/massage",
      dealUrl: "https://www.groupon.com/deals/massage-house-new-ownership",
      permalink: "massage-house-new-ownership",
      title: "60 or 90 Min Couples Swedish or Hot Stone Massage Up to 50% Off",
      merchant: "Massage House",
      currency: "USD",
      priceMinor: 11700,
      listPriceMinor: 12000,
      observedAt: OBSERVED_AT,
    });
  });

  it("counts every listed entry, valid or not", () => {
    expect(countListedEntries(FIXTURE)).toBe(9);
  });

  it("skips an entry without a deals URL, without a price, or with a non-USD currency", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "ItemList",
      itemListElement: [
        { item: { url: "https://www.groupon.com/local/chicago", offers: { price: "10.00", priceCurrency: "USD" } } },
        { item: { url: "https://www.groupon.com/deals/no-price", offers: { priceCurrency: "USD" } } },
        { item: { url: "https://www.groupon.com/deals/wrong-currency", offers: { price: "10.00", priceCurrency: "CAD" } } },
        { item: { url: "https://www.groupon.com/deals/good-one", name: "Good One", offers: { price: "10.00", priceCurrency: "USD" } } },
      ],
    })}</script>`;
    const observations = parseListing(html, "https://www.groupon.com/local/chicago/massage", OBSERVED_AT);
    expect(observations).toHaveLength(1);
    expect(observations[0]?.permalink).toBe("good-one");
    expect(countListedEntries(html)).toBe(4);
  });

  it("answers no observations for a page with no ItemList", () => {
    expect(parseListing("<html><body>not found</body></html>", "https://www.groupon.com/x", OBSERVED_AT)).toEqual([]);
  });
});

describe("parseGuideVersion", () => {
  it("finds the version string on the real guide text", () => {
    const guide = readFileSync(join(import.meta.dir, "..", "..", "docs", "reference", "partner-guide-v7.txt"), "utf8");
    expect(parseGuideVersion(guide)).toBe("7");
  });

  it("answers null when the page does not say", () => {
    expect(parseGuideVersion("Groupon Partner Storefront API guide, no version line here.")).toBeNull();
  });
});
