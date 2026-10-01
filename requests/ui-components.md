<!--
Shared-file change this lane needs but cannot make itself.

Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
Module:  requests/ui-components.md
Deps:    n/a
Tested:  n/a
-->
# Requests from lane ui-components

## 2026-10-01, round 3: one stale assertion in test/ui/pages/finder.test.tsx (lane ui-finder)

**What:** `test/ui/pages/finder.test.tsx:185` (`"marks the biggest-saving card and the cheapest card
each with their own pill"`) checks `expect(html).toContain("Biggest saving · You save $60.00");` — the
label and the saving as one run of plain text. Please change it to check the two runs `savePill` now
renders:
```diff
-    expect(html).toContain("Biggest saving · You save $60.00");
+    expect(html).toContain('<span class="save-pill-label">Biggest saving · </span><span class="save-pill-amount" data-label="You save">You save $60.00');
```

**Why:** Round 3 fix 2 (`docs/lanes/ui-components-unified.md`) asked for the save pill to wrap only
between its label and its saving, never inside either (`/find` lab 1280 and 390 broke a pill mid-figure).
A single text node cannot have mixed wrap behaviour, so `savePill()` now renders the label as
`span.save-pill-label` (`white-space:nowrap`) and the saving as `span.save-pill-amount`
(`white-space:nowrap`, still carrying `data-label="You save"` for the walkthrough and for
`bin/walkthrough.ts`'s regex, which tolerates the tag change: `[^<$]*` only forbids `<` and `$` between
the attribute and the amount, and the amount span's own text starts right after its `>`). The outer
`span.save-pill` is `display:inline-flex;flex-wrap:wrap`, so the two runs sit on one line when there is
room and wrap between them, never inside one, when there is not. `src/ui/components/README.md`'s
`savePill` entry documents the new shape; `podiumCard`'s `.replace('<span class="save-pill', …)` still
finds the outer span first, so the podium pill and the winner fill are unaffected.

This is the only failure `bun test` shows after this round's rebuild (1027 pass / 1 fail); every other
assertion in that file, including the rest of this same test (the plain pill's text, the tile values),
is unaffected since `.toContain` substring checks that do not span the new tag boundary still match.

**Integrator, 2026-10-01 (round 3): done.** `test/ui/pages/finder.test.tsx` checks both pills' two runs, and the two
negative checks use the same two-run text so they still guard against a swapped label.
