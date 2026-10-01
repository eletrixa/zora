/**
 * Probe check "cart-lifecycle": walks a cart through create, read, add, change quantity,
 * remove, totals and abandon against two sampled options, and checks the API's numbers at
 * every step.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/probe/checks/cart-lifecycle.ts
 * Deps:    src/contracts/ports.ts
 * Tested:  test/probe/checks/cart-lifecycle.test.ts
 */
import type { OctoCart, OctoCartItem } from "../../contracts/partner";
import type { CallMeta, ProbeCheck, ProbeContext, ProbeStepResult } from "../../contracts/ports";

const NAME = "cart-lifecycle" as const;
const STEPS = ["create", "read", "add", "change", "remove", "totals", "abandon"] as const;

/** Describes a line that did not come back the way a quantity change expects, for a fail detail. */
function describeLine(line: OctoCartItem | undefined, expectedRetail: number): string {
  if (!line) return "no such line";
  const unitPrice = line.pricing?.retail ?? null;
  const facts = `quantity ${line.quantity}, unitPrice ${unitPrice ?? "none"}, lineTotal ${line.lineTotal ?? "none"}`;
  if (line.quantity === 2 && line.lineTotal === expectedRetail) return `${facts} (the API kept quantity 2 but did not multiply lineTotal)`;
  if (line.quantity === 1) return `${facts} (the API did not apply the new quantity)`;
  return facts;
}

function pass(step: string, meta: CallMeta | null, detail: string): ProbeStepResult {
  return { check: NAME, step, verdict: "pass", httpStatus: meta?.httpStatus ?? null, errorCode: null, latencyMs: meta?.latencyMs ?? null, requestId: meta?.requestId ?? null, detail };
}

function fail(step: string, meta: CallMeta | null, detail: string, errorCode: string | null = null): ProbeStepResult {
  return { check: NAME, step, verdict: "fail", httpStatus: meta?.httpStatus ?? null, errorCode, latencyMs: meta?.latencyMs ?? null, requestId: meta?.requestId ?? null, detail };
}

function skip(step: string, detail: string): ProbeStepResult {
  return { check: NAME, step, verdict: "skip", httpStatus: null, errorCode: null, latencyMs: null, requestId: null, detail };
}

function skipAll(detail: string): readonly ProbeStepResult[] {
  return STEPS.map((step) => skip(step, detail));
}

