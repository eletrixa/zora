/**
 * Tests for the latency bars block: p50 in front of p95 on one track, both figures in one value,
 * the legend and the axis in seconds, and "Show all N steps" past the first eight.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/ui/components/latency-bars.test.ts
 * Deps:    bun:test, src/ui/components/blocks.ts
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { latencyBars } from "../../../src/ui/components/blocks";
import type { LatencyBar } from "../../../src/ui/components/blocks";

const row = (label: string, p50Ms: number, p95Ms: number): LatencyBar => ({ label, p50Ms, p95Ms });

describe("latencyBars", () => {
  it("draws p95 behind and p50 in front on a 0 to 4 s scale, with both figures in one value", () => {
    const html = latencyBars([row("price-mismatch · current-price", 524, 3723)]);
    expect(html).toContain('<div class="histogram-back" style="width:93.1%"></div><div class="histogram-bar" style="width:13.1%"></div>');
    expect(html).toContain('<span class="histogram-value">524 · 3,723 ms</span>');
    expect(html).toContain('<div class="latency-axis" aria-hidden="true"><span>0</span><span>1 s</span><span>2 s</span><span>3 s</span><span>4 s</span></div>');
  });

  it("keeps each half of the step name whole, so it wraps at the dot", () => {
    expect(latencyBars([row("price-mismatch · current-price", 1, 2)])).toContain(
      '<span class="latency-half">price-mismatch ·</span> <span class="latency-half">current-price</span>',
    );
  });

  it("names both bars in the legend", () => {
    const html = latencyBars([row("a · b", 1, 2)]);
    expect(html).toContain("p50, the typical call");
    expect(html).toContain("p95, the slowest 1 in 20");
  });

  it("widens the scale in whole seconds, at most five ticks, when a step is slower than 4 s", () => {
    const html = latencyBars([row("a · b", 1000, 9200)]);
    expect(html).toContain("<span>0</span><span>3 s</span><span>6 s</span><span>9 s</span><span>12 s</span>");
  });

  it("shows eight rows and puts the rest behind Show all N steps", () => {
    const rows = Array.from({ length: 10 }, (_, i) => row(`check · step-${i}`, 100, 200));
    const html = latencyBars(rows);
    expect(html).toContain('<summary class="empty-link">Show all 10 steps</summary>');
    expect(html.indexOf("step-7")).toBeLessThan(html.indexOf("<details"));
    expect(html.indexOf("step-8")).toBeGreaterThan(html.indexOf("<details"));
    expect(latencyBars(rows.slice(0, 8))).not.toContain("<details");
  });

  it("escapes a step name that carries HTML", () => {
    const html = latencyBars([row("<b>x</b> · y", 1, 2)]);
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<b>x</b>");
  });
});
