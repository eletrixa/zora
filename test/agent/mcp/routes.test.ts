/**
 * The MCP server over Streamable HTTP: JSON-RPC dispatch, tool schemas, and the tool results
 * agent-mcp hands back for each ShoppingService outcome.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/agent/mcp/routes.test.ts
 * Deps:    bun:test, src/app.ts, test/fakes/*
 * Tested:  src/agent/mcp/routes.ts
 */
import { describe, expect, it } from "bun:test";
import { createApp } from "../../../src/app";
import type { CheckoutResult, DealCard, OrderStatusResult } from "../../../src/contracts/ports";
import { PROD, TEST_SECRETS, makeEnv, makeWorld } from "../../fakes/env";
import { cardOf } from "../../fakes/services";

function setup() {
  const world = makeWorld();
  const env = makeEnv({ DB: world.db.d1 });
  const app = createApp({ deps: world.deps });
  return { world, env, app };
}

async function mcp(app: ReturnType<typeof createApp>, env: ReturnType<typeof makeEnv>, body: unknown, init: RequestInit = {}) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return app.fetch(
    new Request(`${PROD}/mcp`, {
      method: "POST",
      headers: { authorization: `Bearer ${TEST_SECRETS.ZAL_AGENT_TOKEN}`, "content-type": "application/json", ...(init.headers as Record<string, string>) },
      body: raw,
      ...init,
    }),
    env,
  );
}

