/**
 * bin/eval-search.ts against a fake fetch: URL shape, pass/fail scoring, HTTP failure handling.
 * Never touches the network; the live smoke run is a human-only step.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/eval/eval-search.test.ts
 * Deps:    bun:test, bin/eval-search.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { formatOutcome, loadQueries, runEval, runQuery, searchUrl, type EvalQuery } from "../../bin/eval-search";

const Q: EvalQuery = { text: "massage in Chicago", expectAnyOf: ["p-massage-chi"] };

describe("searchUrl", () => {
  it("builds the agent-api search URL with q and no empty params", () => {
    const url = new URL(searchUrl("https://zorasocial.asajj.cz", Q));
    expect(url.pathname).toBe("/api/v1/search");
    expect(url.searchParams.get("q")).toBe("massage in Chicago");
    expect(url.searchParams.has("state")).toBe(false);
  });

  it("sends maxPriceMinor as dollars", () => {
    const url = new URL(searchUrl("https://zorasocial.asajj.cz", { ...Q, maxPriceMinor: 4950 }));
    expect(url.searchParams.get("maxPrice")).toBe("49.5");
  });

  it("carries state, city, category and limit", () => {
    const url = new URL(searchUrl("https://zorasocial.asajj.cz", { ...Q, state: "IL", city: "Chicago", category: "Massage", limit: 5 }));
    expect(url.searchParams.get("state")).toBe("IL");
    expect(url.searchParams.get("city")).toBe("Chicago");
    expect(url.searchParams.get("category")).toBe("Massage");
    expect(url.searchParams.get("limit")).toBe("5");
  });
});

describe("runQuery", () => {
  it("passes when a returned deal matches expectAnyOf", async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ deals: [{ productId: "p-massage-chi", title: "Swedish Massage", payText: "$49.00" }], count: 1 }), { status: 200 });
    const outcome = await runQuery("https://host.test", "tok", Q, fetchImpl);
    expect(outcome.passed).toBe(true);
    expect(outcome.top).toHaveLength(1);
  });

  it("fails when no returned deal matches", async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ deals: [{ productId: "p-other", title: "Other", payText: "$1.00" }] }), { status: 200 });
    const outcome = await runQuery("https://host.test", "tok", Q, fetchImpl);
    expect(outcome.passed).toBe(false);
  });

  it("passes a live query with no expectations as long as it answers", async () => {
    const live: EvalQuery = { text: "wine tasting", expectAnyOf: [], live: true };
    const fetchImpl = async () => new Response(JSON.stringify({ deals: [] }), { status: 200 });
    const outcome = await runQuery("https://host.test", "tok", live, fetchImpl);
    expect(outcome.passed).toBe(true);
  });

  it("records an HTTP failure without throwing", async () => {
    const fetchImpl = async () => new Response("nope", { status: 500 });
    const outcome = await runQuery("https://host.test", "tok", Q, fetchImpl);
    expect(outcome.passed).toBe(false);
    expect(outcome.error).toBe("HTTP 500");
  });

  it("sends the bearer token", async () => {
    let seenAuth: string | undefined;
    const fetchImpl = async (_input: string | URL | Request, init?: RequestInit) => {
      seenAuth = (init?.headers as Record<string, string> | undefined)?.authorization;
      return new Response(JSON.stringify({ deals: [] }), { status: 200 });
    };
    await runQuery("https://host.test", "my-token", Q, fetchImpl);
    expect(seenAuth).toBe("Bearer my-token");
  });
});

describe("runEval", () => {
  it("counts how many of the queries passed", async () => {
    const queries: EvalQuery[] = [Q, { text: "nothing matches this", expectAnyOf: ["p-nobody"] }];
    const fetchImpl = async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      const q = url.searchParams.get("q");
      const deals = q === Q.text ? [{ productId: "p-massage-chi", title: "Swedish Massage", payText: "$49.00" }] : [];
      return new Response(JSON.stringify({ deals }), { status: 200 });
    };
    const report = await runEval("https://host.test", "tok", queries, fetchImpl);
    expect(report.passedCount).toBe(1);
    expect(report.total).toBe(2);
  });
});

describe("formatOutcome", () => {
  it("marks a live query and shows the top hits", () => {
    const outcome = { query: { text: "wine tasting", expectAnyOf: [], live: true }, top: [{ productId: "p-1", title: "Wine Tasting", payText: "$19.00" }], passed: true, reason: "no expectation given (auto pass)" };
    expect(formatOutcome(outcome, 0)).toContain("[live]");
    expect(formatOutcome(outcome, 0)).toContain("Wine Tasting");
  });

  it("shows no hits when the answer is empty", () => {
    const outcome = { query: { text: "x", expectAnyOf: [] }, top: [], passed: true, reason: "no expectation given (auto pass)", error: undefined };
    expect(formatOutcome(outcome, 0)).toContain("no hits");
  });
});

describe("loadQueries", () => {
  it("loads and parses the real queries file", () => {
    const queries = loadQueries(`${import.meta.dir}/queries.json`);
    expect(queries.length).toBe(20);
    for (const query of queries) expect(typeof query.text).toBe("string");
  });
});
