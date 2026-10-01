/**
 * bin/register against a loopback stub of the register endpoint: one call, the key never
 * reaches stdout or stderr, a second run refuses, an unknown outcome blocks the next run.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/bin/register.test.ts
 * Deps:    bun:test, Bun.serve (loopback only), bin/register, jq, curl
 * Tested:  this file
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "..", "..", "bin", "register");
const TOKEN = `grpn_${"a1b2c3d4"}_${"0123456789abcdef".repeat(3)}01234567`;
const PARTNER_ID = "9c1d2e3f-0000-4000-8000-000000000001";

type Mode = "ok" | "bad_request" | "server_error" | "hang";

interface Stub {
  readonly url: string;
  readonly hits: { register: number; me: number; bodies: unknown[]; keys: (string | null)[] };
  mode: Mode;
  logoStatus: number;
  stop(): void;
}

function startStub(): Stub {
  const hits: Stub["hits"] = { register: 0, me: 0, bodies: [], keys: [] };
  const stub = { mode: "ok" as Mode, logoStatus: 200 };
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    idleTimeout: 5,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/logo.png") return new Response("png", { status: stub.logoStatus, headers: { "content-type": "image/png" } });
      if (path === "/3pd/return") return new Response("missing id", { status: 400 });
      if (path === "/octo-gateway/v1/register") {
        hits.register++;
        hits.bodies.push(await request.json());
        if (stub.mode === "hang") {
          await new Promise((resolve) => setTimeout(resolve, 4000));
          return new Response("late", { status: 504 });
        }
        if (stub.mode === "bad_request") return Response.json({ error: "BAD_REQUEST", errorMessage: "displayName: must not contain Groupon" }, { status: 400 });
        if (stub.mode === "server_error") return Response.json({ error: "INTERNAL_SERVER_ERROR", errorMessage: "try later" }, { status: 400 });
        return Response.json({ partner: { partnerId: PARTNER_ID, displayName: "Zora Agent Lab", status: "active" }, token: TOKEN, requestId: "r1" });
      }
      if (path === "/octo-gateway/v1/partners/me") {
        hits.me++;
        hits.keys.push(request.headers.get("g-api-key"));
        return Response.json({ partnerId: PARTNER_ID, displayName: "Zora Agent Lab", status: "active" });
      }
      return new Response("no", { status: 404 });
    },
  });
  return {
    url: `http://127.0.0.1:${server.port}`,
    hits,
    get mode() {
      return stub.mode;
    },
    set mode(value: Mode) {
      stub.mode = value;
    },
    get logoStatus() {
      return stub.logoStatus;
    },
    set logoStatus(value: number) {
      stub.logoStatus = value;
    },
    stop: () => server.stop(true),
  };
}

let dir: string;
let stub: Stub;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "zal-register-"));
  writeFileSync(join(dir, "vault"), "EXISTING=1\n");
  // A stand-in for wrangler: stores what arrives on stdin, prints nothing secret.
  writeFileSync(join(dir, "wrangler"), `#!/usr/bin/env bash\ncat > "${dir}/wrangler-stdin"\necho "$@" > "${dir}/wrangler-args"\necho "Success"\n`);
  chmodSync(join(dir, "wrangler"), 0o755);
  stub = startStub();
});

afterEach(() => {
  stub.stop();
  rmSync(dir, { recursive: true, force: true });
});

async function run(args: string[] = ["--yes"], extraEnv: Record<string, string> = {}) {
  const child = Bun.spawn(["bash", SCRIPT, ...args], {
    env: {
      PATH: process.env["PATH"] ?? "",
      HOME: dir,
      ZAL_VAULT: join(dir, "vault"),
      ZAL_STATE_DIR: join(dir, "state"),
      ZAL_PARTNER_BASE_URL: stub.url,
      ZAL_PUBLIC_HOST: stub.url,
      ZAL_WRANGLER: join(dir, "wrangler"),
      ...extraEnv,
    },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  return { stdout, stderr, exitCode };
}

const vault = () => readFileSync(join(dir, "vault"), "utf8");
const stateFiles = () => (existsSync(join(dir, "state")) ? readdirSync(join(dir, "state")).sort() : []);

describe("bin/register", () => {
  it("registers once, stores the key in the vault and the Worker secret, and prints only the partner id", async () => {
    const result = await run();
    expect(result.exitCode).toBe(0);
    expect(stub.hits.register).toBe(1);
    expect(stub.hits.bodies[0]).toEqual({
      displayName: "Zora Agent Lab",
      partnerContactName: "Robert Vojacek",
      partnerContactEmail: "partner-contact@example.com",
      logoUrl: `${stub.url}/logo.png`,
      redirectUrl: `${stub.url}/3pd/return`,
    });
    expect(result.stdout).toContain(`Partner id: ${PARTNER_ID}`);
    expect(result.stdout + result.stderr).not.toContain(TOKEN);
    expect(result.stdout + result.stderr).not.toContain("grpn_");
    expect(vault()).toContain(`GROUPON_PARTNER_API_KEY=${TOKEN}\n`);
    expect(vault()).toContain(`GROUPON_PARTNER_ID=${PARTNER_ID}\n`);
    expect(vault()).toStartWith("EXISTING=1\n");
    expect(readFileSync(join(dir, "wrangler-stdin"), "utf8")).toBe(TOKEN);
    expect(readFileSync(join(dir, "wrangler-args"), "utf8").trim()).toBe("secret put GROUPON_PARTNER_API_KEY");
    expect(stub.hits.keys).toEqual([TOKEN]);
  });

  it("leaves no copy of the key in the state folder", async () => {
    await run();
    const files = stateFiles();
    expect(files.some((name) => name.startsWith("register-done-"))).toBe(true);
    expect(files.some((name) => name.startsWith("register-attempt-"))).toBe(false);
    expect(files.some((name) => name.startsWith(".header-"))).toBe(false);
    for (const name of files) expect([name, readFileSync(join(dir, "state", name), "utf8").includes("grpn_")]).toEqual([name, false]);
  });

  it("refuses a second run and sends nothing", async () => {
    await run();
    const second = await run();
    expect(second.exitCode).toBe(1);
    expect(second.stderr).toContain("already in the vault");
    expect(stub.hits.register).toBe(1);
  });

  it("sends nothing without a confirmation", async () => {
    const result = await run([]);
    expect(result.exitCode).toBe(1);
    expect(stub.hits.register).toBe(0);
    expect(vault()).toBe("EXISTING=1\n");
  });

  it("sends nothing when the logo address is not live", async () => {
    stub.logoStatus = 404;
    const result = await run();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("logo address answered");
    expect(stub.hits.register).toBe(0);
  });

  it("allows a corrected run after a definite refusal", async () => {
    stub.mode = "bad_request";
    const refused = await run();
    expect(refused.exitCode).toBe(1);
    expect(refused.stderr).toContain("code BAD_REQUEST");
    expect(refused.stderr).toContain("must not contain Groupon");
    expect(vault()).toBe("EXISTING=1\n");
    stub.mode = "ok";
    expect((await run()).exitCode).toBe(0);
    expect(stub.hits.register).toBe(2);
  });

  it("treats a timeout as an unknown outcome: no second call, no key, a clear instruction", async () => {
    stub.mode = "hang";
    const first = await run(["--yes"], { ZAL_TIMEOUT_SEC: "1" });
    expect(first.exitCode).toBe(1);
    expect(first.stderr).toContain("MAY have created a partner");
    expect(first.stderr).toContain("req.partner.api@groupon.com");
    stub.mode = "ok";
    const second = await run();
    expect(second.exitCode).toBe(1);
    expect(stub.hits.register).toBe(1);
    expect(vault()).toBe("EXISTING=1\n");
  });

  it("blocks the next run when the outcome is not certain", async () => {
    stub.mode = "server_error";
    const first = await run();
    expect(first.exitCode).toBe(1);
    expect(first.stderr).toContain("outcome is not certain");
    stub.mode = "ok";
    const second = await run();
    expect(second.exitCode).toBe(1);
    expect(second.stderr).toContain("earlier attempt");
    expect(stub.hits.register).toBe(1);
    expect(vault()).toBe("EXISTING=1\n");
  });
});
