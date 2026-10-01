/**
 * Tests for the designed partner scorecard page: the hero's age line, the verdict banner naming the
 * failing step, the tiles row, the Runs section, the remaining sections and the foot line; and the
 * 404 page built from the same blocks.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/ui/pages/scorecard.test.tsx
 * Deps:    bun:test, src/ui/pages/scorecard.tsx, src/ui/pages/not-found.tsx, src/contracts/reports.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { ageText, renderScorecard, verdictOf } from "../../../src/ui/pages/scorecard";
import { renderNotFound } from "../../../src/ui/pages/not-found";
import type { ProbeRunRow, ScorecardReport, SyncStatus } from "../../../src/contracts/reports";

const NOW = Date.UTC(2026, 8, 30, 12, 0, 0);

const EMPTY_REPORT: ScorecardReport = {
  latestRun: null,
  runs: [],
  passRate7d: null,
  passRate30d: null,
  latency: [],
  drift: [],
  findings: [],
  failingSteps: [],
};

const EMPTY_SYNC: SyncStatus = {
  lastRefreshAt: null,
  runs: [],
  totalProducts: 0,
  listableProducts: 0,
};

const RUN: ProbeRunRow = {
  runId: "r1",
  startedAt: new Date(NOW - 3 * 3_600_000 - 60_000).toISOString(),
  finishedAt: new Date(NOW - 3 * 3_600_000).toISOString(),
  verdict: "pass",
  passed: 12,
  failed: 0,
  skipped: 1,
};

const FULL_REPORT: ScorecardReport = {
  latestRun: RUN,
  runs: [RUN],
  passRate7d: 0.94,
  passRate30d: 0.9,
  latency: [{ check: "products-list", step: "list-products", samples: 20, p50Ms: 412, p95Ms: 980 }],
  drift: [{ at: RUN.finishedAt, kind: "openapi", from: "v003", to: "v004" }],
  findings: [
    { id: "F-001", at: RUN.finishedAt, area: "Page size", expected: "defaults to 100", observed: "walk with 50", severity: "major", status: "open" },
    { id: "F-002", at: RUN.finishedAt, area: "Search", expected: "search endpoint exists", observed: "no search endpoint", severity: "major", status: "reported" },
  ],
  failingSteps: [{ runId: "r0", check: "refusals", step: "state-code", detail: "guide: a state abbreviation with no state scope answers HTTP 200 with zero products; observed HTTP 400 with no products array" }],
};

const FAILED_RUN: ProbeRunRow = { ...RUN, runId: "r2", verdict: "fail", passed: 36, failed: 1 };
const FAILED_REPORT: ScorecardReport = { ...FULL_REPORT, latestRun: FAILED_RUN, runs: [FAILED_RUN] };

const FULL_SYNC: SyncStatus = {
  lastRefreshAt: RUN.finishedAt,
  totalProducts: 57204,
  listableProducts: 41880,
  runs: [
    { runId: "s1", kind: "full", status: "complete", startedAt: RUN.startedAt, finishedAt: RUN.finishedAt, pages: 3, products: 57204, errors: 0 },
    { runId: "s2", kind: "delta", status: "complete", startedAt: RUN.startedAt, finishedAt: RUN.finishedAt, pages: 1, products: 131, errors: 0 },
  ],
};

describe("ageText", () => {
  it("says minutes, hours or days ago, never negative", () => {
    expect(ageText(new Date(NOW - 30_000).toISOString(), NOW)).toBe("0 minutes ago");
    expect(ageText(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe("5 minutes ago");
    expect(ageText(new Date(NOW - 3 * 3_600_000).toISOString(), NOW)).toBe("3 hours ago");
    expect(ageText(new Date(NOW - 50 * 3_600_000).toISOString(), NOW)).toBe("2 days ago");
  });
});

describe("verdictOf", () => {
  it("answers PASS with both step rates on a passed run", () => {
    const verdict = verdictOf(FULL_REPORT);
    expect(verdict.tone).toBe("pass");
    expect(verdict.title).toBe("PASS");
    expect(verdict.text).toContain("Every step that ran passed");
    expect(verdict.figures).toEqual([
      { label: "Steps, 7 days", value: "94.0 %" },
      { label: "Steps, 30 days", value: "90.0 %" },
    ]);
  });

  it("answers FAIL naming the failing step", () => {
    const verdict = verdictOf(FAILED_REPORT);
    expect(verdict.tone).toBe("fail");
    expect(verdict.title).toBe("FAIL");
    expect(verdict.text).toContain("1 of 38 steps failed");
    expect(verdict.text).toContain("a state abbreviation with no state scope");
  });

  it("builds the FAIL sentence from the observed half, then what the guide promises, never the raw detail", () => {
    const verdict = verdictOf(FAILED_REPORT);
    expect(verdict.text).toBe(
      "1 of 38 steps failed: HTTP 400 with no products array where the guide promises a state abbreviation with no state scope answers HTTP 200 with zero products.",
    );
    expect(verdict.text).not.toContain("guide:");
    expect(verdict.text).not.toContain("observed");
    expect(verdict.text).not.toContain(";");
  });

  it("answers neutral with the schedule when there is no run", () => {
    const verdict = verdictOf(EMPTY_REPORT);
    expect(verdict.tone).toBe("neutral");
    expect(verdict.text).toBe("The probe runs daily at 04:00 UTC.");
    expect(verdict.figures).toBeUndefined();
  });

  it("says a step rate has no runs yet in its window instead of a bare number", () => {
    const verdict = verdictOf({ ...FULL_REPORT, passRate7d: null });
    expect(verdict.figures?.[0]?.value).toBe("no runs yet in this window");
  });
});

describe("renderScorecard, no data yet", () => {
  it("opens with the age line as the lead, before anything else in the main content", async () => {
    const html = await renderScorecard({ report: EMPTY_REPORT, sync: EMPTY_SYNC, now: NOW });
    expect(html.indexOf("No probe run yet.")).toBeGreaterThan(-1);
    expect(html.indexOf("No probe run yet.")).toBeLessThan(html.indexOf("Failing steps"));
  });

  it("states the schedule in the verdict banner", async () => {
    const html = await renderScorecard({ report: EMPTY_REPORT, sync: EMPTY_SYNC, now: NOW });
    expect(html).toContain("The probe runs daily at 04:00 UTC.");
  });

  it("gives a time or schedule for every empty section", async () => {
    const html = await renderScorecard({ report: EMPTY_REPORT, sync: EMPTY_SYNC, now: NOW });
    expect(html).toContain("Tiles appear after the first probe run");
    expect(html).toContain("The run history appears after the first probe run");
    expect(html).toContain("Every step of the latest run passed.");
    expect(html).toContain("Latency appears after the first probe run; the probe runs daily at 04:00 UTC.");
    expect(html).toContain("Sync runs appear once the first catalogue load has run");
    expect(html).toContain("No drift seen. The openapi.json hash and the guide version are compared on every daily run.");
    expect(html).toContain("No finding recorded yet.");
    expect(html).not.toContain("no data");
    expect(html).not.toContain("not working yet");
  });
});

describe("renderScorecard, a run with data", () => {
  it("gives the exact age line, the stamp as YYYY-MM-DD hh:mm UTC rather than raw ISO", async () => {
    const html = await renderScorecard({ report: FULL_REPORT, sync: FULL_SYNC, now: NOW });
    expect(html).toContain("Last probe run 3 hours ago (2026-09-30 09:00 UTC): <strong>pass, 12 passed, 0 failed, 1 skipped</strong>.");
  });

  it("bolds the run counts and adds the daily-walk sentence after them, nothing else, in the hero lead", async () => {
    const html = await renderScorecard({ report: FULL_REPORT, sync: FULL_SYNC, now: NOW });
    expect(html).toContain(
      "Every day at 04:00 UTC the probe walks the partner journey on production, as an outside builder would.",
    );
    const lead = html.slice(html.indexOf('<p class="lead">'), html.indexOf("</p>", html.indexOf('<p class="lead">')));
    expect(lead).toBe(
      '<p class="lead">Last probe run 3 hours ago (2026-09-30 09:00 UTC): <strong>pass, 12 passed, 0 failed, 1 skipped</strong>. ' +
        "Every day at 04:00 UTC the probe walks the partner journey on production, as an outside builder would.",
    );
  });

  it("states the PASS verdict with both step rates at the banner's right", async () => {
    const html = await renderScorecard({ report: FULL_REPORT, sync: FULL_SYNC, now: NOW });
    expect(html).toContain('class="verdict verdict--pass"');
    expect(html).toContain("PASS");
    expect(html).toContain("Steps, 7 days");
    expect(html).toContain("Steps, 30 days");
    expect(html).toContain("94.0 %");
    expect(html).toContain("90.0 %");
  });

  it("states the FAIL verdict naming the failing step", async () => {
    const html = await renderScorecard({ report: FAILED_REPORT, sync: FULL_SYNC, now: NOW });
    expect(html).toContain('class="verdict verdict--fail"');
    expect(html).toContain("FAIL");
    expect(html).toContain("a state abbreviation with no state scope");
  });

  it("builds the banner's FAIL sentence as one plain sentence, not the check's raw guide/observed detail", async () => {
    const html = await renderScorecard({ report: FAILED_REPORT, sync: FULL_SYNC, now: NOW });
    const banner = html.slice(html.indexOf('class="verdict verdict--fail"'), html.indexOf("</p>", html.indexOf('class="verdict verdict--fail"')));
    expect(banner).toContain(
      "1 of 38 steps failed: HTTP 400 with no products array where the guide promises a state abbreviation with no state scope answers HTTP 200 with zero products.",
    );
    expect(banner).not.toContain("guide:");
    expect(banner).not.toContain("observed");
    expect(banner).not.toContain(";");
  });

  it("draws one strip square per day with the day's last run's tone and a short date in the title", async () => {
    const html = await renderScorecard({ report: FULL_REPORT, sync: FULL_SYNC, now: NOW });
    expect(html).toContain('<span class="day day--pass"');
    expect(html).toContain('title="30 Sep: Pass"');
  });

  it("keeps the strip at 30 days regardless of run history length, newest last", async () => {
    // The read model lists runs newest first; the fixture matches that. One run a day, 1 to 35 days ago,
    // so today itself carries no run.
    const runs: ProbeRunRow[] = Array.from({ length: 35 }, (_, i) => ({
      ...RUN,
      runId: `r${i}`,
      finishedAt: new Date(NOW - (i + 1) * 24 * 3_600_000).toISOString(),
      startedAt: new Date(NOW - (i + 1) * 24 * 3_600_000).toISOString(),
    }));
    const html = await renderScorecard({ report: { ...FULL_REPORT, runs }, sync: FULL_SYNC, now: NOW });
    const squares = html.match(/class="day day--(?:pass|fail|none)" title="[^"]*"/g) ?? [];
    expect(squares.length).toBe(30);
    expect(html).toContain('title="30 Sep: No run"'); // today, no run yet
    expect(html).toContain('title="29 Sep: Pass"'); // 1 day ago, the newest run
    expect(html).toContain('title="1 Sep: Pass"'); // 29 days ago, the oldest kept
    expect(html).not.toContain('title="31 Aug:'); // 30 days ago, dropped
    expect(html.indexOf('title="1 Sep: Pass"')).toBeLessThan(html.indexOf('title="29 Sep: Pass"'));
  });

  it("fills a day with no run as its own square, counts the title and note in days, not runs", async () => {
    // A run every day of the last 30 except 29 Sep (1 day ago); 28 Sep (2 days ago) fails.
    const runs: ProbeRunRow[] = Array.from({ length: 30 }, (_, i) => i)
      .filter((i) => i !== 1)
      .map((i) => {
        const finishedAt = new Date(NOW - i * 24 * 3_600_000).toISOString();
        const fail = i === 2;
        return { ...RUN, runId: `d${i}`, finishedAt, startedAt: finishedAt, verdict: fail ? "fail" : "pass", passed: fail ? 38 : 12, failed: fail ? 1 : 0 };
      });
    const html = await renderScorecard({ report: { ...FULL_REPORT, runs }, sync: FULL_SYNC, now: NOW });
    expect(html).toContain('title="30 Sep: Pass"');
    expect(html).toContain('title="29 Sep: No run"');
    expect(html).toContain('title="28 Sep: Fail"');
    expect(html).toContain("Last 30 days: 28 of 29 runs passed");
    expect(html).toContain("Last fail on 28 Sep: 1 of 40 steps failed. No run on 29 Sep: the job did not run.");
  });

  it("has a Runs section: the strip card's last-30-days title beside the Latest run card", async () => {
    const html = await renderScorecard({ report: FULL_REPORT, sync: FULL_SYNC, now: NOW });
    expect(html).toContain("Last 30 days: 1 of 1 runs passed");
    expect(html).toContain("Latest run: 30 Sep");
  });

  it("groups a long run of missing days into one range, not a date for each day", async () => {
    // 2026-10-01, 02:11 UTC: a run on 29 and 30 Sep only, so 2 to 28 Sep (27 days) are missing and
    // today's own run is not due until 04:00 UTC.
    const dueNow = Date.UTC(2026, 9, 1, 2, 11, 0);
    const runs: ProbeRunRow[] = [
      { ...RUN, runId: "g1", finishedAt: "2026-09-29T04:00:00.000Z", startedAt: "2026-09-29T03:50:00.000Z" },
      { ...RUN, runId: "g2", finishedAt: "2026-09-30T04:00:00.000Z", startedAt: "2026-09-30T03:50:00.000Z" },
    ];
    const html = await renderScorecard({ report: { ...FULL_REPORT, latestRun: runs[1]!, runs }, sync: FULL_SYNC, now: dueNow });
    expect(html).toContain("No run from 2 to 28 Sep: the job did not run.");
    expect(html).not.toContain("2 Sep, 3 Sep");
  });

  it("does not count or name today as missed before its run time", async () => {
    const dueNow = Date.UTC(2026, 9, 1, 2, 11, 0);
    const runs: ProbeRunRow[] = [
      { ...RUN, runId: "g1", finishedAt: "2026-09-29T04:00:00.000Z", startedAt: "2026-09-29T03:50:00.000Z" },
      { ...RUN, runId: "g2", finishedAt: "2026-09-30T04:00:00.000Z", startedAt: "2026-09-30T03:50:00.000Z" },
    ];
    const html = await renderScorecard({ report: { ...FULL_REPORT, latestRun: runs[1]!, runs }, sync: FULL_SYNC, now: dueNow });
    expect(html).toContain('title="1 Oct: due at 04:00 UTC"');
    expect(html).toContain("Today&#39;s run is due at 04:00 UTC.");
    expect(html).not.toContain("1 Oct: the job did not run");
    expect(html).not.toContain("28 Sep and 1 Oct");
  });

  it("shows the tiles row: steps passed, days with a run, slowest p95, open findings", async () => {
    const html = await renderScorecard({ report: FULL_REPORT, sync: FULL_SYNC, now: NOW });
    expect(html).toContain("Steps passed");
    expect(html).toContain("12 of 13");
    expect(html).toContain("Days with a run");
    expect(html).toContain("Slowest p95");
    expect(html).toContain("Open findings");
  });

  it("shows the failing step with its detail sentence", async () => {
    const html = await renderScorecard({ report: FULL_REPORT, sync: FULL_SYNC, now: NOW });
    expect(html).toContain("state-code");
    expect(html).toContain("Guide: a state abbreviation with no state scope answers HTTP 200 with zero products");
  });

  it("titles the Failing steps card with the count and splits the detail into Expected and Observed lines", async () => {
    const html = await renderScorecard({ report: FAILED_REPORT, sync: FULL_SYNC, now: NOW });
    expect(html).toContain("1 of 38 steps failed");
    expect(html).toContain("Expected: </span>Guide: a state abbreviation with no state scope answers HTTP 200 with zero products");
    expect(html).toContain("Observed: </span>HTTP 400 with no products array");
    expect(html).toContain("The other 37 steps: 36 passed, 1 skipped.");
  });

  it("drops a repeated label from the failing step's own words", async () => {
    const html = await renderScorecard({ report: FAILED_REPORT, sync: FULL_SYNC, now: NOW });
    expect(html).not.toContain("Expected: </span>guide:");
    expect(html).not.toContain("Observed: </span>observed");
  });

  it("shows latency with p50 and p95 figures", async () => {
    const html = await renderScorecard({ report: FULL_REPORT, sync: FULL_SYNC, now: NOW });
    expect(html).toContain("p50");
    expect(html).toContain("p95");
    expect(html).toContain("412");
    expect(html).toContain("980");
  });

  it("draws latency as p50 in front of p95 with both figures in one value, slowest p95 first", async () => {
    const latency = [
      { check: "products-list", step: "list-products", samples: 20, p50Ms: 412, p95Ms: 980 },
      { check: "price-mismatch", step: "current-price", samples: 20, p50Ms: 524, p95Ms: 3723 },
    ];
    const html = await renderScorecard({ report: { ...FULL_REPORT, latency }, sync: FULL_SYNC, now: NOW });
    expect(html).toContain('class="latency"');
    expect(html).toContain("524 · 3,723 ms");
    expect(html.indexOf("current-price")).toBeLessThan(html.indexOf("list-products"));
  });

  it("shows the Catalogue sync section with the Latest syncs table and the Next sync card", async () => {
    const html = await renderScorecard({ report: FULL_REPORT, sync: FULL_SYNC, now: NOW });
    expect(html).toContain("Catalogue sync");
    expect(html).toContain("Latest syncs");
    expect(html).toContain("Next sync");
    expect(html).toContain("57,204");
    expect(html).toContain("41,880");
    expect(html).toContain("Last full load");
    expect(html).toContain("Last delta sync");
  });

  it("formats the sync table's Started cell as YYYY-MM-DD hh:mm, not the raw ISO stamp", async () => {
    const html = await renderScorecard({ report: FULL_REPORT, sync: FULL_SYNC, now: NOW });
    const section = html.slice(html.indexOf("Catalogue sync"));
    expect(section).toContain("2026-09-30 08:59");
    expect(section).not.toContain(RUN.startedAt);
  });

  it("labels the Next sync card as scheduled, not a measured fact", async () => {
    const html = await renderScorecard({ report: FULL_REPORT, sync: FULL_SYNC, now: NOW });
    expect(html).toContain("Next sync: 15:00 UTC, scheduled");
  });

  describe("Last delta sync: complete, running, failed, late and none", () => {
    const BOUNDARY = Date.UTC(2026, 8, 30, 21, 0, 0); // a three-hourly cron boundary, 21:00 UTC

    it("states the window's own complete run as the value, with no note when nothing is open or late", async () => {
      const sync: SyncStatus = {
        ...EMPTY_SYNC,
        runs: [
          {
            runId: "d1",
            kind: "delta",
            status: "complete",
            startedAt: new Date(BOUNDARY).toISOString(),
            finishedAt: new Date(BOUNDARY + 5 * 60_000).toISOString(),
            pages: 1,
            products: 10,
            errors: 0,
          },
        ],
      };
      const html = await renderScorecard({ report: FULL_REPORT, sync, now: BOUNDARY + 10 * 60_000 });
      const section = html.slice(html.indexOf("Catalogue sync"));
      expect(section).toContain("<dt>Last delta sync</dt><dd>21:05 UTC</dd>");
      expect(section).not.toContain("Running since");
      expect(section).not.toContain("Failed at");
      expect(section).not.toContain("Late:");
    });

    it("adds Running since when the window's own run has not finished", async () => {
      const lastComplete = BOUNDARY - 3 * 3_600_000;
      const sync: SyncStatus = {
        ...EMPTY_SYNC,
        runs: [
          { runId: "d2", kind: "delta", status: "running", startedAt: new Date(BOUNDARY + 2 * 60_000).toISOString(), finishedAt: null, pages: 0, products: 0, errors: 0 },
          {
            runId: "d1",
            kind: "delta",
            status: "complete",
            startedAt: new Date(lastComplete).toISOString(),
            finishedAt: new Date(lastComplete + 5 * 60_000).toISOString(),
            pages: 1,
            products: 10,
            errors: 0,
          },
        ],
      };
      const html = await renderScorecard({ report: FULL_REPORT, sync, now: BOUNDARY + 20 * 60_000 });
      const section = html.slice(html.indexOf("Catalogue sync"));
      expect(section).toContain("<dt>Last delta sync</dt><dd>18:05 UTC</dd>");
      expect(section).toContain('<p class="box-note">Running since 21:02 UTC.</p>');
    });

    it("adds Failed at when the window's own run did not finish cleanly", async () => {
      const sync: SyncStatus = {
        ...EMPTY_SYNC,
        runs: [
          {
            runId: "d1",
            kind: "delta",
            status: "failed",
            startedAt: new Date(BOUNDARY + 1 * 60_000).toISOString(),
            finishedAt: new Date(BOUNDARY + 3 * 60_000).toISOString(),
            pages: 0,
            products: 0,
            errors: 1,
          },
        ],
      };
      const html = await renderScorecard({ report: FULL_REPORT, sync, now: BOUNDARY + 20 * 60_000 });
      const section = html.slice(html.indexOf("Catalogue sync"));
      expect(section).toContain("<dt>Last delta sync</dt><dd>none yet</dd>");
      expect(section).toContain('<p class="box-note">Failed at 21:03 UTC.</p>');
    });

    it("says the sync is late once its window is 30 minutes old with no run started in it", async () => {
      const lastComplete = BOUNDARY - 3 * 3_600_000;
      const sync: SyncStatus = {
        ...EMPTY_SYNC,
        runs: [
          {
            runId: "d1",
            kind: "delta",
            status: "complete",
            startedAt: new Date(lastComplete).toISOString(),
            finishedAt: new Date(lastComplete + 5 * 60_000).toISOString(),
            pages: 1,
            products: 10,
            errors: 0,
          },
        ],
      };
      const html = await renderScorecard({ report: FULL_REPORT, sync, now: BOUNDARY + 31 * 60_000 });
      const section = html.slice(html.indexOf("Catalogue sync"));
      expect(section).toContain("<dt>Last delta sync</dt><dd>18:05 UTC</dd>");
      expect(section).toContain('<p class="box-note">Late: the 21:00 UTC sync has not started.</p>');
    });

    it("never calls a sync late before any sync has run", async () => {
      const html = await renderScorecard({ report: FULL_REPORT, sync: EMPTY_SYNC, now: BOUNDARY + 31 * 60_000 });
      const section = html.slice(html.indexOf("Catalogue sync"));
      expect(section).toContain("<dt>Last delta sync</dt><dd>none yet</dd>");
    });

    it("says none yet before 30 minutes pass and no delta sync has ever completed", async () => {
      const html = await renderScorecard({ report: FULL_REPORT, sync: EMPTY_SYNC, now: BOUNDARY + 10 * 60_000 });
      const section = html.slice(html.indexOf("Catalogue sync"));
      expect(section).toContain("<dt>Last delta sync</dt><dd>none yet</dd>");
    });
  });

  it("counts only complete delta runs toward Delta syncs today, not a failed one", async () => {
    const today = Date.UTC(2026, 8, 30, 21, 0, 0);
    const sync: SyncStatus = {
      ...EMPTY_SYNC,
      runs: [
        {
          runId: "d1",
          kind: "delta",
          status: "complete",
          startedAt: new Date(today).toISOString(),
          finishedAt: new Date(today + 5 * 60_000).toISOString(),
          pages: 1,
          products: 10,
          errors: 0,
        },
        {
          runId: "d2",
          kind: "delta",
          status: "failed",
          startedAt: new Date(today - 3 * 3_600_000).toISOString(),
          finishedAt: new Date(today - 3 * 3_600_000 + 60_000).toISOString(),
          pages: 0,
          products: 0,
          errors: 1,
        },
      ],
    };
    const html = await renderScorecard({ report: FULL_REPORT, sync, now: today + 10 * 60_000 });
    const section = html.slice(html.indexOf("Catalogue sync"));
    expect(section).toContain("<dt>Delta syncs today</dt><dd>1</dd>");
  });

  it("shows the drift rows", async () => {
    const html = await renderScorecard({ report: FULL_REPORT, sync: FULL_SYNC, now: NOW });
    expect(html).toContain("openapi");
    expect(html).toContain("v003");
    expect(html).toContain("v004");
  });

  it("shows both findings by id", async () => {
    const html = await renderScorecard({ report: FULL_REPORT, sync: FULL_SYNC, now: NOW });
    expect(html).toContain("F-001");
    expect(html).toContain("F-002");
  });

  it("names the schedule in the foot line", async () => {
    const html = await renderScorecard({ report: FULL_REPORT, sync: FULL_SYNC, now: NOW });
    expect(html).toContain("04:00 UTC");
    expect(html).toContain("every 3 hours");
    expect(html).toContain("Mondays at 05:00 UTC");
  });

  it("names the refresh schedule on every section head", async () => {
    const html = await renderScorecard({ report: FULL_REPORT, sync: FULL_SYNC, now: NOW });
    const dailyRefreshes = html.match(/Refreshes daily at 04:00 UTC/g) ?? [];
    expect(dailyRefreshes.length).toBe(5); // Runs, Failing steps, Latency, Contract drift, Findings
    expect(html).toContain("Refreshes every 3 hours"); // Catalogue sync
  });

  it("marks the Scorecard nav link current", async () => {
    const html = await renderScorecard({ report: FULL_REPORT, sync: FULL_SYNC, now: NOW });
    expect(html).toContain('<a href="/scorecard" aria-current="page">Scorecard</a>');
  });

  it("escapes a finding text that carries HTML", async () => {
    const hostile: ScorecardReport = {
      ...FULL_REPORT,
      findings: [{ id: "F-003", at: RUN.finishedAt, area: "Carts", expected: "x", observed: "<script>alert(1)</script>", severity: "minor", status: "open" }],
    };
    const html = await renderScorecard({ report: hostile, sync: FULL_SYNC, now: NOW });
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("escapes a hostile failing-step detail", async () => {
    const hostile: ScorecardReport = {
      ...FULL_REPORT,
      failingSteps: [{ runId: "r0", check: "refusals", step: "bad-cursor", detail: "<script>alert(1)</script>" }],
    };
    const html = await renderScorecard({ report: hostile, sync: FULL_SYNC, now: NOW });
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("never says no data", async () => {
    const html = await renderScorecard({ report: FULL_REPORT, sync: FULL_SYNC, now: NOW });
    expect(html).not.toContain("no data");
  });
});

describe("renderNotFound", () => {
  it("names the path and links to the home page and to the finder", async () => {
    const html = await renderNotFound({ path: "/nope" });
    expect(html).toContain("There is nothing at /nope");
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/find"');
  });

  it("escapes a hostile path", async () => {
    const html = await renderNotFound({ path: '/"><script>alert(1)</script>' });
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
