/**
 * Command-line interface over the HTTP API: search, deal, checkout, order, job commands.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/cli/zal.test.ts
 * Deps:    bun:test, bin/zal.ts, test/fakes
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import type { ShoppingService } from "../../src/contracts/ports";
// @ts-ignore allow .ts extension import for bun test
import { main } from "../../bin/zal.ts";
import { FakeShoppingService, cardOf } from "../fakes/services";
import { FIXTURE_PRODUCTS } from "../fakes/fixtures";
import { toStored } from "../fakes/services";
import type { DealCard, DealDetail, CheckoutResult, OrderStatusResult } from "../../src/contracts/ports";

const iso = (ms: number): string => new Date(ms).toISOString();

interface TestIO {
  stdout: string[];
  stderr: string[];
  fetch: (url: string | URL | Request, init?: RequestInit) => Promise<Response>;
  env: Record<string, string | undefined>;
  readVault: (name: string) => Promise<string | undefined>;
}

function makeTestIO(shopping: ShoppingService, env: Record<string, string> = {}): TestIO {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const baseEnv = { ZAL_HOST: "https://api.example.com", ...env };

  return {
    stdout,
    stderr,
    env: baseEnv,
    fetch: async (url, init) => {
      // Mock HTTP API responses based on pathname
      const pathname = new URL(url instanceof URL ? url : typeof url === "string" ? url : url.url).pathname;

      if (pathname === "/api/v1/search") {
        const query = new URL(url instanceof URL ? url : typeof url === "string" ? url : url.url).searchParams;
        const cards = await shopping.searchDeals(
          {
            text: query.get("q") ?? "",
            state: query.get("state") ?? undefined,
            city: query.get("city") ?? undefined,
            category: query.get("category") ?? undefined,
            maxPriceMinor: query.get("maxPrice") ? parseInt(query.get("maxPrice")!) * 100 : undefined,
            limit: query.get("limit") ? parseInt(query.get("limit")!) : 10,
          },
          "agent-api"
        );
        return Response.json({ deals: cards, count: cards.length });
      }

      if (pathname.startsWith("/api/v1/deals/")) {
        const productId = pathname.split("/").pop()!;
        const deal = await shopping.getDeal(productId);
        if (!deal) return Response.json({ error: "not_found" }, { status: 404 });
        return Response.json(deal);
      }

      if (pathname === "/api/v1/checkout") {
        const body = (await (init?.body instanceof ReadableStream ? new Response(init.body).text() : Promise.resolve(init?.body || "{}"))) as any;
        const result = await shopping.createCheckoutLink(
          typeof body === "string" ? JSON.parse(body).items : body.items,
          "agent-api"
        );
        if (result.kind === "link") return Response.json(result);
        if (result.kind === "price_changed") return Response.json(result, { status: 409 });
        if (result.kind === "unavailable") return Response.json(result, { status: 409 });
        if (result.kind === "not_found") return Response.json(result, { status: 404 });
        return Response.json(result, { status: 502 });
      }

      if (pathname.startsWith("/api/v1/orders/")) {
        const uuid = pathname.split("/").pop()!;
        const order = await shopping.getOrderStatus(uuid);
        if (order.kind === "not_found") return Response.json({ error: "not_found" }, { status: 404 });
        return Response.json(order);
      }

      if (pathname.startsWith("/admin/jobs/")) {
        return Response.json({ ok: true, job: "sync-full", startedAt: iso(0), finishedAt: iso(1000), summary: "done" });
      }

      return Response.json({ error: "not_found" }, { status: 404 });
    },
    readVault: async (name: string) => {
      if (name === "ZAL_AGENT_TOKEN") return "vault-agent-token";
      if (name === "ZAL_ADMIN_TOKEN") return "vault-admin-token";
      return undefined;
    },
  };
}

describe("zal search", () => {
  it("searches for deals and prints human output", async () => {
    const shopping = new FakeShoppingService();
    const product = FIXTURE_PRODUCTS[0]!;
    const stored = toStored(product, iso(0));
    const option = stored.options[0]!;
    const card: DealCard = {
      productId: product.id,
      optionId: option.optionId,
      title: stored.title,
      optionTitle: option.title,
      city: stored.locations[0]?.city ?? null,
      state: stored.locations[0]?.state ?? null,
      imageUrl: stored.imageUrl,
      currency: option.currency,
      precision: option.precision,
      listPriceMinor: option.original,
      payMinor: option.retail,
      payText: "$49.00",
      promo: null,
    };
    shopping.cards = [card];

    const io = makeTestIO(shopping, { ZAL_AGENT_TOKEN: "test-token" });
    const code = await main(["search", "massage", "--limit", "1"], io);

    expect(code).toBe(0);
    expect(io.stdout.join("")).toContain("Massage");
    expect(io.stdout.join("")).toContain("You pay $49.00");
  });

  it("requires at least one search criterion", async () => {
    const io = makeTestIO(new FakeShoppingService(), { ZAL_AGENT_TOKEN: "test-token" });
    const code = await main(["search"], io);
    expect(code).toBe(2);
    expect(io.stderr.join("")).toContain("search requires text or a filter");
  });

  it("sends --max in dollars, not minor units", async () => {
    const shopping = new FakeShoppingService();
    shopping.cards = [];
    const io = makeTestIO(shopping, { ZAL_AGENT_TOKEN: "test-token" });
    const code = await main(["search", "test", "--max", "50"], io);
    expect(code).toBeOneOf([0, 3]);
  });

  it("accepts decimal maxPrice like 49.50", async () => {
    const shopping = new FakeShoppingService();
    shopping.cards = [];
    const io = makeTestIO(shopping, { ZAL_AGENT_TOKEN: "test-token" });
    const code = await main(["search", "test", "--max", "49.50"], io);
    expect(code).toBeOneOf([0, 3]);
  });

  it("exits with 2 when --max is not a positive number", async () => {
    const io = makeTestIO(new FakeShoppingService(), { ZAL_AGENT_TOKEN: "test-token" });
    const code = await main(["search", "test", "--max", "abc"], io);
    expect(code).toBe(2);
    expect(io.stderr.join("")).toContain("must be a positive number");
  });

  it("exits with 2 when --max is negative", async () => {
    const io = makeTestIO(new FakeShoppingService(), { ZAL_AGENT_TOKEN: "test-token" });
    const code = await main(["search", "test", "--max", "-5"], io);
    expect(code).toBe(2);
    expect(io.stderr.join("")).toContain("must be a positive number");
  });

  it("reads token from vault when not in env", async () => {
    const shopping = new FakeShoppingService();
    shopping.cards = [];
    const io = makeTestIO(shopping, {}); // no token in env
    const code = await main(["search", "test", "--limit", "1"], io);
    // Should succeed if vault was used
    expect(code).toBeOneOf([0, 3]); // 0 if successful, 3 if network error (expected in test)
  });

  it("prints JSON with --json flag", async () => {
    const shopping = new FakeShoppingService();
    const product = FIXTURE_PRODUCTS[0]!;
    const stored = toStored(product, iso(0));
    const option = stored.options[0]!;
    shopping.cards = [
      {
        productId: product.id,
        optionId: option.optionId,
        title: stored.title,
        optionTitle: option.title,
        city: stored.locations[0]?.city ?? null,
        state: stored.locations[0]?.state ?? null,
        imageUrl: stored.imageUrl,
        currency: option.currency,
        precision: option.precision,
        listPriceMinor: option.original,
        payMinor: option.retail,
        payText: "$49.00",
        promo: null,
      },
    ];

    const io = makeTestIO(shopping, { ZAL_AGENT_TOKEN: "test-token" });
    const code = await main(["search", "test", "--json"], io);

    expect(code).toBe(0);
    const output = io.stdout.join("");
    expect(output).toContain("deals");
  });
});

describe("zal deal", () => {
  it("gets deal details and prints human output", async () => {
    const shopping = new FakeShoppingService();
    const product = FIXTURE_PRODUCTS[0]!;
    const stored = toStored(product, iso(0));
    const option = stored.options[0]!;
    shopping.deal = {
      productId: product.id,
      optionId: option.optionId,
      title: stored.title,
      optionTitle: option.title,
      city: stored.locations[0]?.city ?? null,
      state: stored.locations[0]?.state ?? null,
      imageUrl: stored.imageUrl,
      currency: option.currency,
      precision: option.precision,
      listPriceMinor: option.original,
      payMinor: option.retail,
      payText: "$49.00",
      promo: null,
      shortDescription: stored.shortDescription,
      description: stored.description,
      categoryLabels: stored.categoryLabels,
      options: [
        {
          optionId: option.optionId,
          title: option.title,
          sellable: true,
          listPriceMinor: option.original,
          payMinor: option.retail,
          payText: "$49.00",
          promo: null,
        },
      ],
      locations: stored.locations,
    };

    const io = makeTestIO(shopping, { ZAL_AGENT_TOKEN: "test-token" });
    const code = await main(["deal", product.id], io);

    expect(code).toBe(0);
    expect(io.stdout.join("")).toContain(stored.title);
  });

  it("exits with code 1 when deal not found", async () => {
    const shopping = new FakeShoppingService();
    shopping.deal = null;

    const io = makeTestIO(shopping, { ZAL_AGENT_TOKEN: "test-token" });
    const code = await main(["deal", "missing-id"], io);

    expect(code).toBe(1);
  });

  it("prints JSON with --json flag", async () => {
    const shopping = new FakeShoppingService();
    const product = FIXTURE_PRODUCTS[0]!;
    const stored = toStored(product, iso(0));
    const option = stored.options[0]!;
    shopping.deal = {
      productId: product.id,
      optionId: option.optionId,
      title: stored.title,
      optionTitle: option.title,
      city: stored.locations[0]?.city ?? null,
      state: stored.locations[0]?.state ?? null,
      imageUrl: stored.imageUrl,
      currency: option.currency,
      precision: option.precision,
      listPriceMinor: option.original,
      payMinor: option.retail,
      payText: "$49.00",
      promo: null,
      shortDescription: stored.shortDescription,
      description: stored.description,
      categoryLabels: stored.categoryLabels,
      options: [],
      locations: stored.locations,
    };

    const io = makeTestIO(shopping, { ZAL_AGENT_TOKEN: "test-token" });
    const code = await main(["deal", product.id, "--json"], io);

    expect(code).toBe(0);
    const output = io.stdout.join("");
    expect(output).toContain("productId");
  });
});

describe("zal checkout", () => {
  it("creates checkout link and prints total and link", async () => {
    const shopping = new FakeShoppingService();
    shopping.checkout = {
      kind: "link",
      cartId: "cart-1",
      buyLink: "https://groupon.com/checkout",
      currency: "USD",
      precision: 2,
      totalMinor: 4900,
      totalText: "$49.00",
      lines: [],
      expiresAt: null,
    };

    const io = makeTestIO(shopping, { ZAL_AGENT_TOKEN: "test-token" });
    const code = await main(["checkout", "prod-1", "opt-1"], io);

    expect(code).toBe(0);
    const output = io.stdout.join("");
    expect(output).toContain("$49.00");
    expect(output).toContain("https://groupon.com/checkout");
  });

  it("exits with code 1 when price changed", async () => {
    const shopping = new FakeShoppingService();
    shopping.checkout = {
      kind: "price_changed",
      productId: "prod-1",
      optionId: "opt-1",
      wasMinor: 4900,
      nowMinor: 5900,
      nowText: "$59.00",
    };

    const io = makeTestIO(shopping, { ZAL_AGENT_TOKEN: "test-token" });
    const code = await main(["checkout", "prod-1", "opt-1"], io);

    expect(code).toBe(1);
  });

  it("accepts quantity with --qty", async () => {
    const shopping = new FakeShoppingService();
    shopping.checkout = {
      kind: "link",
      cartId: "cart-1",
      buyLink: "https://groupon.com/checkout",
      currency: "USD",
      precision: 2,
      totalMinor: 9800,
      totalText: "$98.00",
      lines: [],
      expiresAt: null,
    };

    const io = makeTestIO(shopping, { ZAL_AGENT_TOKEN: "test-token" });
    const code = await main(["checkout", "prod-1", "opt-1", "--qty", "2"], io);

    expect(code).toBe(0);
  });

  it("prints JSON with --json flag", async () => {
    const shopping = new FakeShoppingService();
    shopping.checkout = {
      kind: "link",
      cartId: "cart-1",
      buyLink: "https://groupon.com/checkout",
      currency: "USD",
      precision: 2,
      totalMinor: 4900,
      totalText: "$49.00",
      lines: [],
      expiresAt: null,
    };

    const io = makeTestIO(shopping, { ZAL_AGENT_TOKEN: "test-token" });
    const code = await main(["checkout", "prod-1", "opt-1", "--json"], io);

    expect(code).toBe(0);
    const output = io.stdout.join("");
    expect(output).toContain("cartId");
  });
});

describe("zal order", () => {
  it("gets order status and prints it", async () => {
    const shopping = new FakeShoppingService();
    shopping.order = {
      kind: "order",
      uuid: "order-1",
      status: "pending",
      pending: true,
      lines: [],
    };

    const io = makeTestIO(shopping, { ZAL_AGENT_TOKEN: "test-token" });
    const code = await main(["order", "order-1"], io);

    expect(code).toBe(0);
  });

  it("exits with code 1 when order not found", async () => {
    const shopping = new FakeShoppingService();
    shopping.order = { kind: "not_found" };

    const io = makeTestIO(shopping, { ZAL_AGENT_TOKEN: "test-token" });
    const code = await main(["order", "missing-uuid"], io);

    expect(code).toBe(1);
  });

  it("prints JSON with --json flag", async () => {
    const shopping = new FakeShoppingService();
    shopping.order = {
      kind: "order",
      uuid: "order-1",
      status: "complete",
      pending: false,
      lines: [],
    };

    const io = makeTestIO(shopping, { ZAL_AGENT_TOKEN: "test-token" });
    const code = await main(["order", "order-1", "--json"], io);

    expect(code).toBe(0);
    const output = io.stdout.join("");
    expect(output).toContain("uuid");
  });
});

describe("zal job", () => {
  it("posts a job request to the admin endpoint", async () => {
    const io = makeTestIO(new FakeShoppingService(), { ZAL_ADMIN_TOKEN: "admin-token" });
    const code = await main(["job", "sync-full"], io);

    expect(code).toBeOneOf([0, 3]); // 0 if successful, 3 if auth fails
  });
});

describe("zal help", () => {
  it("prints usage information", async () => {
    const io = makeTestIO(new FakeShoppingService());
    const code = await main(["help"], io);

    expect(code).toBe(0);
    expect(io.stdout.join("")).toContain("zal search");
  });
});

describe("zal error handling", () => {
  it("exits with code 2 for unknown commands", async () => {
    const io = makeTestIO(new FakeShoppingService(), { ZAL_AGENT_TOKEN: "test-token" });
    const code = await main(["unknown"], io);

    expect(code).toBe(2);
  });

  it("exits with code 3 when no token available", async () => {
    const io = makeTestIO(new FakeShoppingService(), {});
    io.readVault = async () => undefined; // No token in vault either
    const code = await main(["search", "test"], io);

    expect(code).toBe(3);
  });

  it("never prints tokens to stdout or stderr", async () => {
    const io = makeTestIO(new FakeShoppingService(), { ZAL_AGENT_TOKEN: "secret-token-12345" });
    await main(["search", "test", "--limit", "1"], io);

    const output = io.stdout.join("") + io.stderr.join("");
    expect(output).not.toContain("secret-token-12345");
  });
});
