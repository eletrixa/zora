/**
 * HTML escaping and the plain page shell used until the designed components land.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/lib/html.ts
 * Deps:    none
 * Tested:  test/lib/lib.test.ts
 */

const ENTITIES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, (ch) => ENTITIES[ch] ?? ch);

/** Only same-site paths survive: starts with "/" and not "//" or "/\". Anything else becomes "/". */
export function safeNext(next: unknown): string {
  const value = typeof next === "string" ? next : "";
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/";
}

export function plainShell(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow, noarchive"><title>${esc(title)} · Zora Agent Lab</title><link rel="stylesheet" href="/static/app.css"></head><body><main>${body}</main></body></html>`;
}
