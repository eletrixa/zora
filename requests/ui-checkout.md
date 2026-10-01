## button() rel attribute (src/ui/components/blocks.ts)

What: add an optional `rel` to the href branch of `button()`.
Why: the checkout page's Groupon buy link needs `rel="noopener"`, since it opens Groupon's own
checkout. `button()` has no slot for it today.
Exact change, in `export function button({ label, href, type, tone }: ...)`:

```ts
export function button({
  label,
  href,
  type,
  tone,
  rel,
}: {
  label: string;
  href?: string;
  type?: "button" | "submit" | "reset";
  tone?: "primary" | "secondary";
  rel?: string;
}): string {
  const cls = `btn${tone === "secondary" ? " btn--secondary" : ""}`;
  if (href) return `<a class="${cls}" href="${esc(href)}"${rel ? ` rel="${esc(rel)}"` : ""}>${esc(label)}</a>`;
  return `<button class="${cls}" type="${esc(type ?? "button")}">${esc(label)}</button>`;
}
```

Until this lands, `src/ui/pages/checkout.tsx` builds that one link by hand with the same `.btn`
class, so no component file changed and nothing here blocks the page.