export const check: ProbeCheck = {
  name: NAME,
  async run(ctx: ProbeContext): Promise<readonly ProbeStepResult[]> {
    try {
      const day = new Date(ctx.clock.now()).toISOString().slice(0, 10);
      const options = await ctx.catalogue.sampleListableOptions(2, `${NAME}:${day}`);
      const first = options[0];
      if (!first) return skipAll("the catalogue copy is empty");
      const second = options[1];

      const results: ProbeStepResult[] = [];
      let cartId: string | null = null;
      let cart: OctoCart | undefined;

      try {
        const created = await ctx.carts.create([{ productId: first.productId, optionId: first.optionId, quantity: 1, expectedPriceMinor: first.retail }], "probe");
        if (created.kind === "error" && created.error.code === "NO_KEY") return skipAll("no API key yet");
        if (created.kind !== "created") {
          results.push(fail("create", created.meta, `expected the cart to be created, got "${created.kind}"`));
          return results;
        }
        cart = created.cart;
        cartId = created.cart.id;
        const oneItem = created.cart.items.length === 1;
        const rightTotal = created.cart.totals.grandTotal === first.retail;
        results.push(
          oneItem && rightTotal
            ? pass("create", created.meta, `created cart ${cartId} with one item, grand total ${created.cart.totals.grandTotal}`)
            : fail("create", created.meta, `expected one item at ${first.retail}, got ${created.cart.items.length} item(s) totalling ${created.cart.totals.grandTotal}`),
        );

        const read = await ctx.partner.getCart(cartId);
        if (!read.ok) {
          results.push(fail("read", read.meta, `expected the cart to read back, got ${read.error.code}`, read.error.code));
        } else {
          cart = read.value;
          const ok = read.value.id === cartId && read.value.items.length === 1 && read.value.totals.grandTotal === first.retail;
          results.push(
            ok
              ? pass("read", read.meta, `read back cart ${cartId}, one item, grand total ${read.value.totals.grandTotal}`)
              : fail("read", read.meta, `expected id ${cartId}, one item at ${first.retail}; got id ${read.value.id}, ${read.value.items.length} item(s) totalling ${read.value.totals.grandTotal}`),
          );
        }

        if (second) {
          const added = await ctx.partner.addCartItems(cartId, [{ productId: second.productId, optionId: second.optionId, quantity: 1, expectedPrice: second.retail }]);
          if (!added.ok && added.error.code === "TIMEOUT") {
            const after = await ctx.partner.getCart(cartId);
            if (after.ok) {
              cart = after.value;
              const has2 = after.value.items.length === 2;
              results.push(
                has2
                  ? pass("add", after.meta, "the add timed out, but the cart shows both items")
                  : fail("add", after.meta, `the add timed out and the cart shows ${after.value.items.length} item(s), expected 2`),
              );
            } else {
              results.push(fail("add", after.meta, `the add timed out and the follow-up read also failed with ${after.error.code}`, after.error.code));
            }
          } else if (!added.ok) {
            results.push(fail("add", added.meta, `expected the second item to be added, got ${added.error.code}`, added.error.code));
          } else {
            cart = added.value;
            const ok = added.value.items.length === 2;
            results.push(ok ? pass("add", added.meta, "the cart now holds both items") : fail("add", added.meta, `expected 2 items, got ${added.value.items.length}`));
          }
        } else {
          results.push(skip("add", "only one option in the catalogue sample"));
        }

        const changed = await ctx.partner.updateCartItem(cartId, first.optionId, 2, first.retail);
        if (!changed.ok) {
          results.push(fail("change", changed.meta, `expected the quantity change to succeed, got ${changed.error.code}`, changed.error.code));
        } else {
          cart = changed.value;
          const line = changed.value.items.find((item) => item.id === first.optionId);
          const ok = line?.lineTotal === first.retail * 2;
          results.push(
            ok
              ? pass("change", changed.meta, `line total is now ${line?.lineTotal}, 2 x retail`)
              : fail(
                  "change",
                  changed.meta,
                  `expected line total ${first.retail * 2}, got ${describeLine(line, first.retail)}, cart grandTotal ${changed.value.totals.grandTotal}`,
                ),
          );
        }

        if (second) {
          const removed = await ctx.partner.removeCartItem(cartId, second.optionId);
          if (!removed.ok) {
            results.push(fail("remove", removed.meta, `expected the second item to be removed, got ${removed.error.code}`, removed.error.code));
          } else {
            cart = removed.value;
            const ok = removed.value.items.length === 1;
            results.push(ok ? pass("remove", removed.meta, "one item left in the cart") : fail("remove", removed.meta, `expected 1 item, got ${removed.value.items.length}`));
          }
        } else {
          results.push(skip("remove", "only one option in the catalogue sample"));
        }

        if (!cart) {
          results.push(skip("totals", "no cart state survived the earlier steps"));
        } else {
          const expected = first.retail * 2;
          const lineSum = cart.items.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0);
          const ok = cart.totals.grandTotal === expected && lineSum === expected;
          const line = cart.items.find((item) => item.id === first.optionId);
          results.push(
            ok
              ? pass("totals", null, `grand total ${cart.totals.grandTotal} equals retail x quantity, excluding tax and promo`)
              : fail(
                  "totals",
                  null,
                  `expected grand total ${expected} with line totals summing to it, got grand total ${cart.totals.grandTotal} and line totals summing to ${lineSum}; line ${first.optionId} shows ${describeLine(line, first.retail)}`,
                ),
          );
        }
      } finally {
        if (cartId) {
          await ctx.carts.abandon(cartId);
          const after = await ctx.partner.getCart(cartId);
          if (after.ok) {
            if (after.value.status === "ABANDONED") {
              results.push(pass("abandon", after.meta, "the cart now shows status ABANDONED"));
            } else if (after.value.items.length === 0) {
              results.push(pass("abandon", after.meta, "the cart reads back empty after abandon, as the guide says"));
            } else {
              results.push(
                fail(
                  "abandon",
                  after.meta,
                  `expected an empty cart or status ABANDONED after abandon, got ${after.value.items.length} item(s) and status ${after.value.status}`,
                ),
              );
            }
          } else if (after.error.code === "INVALID_CART_ID") {
            results.push(pass("abandon", after.meta, "the cart is gone, INVALID_CART_ID as expected after abandon"));
          } else {
            results.push(fail("abandon", after.meta, `expected ABANDONED or INVALID_CART_ID, got ${after.error.code}`, after.error.code));
          }
        }
      }
      return results;
    } catch (thrown) {
      return [fail("crashed", null, `the check crashed: ${String(thrown)}`)];
    }
  },
};
