/**
 * The return address Groupon sends the shopper to after payment.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  test/app/return.test.ts
 * Deps:    bun:test, src/app.ts, test/fakes/*
 * Tested:  this file
 */
import { describe, expect, it } from "bun:test";
import { createApp } from "../../src/app";
import { PROD, makeEnv, makeWorld } from "../fakes/env";

const UUID = "3f2b8c1e-7d4a-4b9f-8e2d-1a2b3c4d5e6f";

function setup() {
  const world = makeWorld();
  const env = makeEnv({ DB: world.db.d1 });
  const app = createApp({ deps: world.deps });
  const get = (path: string) => app.fetch(new Request(`${PROD}${path}`), env);
  const orders = () => world.db.sqlite.query("SELECT groupon_order_uuid AS uuid, source FROM orders ORDER BY first_seen_at").all() as { uuid: string; source: string }[];
  return { world, get, orders };
}

describe("GET /3pd/return", () => {
  it("is public, stores the order id once and shows the waiting page", async () => {
    const { get, orders, world } = setup();
    world.shopping.order = { kind: "order", uuid: UUID, status: "PENDING", pending: true, lines: [] };
    const first = await get(`/3pd/return?grouponOrderUuid=${UUID}`);
    await get(`/3pd/return?grouponOrderUuid=${UUID.toUpperCase()}`);
    expect(first.status).toBe(200);
    expect(await first.text()).toContain("Groupon is confirming your order");
    expect(orders()).toEqual([{ uuid: UUID, source: "return" }]);
  });

  it("keeps waiting and polling when Groupon does not know the order yet", async () => {
    const { get, world } = setup();
    world.shopping.order = { kind: "not_found" };
    const response = await get(`/3pd/return?grouponOrderUuid=${UUID}`);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Groupon is confirming your order");
    expect(body).toContain("/static/return.js");
    expect(body).not.toContain("We cannot show this order");
  });

  it("shows one voucher link per unit once the order is confirmed, and none for a cancelled unit", async () => {
    const { get, world } = setup();
    world.shopping.order = {
      kind: "order",
      uuid: UUID,
      status: "CONFIRMED",
      pending: false,
      lines: [
        {
          productId: "p-massage-chi",
          optionId: "o-massage-chi-60",
          title: "Swedish Massage",
          quantity: 2,
          status: "CONFIRMED",
          vouchers: [
            { status: "CONFIRMED", url: "https://www.groupon.com/mygroupons/1" },
            { status: "CANCELLED", url: "https://www.groupon.com/mygroupons/2" },
          ],
        },
      ],
    };
    const body = await (await get(`/3pd/return?grouponOrderUuid=${UUID}`)).text();
    expect(body).toContain("https://www.groupon.com/mygroupons/1");
    expect(body).not.toContain("https://www.groupon.com/mygroupons/2");
  });

  it("refuses anything that is not a UUID and stores nothing", async () => {
    const { get, orders } = setup();
    for (const bad of ["", "abc", `${UUID}' OR 1=1`, "<script>alert(1)</script>"]) {
      const response = await get(`/3pd/return?grouponOrderUuid=${encodeURIComponent(bad)}`);
      expect(response.status).toBe(400);
      expect(await response.text()).not.toContain("<script>alert");
    }
    expect(orders()).toEqual([]);
  });

  it("still thanks the shopper when the order cannot be read", async () => {
    const { get, world } = setup();
    world.shopping.getOrderStatus = async () => {
      throw new Error("upstream is down");
    };
    const response = await get(`/3pd/return?grouponOrderUuid=${UUID}`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Thank you");
  });

  it("stops storing new ids after one hundred in an hour", async () => {
    const { get, orders } = setup();
    for (let i = 0; i < 100; i++) await get(`/3pd/return?grouponOrderUuid=${UUID.slice(0, -3)}${String(i).padStart(3, "0")}`);
    const over = await get(`/3pd/return?grouponOrderUuid=${UUID.slice(0, -3)}fff`);
    expect(over.status).toBe(429);
    expect(orders()).toHaveLength(100);
  });
});

describe("GET /3pd/return/status", () => {
  it("answers only for an id the return page has stored", async () => {
    const { get, world } = setup();
    world.shopping.order = { kind: "order", uuid: UUID, status: "CONFIRMED", pending: false, lines: [] };
    expect((await get(`/3pd/return/status?grouponOrderUuid=${UUID}`)).status).toBe(404);
    expect(world.shopping.calls).toHaveLength(0);
    await get(`/3pd/return?grouponOrderUuid=${UUID}`);
    const status = await get(`/3pd/return/status?grouponOrderUuid=${UUID}`);
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({ kind: "order", status: "CONFIRMED", pending: false });
  });
});

describe("the return page never lets a visitor drive calls to Groupon", () => {
  const confirmed = { kind: "order", uuid: UUID, status: "CONFIRMED", pending: false, lines: [] } as const;
  const pending = { kind: "order", uuid: UUID, status: "PENDING", pending: true, lines: [] } as const;
  const reads = (world: ReturnType<typeof setup>["world"]) => world.shopping.calls.filter((call) => call.method === "getOrderStatus").length;

  it("reads a pending order once per three seconds, however often it is asked", async () => {
    const { get, world } = setup();
    world.shopping.order = pending;
    await get(`/3pd/return?grouponOrderUuid=${UUID}`);
    for (let i = 0; i < 20; i++) await get(`/3pd/return/status?grouponOrderUuid=${UUID}`);
    expect(reads(world)).toBe(1);
    world.clock.advance(3_000);
    world.shopping.order = confirmed;
    expect(await (await get(`/3pd/return/status?grouponOrderUuid=${UUID}`)).json()).toMatchObject({ status: "CONFIRMED" });
    expect(reads(world)).toBe(2);
  });

  it("serves a settled order from the stored view for a minute", async () => {
    const { get, world } = setup();
    world.shopping.order = confirmed;
    await get(`/3pd/return?grouponOrderUuid=${UUID}`);
    world.clock.advance(59_000);
    await get(`/3pd/return?grouponOrderUuid=${UUID}`);
    expect(reads(world)).toBe(1);
    world.clock.advance(1_000);
    await get(`/3pd/return?grouponOrderUuid=${UUID}`);
    expect(reads(world)).toBe(2);
  });

  it("lets one of many simultaneous requests read and makes the others wait", async () => {
    const { get, world } = setup();
    world.shopping.order = pending;
    await Promise.all(Array.from({ length: 25 }, () => get(`/3pd/return?grouponOrderUuid=${UUID}`)));
    expect(reads(world)).toBe(1);
  });

  it("reads at most thirty orders a minute over all orders", async () => {
    const { get, world } = setup();
    world.shopping.order = pending;
    for (let i = 0; i < 40; i++) await get(`/3pd/return?grouponOrderUuid=${UUID.slice(0, -2)}${String(i).padStart(2, "0")}`);
    expect(reads(world)).toBe(30);
    world.clock.advance(60_000);
    await get(`/3pd/return?grouponOrderUuid=${UUID.slice(0, -2)}39`);
    expect(reads(world)).toBe(31);
  });

  it("keeps showing the last good view when Groupon fails", async () => {
    const { get, world } = setup();
    world.shopping.order = confirmed;
    await get(`/3pd/return?grouponOrderUuid=${UUID}`);
    world.clock.advance(61_000);
    world.shopping.order = { kind: "error", code: "INTERNAL_SERVER_ERROR", message: "down" };
    expect(await (await get(`/3pd/return/status?grouponOrderUuid=${UUID}`)).json()).toMatchObject({ kind: "order", status: "CONFIRMED" });
  });
});