/** Every response body here is a JSON-RPC envelope this test file inspects loosely by shape. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(response: Response): Promise<any> {
  return response.json();
}

const CARD: DealCard = {
  productId: "p-massage-chi",
  optionId: "o-60min",
  title: "60-Minute Deep Tissue Massage",
  optionTitle: "60 minutes",
  city: "Chicago",
  state: "IL",
  imageUrl: null,
  currency: "USD",
  precision: 2,
  listPriceMinor: 9900,
  payMinor: 4900,
  payText: "$49.00",
  promo: { priceMinor: 3920, priceText: "$39.20", code: "SAVE20", endsAt: null, instruction: "Type code SAVE20 at Groupon checkout to pay $39.20. Without it you pay $49.00." },
};

describe("initialize", () => {
  it("answers the requested protocol version when supported", async () => {
    const { app, env } = setup();
    const response = await mcp(app, env, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } });
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.result.protocolVersion).toBe("2024-11-05");
    expect(body.result.capabilities).toEqual({ tools: {} });
    expect(body.result.serverInfo.name).toBe("zora-agent-lab");
    expect(body.result.instructions).toMatch(/pay/i);
  });

  it("falls back to 2025-06-18 for an unsupported or missing version", async () => {
    const { app, env } = setup();
    const response = await mcp(app, env, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "1999-01-01" } });
    const body = await json(response);
    expect(body.result.protocolVersion).toBe("2025-06-18");
  });
});

describe("notifications", () => {
  it("answers 202 with no body for notifications/initialized", async () => {
    const { app, env } = setup();
    const response = await mcp(app, env, { jsonrpc: "2.0", method: "notifications/initialized" });
    expect(response.status).toBe(202);
    expect(await response.text()).toBe("");
  });

  it("answers 202 for any other message with no id", async () => {
    const { app, env } = setup();
    const response = await mcp(app, env, { jsonrpc: "2.0", method: "whatever/this-is" });
    expect(response.status).toBe(202);
  });
});

describe("ping", () => {
  it("answers an empty result", async () => {
    const { app, env } = setup();
    const response = await mcp(app, env, { jsonrpc: "2.0", id: 2, method: "ping" });
    const body = await json(response);
    expect(body.result).toEqual({});
  });
});

describe("tools/list", () => {
  it("lists the four tools with input schemas", async () => {
    const { app, env } = setup();
    const response = await mcp(app, env, { jsonrpc: "2.0", id: 3, method: "tools/list" });
    const body = await json(response);
    const names = body.result.tools.map((tool: { name: string }) => tool.name).sort();
    expect(names).toEqual(["create_checkout_link", "get_deal", "get_order_status", "search_deals"]);
    for (const tool of body.result.tools) {
      expect(tool.inputSchema.type).toBe("object");
      expect(typeof tool.description).toBe("string");
    }
    const search = body.result.tools.find((tool: { name: string }) => tool.name === "search_deals");
    expect(search.description).toMatch(/pay/i);
    const checkout = body.result.tools.find((tool: { name: string }) => tool.name === "create_checkout_link");
    expect(checkout.description).toMatch(/pay/i);
  });
});

describe("search_deals", () => {
  it("returns one line per deal with the price to pay and the promo sentence", async () => {
    const { app, env, world } = setup();
    world.shopping.cards = [CARD];
    const response = await mcp(app, env, { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "search_deals", arguments: { text: "massage" } } });
    const body = await json(response);
    expect(body.result.isError).toBeFalsy();
    const text = body.result.content[0].text as string;
    expect(text).toContain("60-Minute Deep Tissue Massage");
    expect(text).toContain("Chicago");
    expect(text).toContain("$49.00");
    expect(text).toContain("SAVE20");
    expect(text).toContain("p-massage-chi");
    expect(body.result.structuredContent.deals).toEqual([CARD]);
  });

  it("says plainly when nothing matched", async () => {
    const { app, env, world } = setup();
    world.shopping.cards = [];
    const response = await mcp(app, env, { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "search_deals", arguments: {} } });
    const body = await json(response);
    expect(body.result.isError).toBeFalsy();
    expect(body.result.content[0].text).toMatch(/no deals/i);
  });
});

describe("get_deal", () => {
  it("answers not_found with isError when the deal does not exist", async () => {
    const { app, env, world } = setup();
    world.shopping.deal = null;
    const response = await mcp(app, env, { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "get_deal", arguments: { product_id: "p-nope" } } });
    const body = await json(response);
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain("p-nope");
  });

  it("answers the deal detail on success", async () => {
    const { app, env, world } = setup();
    world.shopping.deal = { ...CARD, shortDescription: "Relax", description: "A long massage.", categoryLabels: ["Spa"], options: [], locations: [] };
    const response = await mcp(app, env, { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "get_deal", arguments: { product_id: "p-massage-chi" } } });
    const body = await json(response);
    expect(body.result.isError).toBeFalsy();
    expect(body.result.content[0].text).toContain("$49.00");
    expect(body.result.structuredContent.deal.productId).toBe("p-massage-chi");
  });
});

describe("create_checkout_link", () => {
  const items = { items: [{ product_id: "p-massage-chi", option_id: "o-60min", quantity: 1 }] };

  it("gives the buyLink verbatim, on its own line, labelled", async () => {
    const { app, env, world } = setup();
    const checkout: CheckoutResult = {
      kind: "link",
      cartId: "cart-1",
      buyLink: "https://partner.groupon.com/checkout/cart/cart-1",
      currency: "USD",
      precision: 2,
      totalMinor: 4900,
      totalText: "$49.00",
      lines: [{ productId: "p-massage-chi", optionId: "o-60min", title: "60-Minute Deep Tissue Massage", quantity: 1, unitPayMinor: 4900, lineTotalMinor: 4900 }],
      expiresAt: null,
    };
    world.shopping.checkout = checkout;
    const response = await mcp(app, env, { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "create_checkout_link", arguments: items } });
    const body = await json(response);
    expect(body.result.isError).toBeFalsy();
    const lines = (body.result.content[0].text as string).split("\n");
    const checkoutLine = lines.find((line) => line.startsWith("Checkout link:"));
    expect(checkoutLine).toBe("Checkout link: https://partner.groupon.com/checkout/cart/cart-1");
  });

  it("reports a price change as an error result an agent can act on", async () => {
    const { app, env, world } = setup();
    world.shopping.checkout = { kind: "price_changed", productId: "p-massage-chi", optionId: "o-60min", wasMinor: 4900, nowMinor: 5900, nowText: "$59.00" };
    const response = await mcp(app, env, { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "create_checkout_link", arguments: items } });
    const body = await json(response);
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain("$59.00");
  });

  it("rejects too many items as a tool argument error, not a protocol error", async () => {
    const { app, env } = setup();
    const tooMany = { items: Array.from({ length: 21 }, (_, i) => ({ product_id: `p-${i}`, option_id: "o-1", quantity: 1 })) };
    const response = await mcp(app, env, { jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "create_checkout_link", arguments: tooMany } });
    const body = await json(response);
    expect(body.error).toBeUndefined();
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toMatch(/20/);
  });
});

describe("get_order_status", () => {
  it("answers not_found with isError", async () => {
    const { app, env, world } = setup();
    world.shopping.order = { kind: "not_found" } satisfies OrderStatusResult;
    const response = await mcp(app, env, { jsonrpc: "2.0", id: 11, method: "tools/call", params: { name: "get_order_status", arguments: { groupon_order_uuid: "u-1" } } });
    const body = await json(response);
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain("u-1");
  });

  it("answers the order on success", async () => {
    const { app, env, world } = setup();
    world.shopping.order = { kind: "order", uuid: "u-1", status: "complete", pending: false, lines: [{ productId: "p-1", optionId: "o-1", title: "Massage", quantity: 1, status: "fulfilled", vouchers: [{ status: "issued", url: "https://groupon.com/my/vouchers/1" }] }] };
    const response = await mcp(app, env, { jsonrpc: "2.0", id: 12, method: "tools/call", params: { name: "get_order_status", arguments: { groupon_order_uuid: "u-1" } } });
    const body = await json(response);
    expect(body.result.isError).toBeFalsy();
    expect(body.result.content[0].text).toContain("complete");
    expect(body.result.content[0].text).toContain("https://groupon.com/my/vouchers/1");
  });
});

describe("protocol errors", () => {
  it("answers unknown tool as a params error inside the JSON-RPC response", async () => {
    const { app, env } = setup();
    const response = await mcp(app, env, { jsonrpc: "2.0", id: 13, method: "tools/call", params: { name: "no_such_tool", arguments: {} } });
    const body = await json(response);
    expect(body.error.code).toBe(-32602);
  });

  it("answers unknown method with -32601", async () => {
    const { app, env } = setup();
    const response = await mcp(app, env, { jsonrpc: "2.0", id: 14, method: "no/such/method" });
    const body = await json(response);
    expect(body.error.code).toBe(-32601);
  });

  it("answers broken JSON with -32700", async () => {
    const { app, env } = setup();
    const response = await mcp(app, env, "{not json");
    const body = await json(response);
    expect(body.error.code).toBe(-32700);
    expect(body.id).toBeNull();
  });

  it("refuses a JSON-RPC batch with 400", async () => {
    const { app, env } = setup();
    const response = await mcp(app, env, [{ jsonrpc: "2.0", id: 1, method: "ping" }]);
    expect(response.status).toBe(400);
  });
});

describe("transport", () => {
  it("refuses GET with 405 and Allow: POST", async () => {
    const { app, env } = setup();
    const response = await app.fetch(new Request(`${PROD}/mcp`, { method: "GET", headers: { authorization: `Bearer ${TEST_SECRETS.ZAL_AGENT_TOKEN}` } }), env);
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("refuses DELETE with 405 and Allow: POST", async () => {
    const { app, env } = setup();
    const response = await app.fetch(new Request(`${PROD}/mcp`, { method: "DELETE", headers: { authorization: `Bearer ${TEST_SECRETS.ZAL_AGENT_TOKEN}` } }), env);
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });
});
