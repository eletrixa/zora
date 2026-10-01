/**
 * The full HTML document shell: doctype, the fonts of both looks, both stylesheets, the header with
 * the logo lockup (both marks and the look switch) and the nav, the switch script, and the footer.
 * `publicShell` is the same document without the nav, for the shopper-facing pages.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/ui/components/shell.ts
 * Deps:    src/lib/html.ts
 * Tested:  test/ui/components/shell.test.ts
 */
import { esc } from "../../lib/html";

const FONTS_LINK =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600;700&family=Press+Start+2P&family=Silkscreen:wght@400;700&display=swap">';

const LAB_MARK =
  '<svg class="mark mark--lab" width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="7" y="3" width="3" height="9" fill="#FF6B4A"></rect><rect x="14.5" y="0" width="3" height="12" fill="#FF6B4A"></rect><rect x="22" y="3" width="3" height="9" fill="#FF6B4A"></rect><path d="M3 25a13 13 0 0 1 26 0z" fill="#2B2D6E"></path><rect x="3" y="27.5" width="26" height="3" fill="#FF6B4A"></rect></svg>';

// The same bars snapped to a 16 grid over a stepped dome, as design/project/TopDealsPixel.dc.html draws it.
const PIXEL_CELLS: readonly (readonly [number, number, number, number, string])[] = [
  [3, 2, 2, 4, "#F2B33D"],
  [7, 0, 2, 6, "#F2B33D"],
  [11, 2, 2, 4, "#F2B33D"],
  [6, 6, 4, 1, "#B9A6F2"],
  [4, 7, 8, 1, "#B9A6F2"],
  [3, 8, 10, 1, "#B9A6F2"],
  [2, 9, 12, 3, "#B9A6F2"],
  [2, 13, 12, 2, "#F2B33D"],
];

const PIXEL_MARK =
  '<svg class="mark mark--pixel" width="32" height="32" viewBox="0 0 16 16" fill="none" shape-rendering="crispEdges" aria-hidden="true">' +
  PIXEL_CELLS.map(([x, y, w, h, fill]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"></rect>`).join("") +
  "</svg>";

// With scripts the switch flips the look at once and stores it; without them the form posts to
// POST /theme. It reads and writes the attribute through dataset, so the default document never
// carries the attribute's name (test/app/pages.test.ts holds the server to that).
const SWITCH_SCRIPT =
  '<script>(function(){var d=document.documentElement,f=document.querySelector(".theme-switch");var m=/(?:^|; )zal_theme=(\\w+)/.exec(document.cookie);if(m&&m[1]==="pixel"&&!d.dataset.theme)d.dataset.theme="pixel";if(!f)return;function mark(){var t=d.dataset.theme||"lab";f.querySelectorAll("button").forEach(function(b){b.setAttribute("aria-pressed",String(b.value===t))})}mark();f.querySelector(\'input[name="next"]\').value=location.pathname+location.search;f.addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;e.preventDefault();var t=b.value==="pixel"?"pixel":"lab";if(t==="lab")delete d.dataset.theme;else d.dataset.theme=t;document.cookie="zal_theme="+t+"; Path=/; Max-Age=31536000; SameSite=Lax";mark()})})();</script>';

const FOOTER =
  '<footer class="shell-footer">Prices come from the Groupon Partner Storefront API. The price a shopper pays is the retail price.</footer>';

type Active = "finder" | "top-deals" | "price-truth" | "scorecard" | null;

const NAV_LINKS: readonly { href: string; label: string; key: Active }[] = [
  { href: "/", label: "Top deals", key: "top-deals" },
  { href: "/find", label: "Find a deal", key: "finder" },
  { href: "/price-truth", label: "Price truth", key: "price-truth" },
  { href: "/scorecard", label: "Scorecard", key: "scorecard" },
];

function head(title: string, extra?: string): string {
  return (
    "<head>" +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="noindex, nofollow, noarchive">' +
    `<title>${esc(title)} · Zora Agent Lab</title>` +
    FONTS_LINK +
    '<link rel="stylesheet" href="/static/app.css">' +
    '<link rel="stylesheet" href="/static/pixel.css">' +
    (extra ?? "") +
    "</head>"
  );
}

/** The address the switch returns to without scripts: the nav href of the active page, else home. */
function nextPath(active: Active): string {
  return NAV_LINKS.find((link) => link.key !== null && link.key === active)?.href ?? "/";
}

function lockup(active: Active): string {
  return (
    `<div class="shell-lockup"><a class="shell-brand" href="/">${LAB_MARK}${PIXEL_MARK}<span class="shell-brand-name"><span class="shell-wordmark-zora">Zora</span> Agent Lab</span></a>` +
    `<form class="theme-switch" method="post" action="/theme" aria-label="Look">` +
    `<input type="hidden" name="next" value="${esc(nextPath(active))}">` +
    `<button type="submit" name="theme" value="lab" aria-pressed="true">Lab</button>` +
    `<button type="submit" name="theme" value="pixel" aria-pressed="false">Pixel</button>` +
    `</form></div>`
  );
}

function nav(active: Active): string {
  const links = NAV_LINKS.map((link) => {
    const current = link.key !== null && link.key === active ? ' aria-current="page"' : "";
    return `<a href="${esc(link.href)}"${current}>${esc(link.label)}</a>`;
  }).join("");
  return `<nav class="shell-nav" aria-label="Main">${links}</nav>`;
}

function document_(title: string, header: string, body: string, extraHead?: string): string {
  return (
    "<!doctype html>" +
    '<html lang="en">' +
    head(title, extraHead) +
    "<body>" +
    `<header class="shell-header">${header}</header>` +
    SWITCH_SCRIPT +
    `<main class="shell-main">${body}</main>` +
    FOOTER +
    "</body></html>"
  );
}

export function shell({
  title,
  active,
  body,
  head: extraHead,
}: {
  title: string;
  active: Active;
  body: string;
  head?: string;
}): string {
  return document_(title, lockup(active) + nav(active), body, extraHead);
}

export function publicShell({ title, body, head: extraHead }: { title: string; body: string; head?: string }): string {
  return document_(title, lockup(null), body, extraHead);
}
