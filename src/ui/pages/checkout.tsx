/**
 * Checkout hand-off: the link to Groupon, the price-changed notice, or why there is none.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/ui/pages/checkout.tsx
 * Deps:    src/contracts/pages.ts, src/lib/html.ts, src/lib/money.ts, src/ui/components/shell.ts, src/ui/components/blocks.ts
 * Tested:  test/app/pages.test.ts, test/ui/pages/checkout.test.tsx
 */
import type { CheckoutLine, CheckoutResult } from "../../contracts/ports";
import type { PageRenderer, CheckoutPageProps } from "../../contracts/pages";
import { esc } from "../../lib/html";
import { formatMoney } from "../../lib/money";
import { button, section } from "../components/blocks";
import { shell } from "../components/shell";

const TITLE = "Checkout";

function backToDealLink(productId: string, label: string, tone?: "secondary"): string {
  return button({ label, href: `/deals/${encodeURIComponent(productId)}`, tone });
}

function homeLink(): string {
  return `<p><a href="/">Back to Zora Agent Lab</a></p>`;
}

function lineRow(line: CheckoutLine, currency: string, precision: number): string {
  const unit = formatMoney(line.unitPayMinor, currency, precision);
  const lineTotal = formatMoney(line.lineTotalMinor, currency, precision);
  return (
    `<div class="option-row-top">` +
    `<div class="card-body">` +
    `<span class="card-title">${esc(line.title)}</span>` +
    `<span class="card-option">Qty ${esc(line.quantity)} · ${esc(unit)} each</span>` +
    `</div>` +
    `<span class="option-row-pay">${esc(lineTotal)}</span>` +
    `</div>`
  );
}

function totalRow(totalText: string): string {
  return `<div class="price-row"><span class="price-label">Total before tax</span><span class="price-pay">${esc(totalText)}</span></div>`;
}

/**
 * The Groupon buy link is used verbatim, with rel="noopener". `button()` has no rel slot, so this
 * one link is built by hand, matching the same `.btn` class the component renders.
 */
function buyButton(buyLink: string): string {
  return `<a class="btn" href="${esc(buyLink)}" rel="noopener">Pay at Groupon</a>`;
}

function renderLink(result: Extract<CheckoutResult, { kind: "link" }>): string {
  const first = result.lines[0];
  const lines = result.lines.map((line) => lineRow(line, result.currency, result.precision)).join("");
  const expiry = result.expiresAt ? `This link expires at ${esc(result.expiresAt)}. ` : "";
  const body =
    `<h1>Ready to pay at Groupon</h1>` +
    `<p class="lead">Your cart is saved. The next page is Groupon's checkout.</p>` +
    section({ title: "Your cart", body: `<div class="option-list">${lines}</div>${totalRow(result.totalText)}` }) +
    buyButton(result.buyLink) +
    `<p class="lead">${expiry}The cart is Groupon's, not Zora Agent Lab's.</p>` +
    (first ? backToDealLink(first.productId, "Back to the deal", "secondary") : "");
  return shell({ title: TITLE, active: "finder", body });
}

function renderPriceChanged(result: Extract<CheckoutResult, { kind: "price_changed" }>): string {
  const body =
    `<h1>The price changed</h1>` +
    `<p class="lead">Groupon changed the price while you were looking. No cart was made.</p>` +
    `<p>It is now ${esc(result.nowText)}.</p>` +
    backToDealLink(result.productId, "See the deal again", "secondary");
  return shell({ title: TITLE, active: "finder", body });
}

function renderMessage(heading: string, message: string): string {
  const body = `<h1>${esc(heading)}</h1><p class="lead">${esc(message)}</p>${homeLink()}`;
  return shell({ title: TITLE, active: "finder", body });
}

export const renderCheckout: PageRenderer<CheckoutPageProps> = ({ result }) => {
  if (result.kind === "link") return renderLink(result);
  if (result.kind === "price_changed") return renderPriceChanged(result);
  if (result.kind === "unavailable") return renderMessage("Not available", result.reason);
  if (result.kind === "not_found") return renderMessage("Deal not found", "Nothing matches this deal and option.");
  return renderMessage("Checkout is not possible right now", result.code);
};
