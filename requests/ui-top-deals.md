<!--
Shared-file change this lane needs but cannot make itself.

Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
Module:  requests/ui-top-deals.md
Deps:    n/a
Tested:  n/a
-->
# Requests from lane ui-top-deals

## 2026-09-30, round 2: one stale assertion in test/app/pages.test.ts

**What:** `test/app/pages.test.ts:253` (`describe("top deals page")`) checks
`expect(html).toContain("Try the whole of Beauty &amp; Spas.");` — with a trailing period on the link
text. Please change it to `expect(html).toContain("Try the whole of Beauty &amp; Spas");` (no period).

**Why:** `design/project/TopDeals.dc.html` (loop 5, round 3) and `design/LANGUAGE.md`'s empty-state rule
("worded as a phrase with no closing period") both drop the period from the next-step link; the page now
builds this link through the shared `emptyState()` block, which renders the label exactly as given. The
sentence before the link still ends in its own period ("No discounted deals in Chicago, IL for
Bowling."); only the link phrase itself ("Try the whole of Beauty & Spas") carries none, matching the
"Try Los Angeles, CA" / "Try the whole of Things To Do" links covered by this lane's own tests.

**Exact change:**
```diff
-    expect(html).toContain("Try the whole of Beauty &amp; Spas.");
+    expect(html).toContain("Try the whole of Beauty &amp; Spas");
```

This is the only failure `bun test` shows after this round's rebuild (920 pass / 1 fail before the
fix); every other assertion in that file, including the rest of this same test, is unaffected.

**Integrator, 2026-10-01: done.** The assertion in `test/app/pages.test.ts` reads "Try the whole of Beauty &amp; Spas", no period.
