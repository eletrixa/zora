/**
 * Lane ownership: no file has two owners, and the checker tells owned from foreign.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/contracts/lane-check.test.ts
 * Deps:    bun:test, bin/lane-check.ts, lanes.json
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { Glob } from "bun";
import { join } from "node:path";
import { loadLanes, ownedGlobs, porcelainPath, strangers } from "../../bin/lane-check";

const root = join(import.meta.dir, "..", "..");
const lanes = loadLanes(root);

describe("lanes.json", () => {
  it("gives every tracked source file at most one lane", () => {
    const files = [...new Glob("{src,test,bin,collector,rules,public}/**/*").scanSync({ cwd: root, onlyFiles: true })];
    const doubled: string[] = [];
    for (const file of files) {
      const owners = Object.keys(lanes.lanes).filter((lane) => strangers([file], ownedGlobs(lanes, lane) ?? []).length === 0);
      if (owners.length > 1) doubled.push(`${file}: ${owners.join(", ")}`);
    }
    expect(doubled).toEqual([]);
  });

  it("keeps the shared files with the integrator", () => {
    const shared = ["package.json", "wrangler.jsonc", "lanes.json", "AGENTS.md", "migrations/0001_catalogue.sql", "src/contracts/ports.ts", "src/app.ts", "src/index.ts", "src/cron.ts", "src/container.ts", "src/auth.ts", "src/lib/money.ts", "src/probe/checks/index.ts", "src/ui/routes.ts", "test/fakes/partner.ts", "CHANGELOG.md"];
    for (const lane of Object.keys(lanes.lanes)) expect([lane, strangers(shared, ownedGlobs(lanes, lane) ?? [])]).toEqual([lane, [...shared].sort()]);
  });
});

describe("strangers", () => {
  const globs = ownedGlobs(lanes, "search") ?? [];
  it("accepts the lane's own files and its three note files", () => {
    expect(strangers(["src/search/index.ts", "src/search/rank/bm25.ts", "test/search/a.test.ts", "test/eval/queries.json", "changes/search.md", "requests/search.md", "docs/ops/runs/search.md"], globs)).toEqual([]);
  });
  it("names every foreign file", () => {
    expect(strangers(["src/search/index.ts", "src/contracts/ports.ts", "package.json", "changes/carts.md"], globs)).toEqual(["changes/carts.md", "package.json", "src/contracts/ports.ts"]);
  });
  it("knows no lane by an unknown name", () => {
    expect(ownedGlobs(lanes, "nope")).toBeNull();
  });
});

describe("porcelainPath", () => {
  it("reads the path whatever the two status columns hold", () => {
    expect(porcelainPath(" M src/sync/index.ts")).toBe("src/sync/index.ts");
    expect(porcelainPath("M  src/sync/index.ts")).toBe("src/sync/index.ts");
    expect(porcelainPath("?? test/sync/sync.test.ts")).toBe("test/sync/sync.test.ts");
    expect(porcelainPath("R  src/a.ts -> src/sync/b.ts")).toBe("src/sync/b.ts");
  });
});
