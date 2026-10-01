/**
 * Page the shopper lands on after paying at Groupon: no PIN, no nav, only the order the browser
 * asked for. Waits and polls while Groupon confirms, then shows one voucher card per line.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/ui/pages/return.tsx
 * Deps:    src/contracts/pages.ts, src/lib/html.ts, src/ui/components/shell.ts, src/ui/components/blocks.ts
 * Tested:  test/ui/pages/return.test.tsx, test/app/pages.test.ts, test/app/return.test.ts
 */
import type { PageRenderer, ReturnPageProps } from "../../contracts/pages";
import type { OrderStatusResult } from "../../contracts/ports";
import { esc } from "../../lib/html";
import { badge, voucherRow } from "../components/blocks";
import { publicShell } from "../components/shell";

const CONFIRMATION_EMAIL_SENTENCE = "Your Groupon confirmation email has your voucher.";

function heading(lead: string): string {
  return `<h1>Thank you</h1><p class="lead">${lead}</p>`;
}

function waitingPage(uuid: string): string {
  return publicShell({
    title: "Order",
    body:
      heading("Groupon is confirming your order.") +
      `<p id="order" data-uuid="${esc(uuid)}">Order ${esc(uuid)}</p>` +
      `<script src="/static/return.js" defer></script>`,
  });
}

function unreadablePage(uuid: string): string {
  return publicShell({
    title: "Order",
    body: heading(`We cannot show this order right now. ${CONFIRMATION_EMAIL_SENTENCE}`) + `<p>Order ${esc(uuid)}</p>`,
  });
}

function settledPage(uuid: string, order: Extract<OrderStatusResult, { kind: "order" }>): string {
  const cards = order.lines
    .map((line) => voucherRow({ title: line.title ?? line.optionId, quantity: line.quantity, status: line.status, vouchers: line.vouchers }))
    .join("");
  return publicShell({
    title: "Order",
    body: heading("Groupon confirmed your order.") + `${badge(order.status, "pass")}${cards}<p>Order ${esc(uuid)}. ${CONFIRMATION_EMAIL_SENTENCE}</p>`,
  });
}

export const renderReturn: PageRenderer<ReturnPageProps> = ({ uuid, order }) => {
  if (uuid === null) {
    return publicShell({
      title: "Order",
      body: `<h1>We could not read your order</h1><p>The link is missing its order number. ${CONFIRMATION_EMAIL_SENTENCE}</p>`,
    });
  }
  if (order === null || (order.kind === "order" && order.pending)) return waitingPage(uuid);
  if (order.kind !== "order") return unreadablePage(uuid);
  return settledPage(uuid, order);
};
