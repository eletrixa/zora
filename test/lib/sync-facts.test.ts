/**
 * The sync figures both pages print: complete, running, failed, late, a run left open (never late), a run
 * resumed and finished in the current window (never late), none,
 * a stamp from another day, and the stamp and the state sentence given apart.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/lib/sync-facts.test.ts
 * Deps:    bun:test, src/lib/sync-facts.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import type { SyncRunRow, SyncStatus } from "../../src/contracts/reports";
import { syncFacts } from "../../src/lib/sync-facts";

const run = (runId: string, kind: SyncRunRow["kind"], status: SyncRunRow["status"], startedAt: string, finishedAt: string | null): SyncRunRow => ({
  runId,
  kind,
  status,
  startedAt,
  finishedAt,
  pages: 1,
  products: 1,
  errors: 0,
});
const status = (...runs: SyncRunRow[]): SyncStatus => ({ lastRefreshAt: null, runs, totalProducts: 0, listableProducts: 0 });
const AT_10_40 = Date.parse("2026-10-01T10:40:00.000Z");
const AT_09_10 = Date.parse("2026-10-01T09:10:00.000Z");
const DONE_06 = run("d1", "delta", "complete", "2026-10-01T06:00:00.000Z", "2026-10-01T06:05:00.000Z");

describe("syncFacts", () => {
  it("names the newest complete delta run's own finish time", () => {
    const done09 = run("d2", "delta", "complete", "2026-10-01T09:00:00.000Z", "2026-10-01T09:05:00.000Z");
    expect(syncFacts(status(DONE_06, done09), AT_10_40).lastDelta).toBe("09:05 UTC");
  });
  it("adds a run still going in the current window", () => {
    const running = run("d2", "delta", "running", "2026-10-01T09:00:00.000Z", null);
    expect(syncFacts(status(DONE_06, running), AT_10_40).lastDelta).toBe("06:05 UTC. Running since 09:00 UTC");
  });
  it("adds a run that failed in the current window", () => {
    const failed = run("d2", "delta", "failed", "2026-10-01T09:00:00.000Z", "2026-10-01T09:01:00.000Z");
    expect(syncFacts(status(DONE_06, failed), AT_10_40).lastDelta).toBe("06:05 UTC. Failed at 09:01 UTC");
  });
  it("calls a window late once it is 30 minutes old with no run started", () => {
    expect(syncFacts(status(DONE_06), AT_10_40).lastDelta).toBe("06:05 UTC. Late: the 09:00 UTC sync has not started");
    expect(syncFacts(status(DONE_06), AT_09_10).lastDelta).toBe("06:05 UTC");
  });
  it("names a run left open from an earlier window and never calls the window late, because each call continues that run", () => {
    const open = run("d2", "delta", "running", "2026-10-01T06:01:00.000Z", null);
    expect(syncFacts(status(DONE_06, open), AT_10_40).lastDelta).toBe("06:05 UTC. Running since 06:01 UTC");
  });
  it("never calls the window late when a run left open from an earlier window finished in it", () => {
    const resumed = run("d2", "delta", "complete", "2026-10-01T06:01:00.000Z", "2026-10-01T09:50:00.000Z");
    expect(syncFacts(status(DONE_06, resumed), AT_10_40).lastDelta).toBe("09:50 UTC");
  });
  it("names a run left open from an earlier window that failed in the current one", () => {
    const resumed = run("d2", "delta", "failed", "2026-10-01T06:01:00.000Z", "2026-10-01T09:50:00.000Z");
    expect(syncFacts(status(DONE_06, resumed), AT_10_40).lastDelta).toBe("06:05 UTC. Failed at 09:50 UTC");
  });
  it("says none yet before any run", () => {
    expect(syncFacts(status(), AT_10_40)).toEqual({ lastDelta: "none yet", lastDeltaAt: "none yet", lastDeltaNote: null, deltasToday: 0, lastFull: "none yet" });
  });
  it("gives the stamp and the state sentence apart, so a card can print the stamp as its value", () => {
    const open = run("d2", "delta", "running", "2026-10-01T06:01:00.000Z", null);
    const facts = syncFacts(status(DONE_06, open), AT_10_40);
    expect(facts.lastDeltaAt).toBe("06:05 UTC");
    expect(facts.lastDeltaNote).toBe("Running since 06:01 UTC.");
    expect(facts.lastDelta).toBe(`${facts.lastDeltaAt}. ${facts.lastDeltaNote!.slice(0, -1)}`);
  });
  it("has no state sentence when the newest delta run is complete and on time", () => {
    const done09 = run("d2", "delta", "complete", "2026-10-01T09:00:00.000Z", "2026-10-01T09:05:00.000Z");
    const facts = syncFacts(status(DONE_06, done09), AT_10_40);
    expect(facts.lastDeltaAt).toBe("09:05 UTC");
    expect(facts.lastDeltaNote).toBeNull();
  });
  it("names the day of a stamp from another day", () => {
    const yesterday = run("d0", "delta", "complete", "2026-09-30T21:00:00.000Z", "2026-09-30T21:05:00.000Z");
    expect(syncFacts(status(yesterday), Date.parse("2026-10-01T00:20:00.000Z")).lastDelta).toBe("30 Sep, 21:05 UTC");
  });
  it("counts only complete delta runs started today and skips a failed full load", () => {
    const facts = syncFacts(
      status(
        run("f1", "full", "complete", "2026-09-29T00:30:00.000Z", "2026-09-29T02:10:00.000Z"),
        run("f2", "full", "failed", "2026-09-30T00:30:00.000Z", "2026-09-30T00:40:00.000Z"),
        run("d0", "delta", "complete", "2026-09-30T21:00:00.000Z", "2026-09-30T21:05:00.000Z"),
        DONE_06,
        run("d2", "delta", "failed", "2026-10-01T09:00:00.000Z", "2026-10-01T09:01:00.000Z"),
      ),
      AT_10_40,
    );
    expect(facts.deltasToday).toBe(1);
    expect(facts.lastFull).toBe("29 Sep");
  });
});
