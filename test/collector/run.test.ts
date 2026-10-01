/**
 * The collector run loop against a fake fetch, fake sleep and a fixed clock. No network.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/collector/run.test.ts
 * Deps:    bun:test, collector/run.ts
 * Tested:  this file
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import type { IngestBatch } from "../../src/contracts/ingest";
import { COLLECTOR_NAME, main, resolveToken, type CollectorIO } from "../../collector/run";

const LISTING = readFileSync(join(import.meta.dir, "fixtures", "listing.html"), "utf8");
const TOKEN = "test-ingest-token-0123456789";
const NOW = new Date("2026-09-29T05:30:00.000Z");

interface Call {
  readonly url: string;
  readonly init: RequestInit;
}

interface World {
  readonly io: CollectorIO;
  readonly calls: Call[];
  readonly sleeps: number[];
  readonly lines: string[];
  readonly posted: IngestBatch[];
}

function makeIo(overrides: {
  readonly pageResponses: Record<string, { status: number; body: string }>;
  readonly listingPages?: readonly string[];
  readonly guideUrl?: string;
}): World {
  const calls: Call[] = [];
  const sleeps: number[] = [];
  const lines: string[] = [];
  const posted: IngestBatch[] = [];

  const io: CollectorIO = {
    async fetch(url, init) {
      calls.push({ url, init });
      if (url.startsWith("https://lab.test/ingest/observations")) {
        posted.push(JSON.parse(String(init.body)) as IngestBatch);
        return new Response(JSON.stringify({ accepted: 1, rejected: 0, reasons: [] }), { status: 200 });
      }
      const found = overrides.pageResponses[url];
      if (!found) throw new Error(`unexpected fetch: ${url}`);
      return new Response(found.body, { status: found.status });
    },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    now: () => NOW,
    print: (line) => lines.push(line),
    token: TOKEN,
    config: {
      host: "https://lab.test",
      guideUrl: overrides.guideUrl ?? "https://www.groupon.com/hubs/partner-storefront-api",
      listingPages: overrides.listingPages ?? ["https://www.groupon.com/local/chicago/massage"],
    },
  };
  return { io, calls, sleeps, lines, posted };
}

describe("main", () => {
  it("posts a public_prices batch and a guide_version batch, and prints one line per page", async () => {
    const { io, calls, sleeps, lines, posted } = makeIo({
      pageResponses: {
        "https://www.groupon.com/local/chicago/massage": { status: 200, body: LISTING },
        "https://www.groupon.com/hubs/partner-storefront-api": { status: 200, body: "Version 7. Changes since version 6." },
      },
    });

    const code = await main(io);

    expect(code).toBe(0);
    expect(posted).toHaveLength(2);
    expect(posted[0]).toMatchObject({ kind: "public_prices", collector: COLLECTOR_NAME });
    expect((posted[0] as Extract<IngestBatch, { kind: "public_prices" }>).observations).toHaveLength(9);
    expect(posted[1]).toMatchObject({
      kind: "guide_version",
      collector: COLLECTOR_NAME,
      observation: { sourceUrl: "https://www.groupon.com/hubs/partner-storefront-api", version: "7", httpStatus: 200 },
    });
    expect(lines[0]).toBe("https://www.groupon.com/local/chicago/massage 200 9 9 0");
    expect(sleeps).toEqual([5000]);
    // the token travels only in the Authorization header sent to the lab, never in the printed run log
    expect(lines.join("\n")).not.toContain(TOKEN);
    const pageRequests = calls.filter((call) => !call.url.startsWith("https://lab.test/"));
    for (const call of pageRequests) {
      expect(JSON.stringify(call.init)).not.toContain(TOKEN);
    }
  });

  it("waits at least 5 seconds between listing pages", async () => {
    const pages = ["https://www.groupon.com/local/chicago/massage", "https://www.groupon.com/local/new-york/massage"];
    const { io, sleeps } = makeIo({
      pageResponses: {
        "https://www.groupon.com/local/chicago/massage": { status: 200, body: LISTING },
        "https://www.groupon.com/local/new-york/massage": { status: 200, body: LISTING },
        "https://www.groupon.com/hubs/partner-storefront-api": { status: 200, body: "Version 7." },
      },
      listingPages: pages,
    });

    await main(io);

    expect(sleeps.filter((ms) => ms >= 5000).length).toBeGreaterThanOrEqual(pages.length);
  });

  it("records a non-200 page in the run log, skips it, and does not stop before three in a row", async () => {
    const pages = ["https://www.groupon.com/local/chicago/massage", "https://www.groupon.com/local/new-york/massage"];
    const { io, lines } = makeIo({
      pageResponses: {
        "https://www.groupon.com/local/chicago/massage": { status: 403, body: "" },
        "https://www.groupon.com/local/new-york/massage": { status: 200, body: LISTING },
        "https://www.groupon.com/hubs/partner-storefront-api": { status: 200, body: "Version 7." },
      },
      listingPages: pages,
    });

    const code = await main(io);

    expect(code).toBe(0);
    expect(lines[0]).toBe("https://www.groupon.com/local/chicago/massage 403 0 0 0");
    expect(lines[1]).toBe("https://www.groupon.com/local/new-york/massage 200 9 9 0");
  });

  it("stops after three failures in a row and never retries a page in the run", async () => {
    const pages = [
      "https://www.groupon.com/local/a",
      "https://www.groupon.com/local/b",
      "https://www.groupon.com/local/c",
      "https://www.groupon.com/local/d",
    ];
    const { io, calls, lines } = makeIo({
      pageResponses: {
        "https://www.groupon.com/local/a": { status: 500, body: "" },
        "https://www.groupon.com/local/b": { status: 500, body: "" },
        "https://www.groupon.com/local/c": { status: 500, body: "" },
        "https://www.groupon.com/local/d": { status: 200, body: LISTING },
      },
      listingPages: pages,
    });

    const code = await main(io);

    expect(code).toBe(1);
    expect(lines).toEqual([
      "https://www.groupon.com/local/a 500 0 0 0",
      "https://www.groupon.com/local/b 500 0 0 0",
      "https://www.groupon.com/local/c 500 0 0 0",
    ]);
    const pageCalls = calls.filter((call) => call.url.startsWith("https://www.groupon.com/local/"));
    expect(pageCalls).toHaveLength(3);
    expect(pageCalls.map((call) => call.url)).toEqual([
      "https://www.groupon.com/local/a",
      "https://www.groupon.com/local/b",
      "https://www.groupon.com/local/c",
    ]);
  });

  it("exits non-zero when nothing was accepted", async () => {
    const { io } = makeIo({
      pageResponses: {
        "https://www.groupon.com/local/chicago/massage": { status: 200, body: "<html>no deals here</html>" },
        "https://www.groupon.com/hubs/partner-storefront-api": { status: 200, body: "Version 7." },
      },
    });

    expect(await main(io)).toBe(1);
  });
});

describe("resolveToken", () => {
  it("reads ZAL_INGEST_TOKEN from the environment when it is set", () => {
    expect(resolveToken({ ZAL_INGEST_TOKEN: TOKEN } as NodeJS.ProcessEnv)).toBe(TOKEN);
  });

  // The ~/s/.env.master fallback is not exercised here: this lane never reads that vault in a
  // test, real or fake. It is covered by manual verification on zora before the timer is enabled.
});
