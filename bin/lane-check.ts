#!/usr/bin/env bun
/**
 * Fails when a lane branch touches a file the lane does not own. Deterministic, no LLM.
 * Usage: bun bin/lane-check.ts <lane> [base-ref]     (base-ref defaults to main)
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  bin/lane-check.ts
 * Deps:    bun (Glob, spawnSync), git, lanes.json
 * Tested:  test/contracts/lane-check.test.ts
 */
import { Glob } from "bun";
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface LaneFile {
  readonly every_lane_also_owns: readonly string[];
  readonly lanes: Readonly<Record<string, { readonly owns: readonly string[] }>>;
}

export function ownedGlobs(lanes: LaneFile, lane: string): readonly string[] | null {
  const entry = lanes.lanes[lane];
  if (!entry) return null;
  return [...entry.owns, ...lanes.every_lane_also_owns.map((pattern) => pattern.replaceAll("{lane}", lane))];
}

/** The files outside the lane's globs, sorted. */
export function strangers(files: readonly string[], globs: readonly string[]): readonly string[] {
  const matchers = globs.map((pattern) => new Glob(pattern));
  return files.filter((file) => !matchers.some((matcher) => matcher.match(file))).sort();
}

/** The path of one `git status --porcelain` line: two status columns, a space, the path (the new one after a rename). */
export function porcelainPath(line: string): string {
  return (line.slice(3).split(" -> ").pop() ?? "").trim().replace(/^"|"$/g, "");
}

export function loadLanes(root: string): LaneFile {
  return JSON.parse(readFileSync(join(root, "lanes.json"), "utf8")) as LaneFile;
}

function changedFiles(root: string, base: string): string[] {
  const run = (args: string[]): string[] => {
    const result = Bun.spawnSync(["git", ...args], { cwd: root });
    if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString().trim()}`);
    // Lines are NOT trimmed: a porcelain line starts with two status columns, and one may be a space.
    return result.stdout.toString().split("\n").filter((line) => line.length > 0);
  };
  const committed = run(["diff", "--name-only", `${base}...HEAD`]).map((line) => line.trim());
  const working = run(["status", "--porcelain", "--untracked-files=all"]).map(porcelainPath);
  return [...new Set([...committed, ...working])].filter(Boolean);
}

if (import.meta.main) {
  const [lane, base = "main"] = process.argv.slice(2);
  const root = join(import.meta.dir, "..");
  if (!lane) {
    console.error("usage: bun bin/lane-check.ts <lane> [base-ref]");
    process.exit(2);
  }
  const globs = ownedGlobs(loadLanes(root), lane);
  if (!globs) {
    console.error(`lane-check: no lane named "${lane}" in lanes.json`);
    process.exit(2);
  }
  const outside = strangers(changedFiles(root, base), globs);
  if (outside.length > 0) {
    console.error(`lane-check: lane "${lane}" touched ${outside.length} file(s) it does not own:`);
    for (const file of outside) console.error(`  ${file}`);
    console.error(`Owned: ${globs.join(", ")}`);
    console.error(`Need a change in a shared file? Write requests/${lane}.md and keep building against the fake.`);
    process.exit(1);
  }
  console.log(`lane-check: lane "${lane}" stays inside its files`);
}
