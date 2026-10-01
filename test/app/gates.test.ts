/**
 * Which door needs which key. One table, every route family.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/app/gates.test.ts
 * Deps:    bun:test, src/app.ts, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { createApp } from "../../src/app";
import { PROD, TEST_SECRETS, makeEnv, makeWorld } from "../fakes/env";

function setup() {
  const world = makeWorld();
  const env = makeEnv({ DB: world.db.d1 });
  const app = createApp({ deps: world.deps });
  const get = (path: string, headers: Record<string, string> = {}, method = "GET") => app.fetch(new Request(`${PROD}${path}`, { method, headers }), env);
  return { world, env, app, get };
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

describe("public doors", () => {
  const pages = ["/", "/price-truth", "/scorecard", "/data/scorecard.json", "/data/price-truth.json", "/data/sync.json"];
  it("open without any key", async () => {
    const { get } = setup();
    for (const path of ["/health", "/logo.png", "/robots.txt", "/static/app.css", ...pages]) {
      expect([path, (await get(path)).status]).toEqual([path, 200]);
    }
  });
  it("tell every crawler to stay out", async () => {
    const { get } = setup();
    expect(await (await get("/robots.txt")).text()).toContain("Disallow: /");
    for (const path of ["/static/app.css", "/logo.png", ...pages]) {
      expect([path, (await get(path)).headers.get("x-robots-tag")]).toEqual([path, "noindex, nofollow, noarchive"]);
    }
    expect((await get("/")).headers.get("cache-control")).toBe("private, no-store");
    expect(await (await get("/")).text()).toContain('<meta name="robots" content="noindex, nofollow, noarchive">');
  });
  it("answer 404 for an unknown path", async () => {
    const { get } = setup();
    const response = await get("/anything-else");
    expect(response.status).toBe(404);
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });
});

describe("token doors", () => {
  const doors: readonly (readonly [path: string, token: keyof typeof TEST_SECRETS])[] = [
    ["/api/v1/search?q=x", "ZAL_AGENT_TOKEN"],
    ["/mcp", "ZAL_AGENT_TOKEN"],
    ["/ingest/observations", "ZAL_INGEST_TOKEN"],
  ];
  it("answer 401 without a token, with a wrong token and with another door's token", async () => {
    const { get } = setup();
    for (const [path, name] of doors) {
      expect([path, (await get(path)).status]).toEqual([path, 401]);
      expect([path, (await get(path, bearer("wrong-token-wrong-token"))).status]).toEqual([path, 401]);
      const other = name === "ZAL_AGENT_TOKEN" ? TEST_SECRETS.ZAL_INGEST_TOKEN : TEST_SECRETS.ZAL_AGENT_TOKEN;
      expect([path, (await get(path, bearer(other))).status]).toEqual([path, 401]);
    }
  });
  it("pass the right token through to the lane", async () => {
    const { get } = setup();
    for (const [path, name] of doors) {
      const response = await get(path, bearer(TEST_SECRETS[name]));
      expect([path, response.status === 401]).toEqual([path, false]);
    }
  });
  it("fail closed when the token secret is not set", async () => {
    const world = makeWorld();
    const env = makeEnv({ DB: world.db.d1, ZAL_AGENT_TOKEN: undefined });
    const app = createApp({ deps: world.deps });
    const response = await app.fetch(new Request(`${PROD}/api/v1/search?q=x`, { headers: bearer("anything-anything-anything") }), env);
    expect(response.status).toBe(503);
  });
});

describe("admin door", () => {
  it("needs the admin token", async () => {
    const { get } = setup();
    expect((await get("/admin/jobs/probe", {}, "POST")).status).toBe(401);
    expect((await get("/admin/jobs/probe", bearer(TEST_SECRETS.ZAL_AGENT_TOKEN), "POST")).status).toBe(401);
    expect((await get("/admin/jobs/no-such-job", bearer(TEST_SECRETS.ZAL_ADMIN_TOKEN), "POST")).status).toBe(404);
  });
});
