<!--
Shared-file changes lane ui-pixel needs but cannot make itself, with what the integrator did.

Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
Module:  requests/ui-pixel.md
Deps:    n/a
Tested:  n/a
-->
## lanes.json: `test/ui/components/pixel-css.test.ts` has two owners

What: narrow `ui-components`'s `test/ui/components/**` glob so it no longer also matches
`test/ui/components/pixel-css.test.ts` (for example, list `ui-components`'s test files explicitly,
or move the pixel lane's test under its own path such as `test/ui/pixel/pixel-css.test.ts`, with a
matching change to `ui-pixel`'s `owns` entry).
Why: `lanes.json` gives `ui-components` the whole `test/ui/components/**` glob and separately gives
`ui-pixel` the single file `test/ui/components/pixel-css.test.ts`, which this lane's brief
(`docs/lanes/ui-pixel.md`) names as the test to build. The two globs overlap on that one path, so
`test/contracts/lane-check.test.ts`'s "gives every tracked source file at most one lane" check fails
now that the file exists: `test/ui/components/pixel-css.test.ts: ui-components, ui-pixel`. This is a
pre-existing lanes.json conflict, not something `pixel.css` or its test caused; I built the file at
the exact path the brief gives.
Until this lands: `bun test` has one failing assertion (`lanes.json > gives every tracked source
file at most one lane`) from this cross-lane overlap. `bun bin/lane-check.ts ui-pixel` itself is
green, since it only checks that this lane's own changed files are inside its own globs.
**Integrator, 2026-10-01: done.** The test moved to `test/ui/pixel/pixel-css.test.ts` (a lane commit) and `lanes.json` gives
`ui-pixel` that path, so the file has one owner; `ui-components` keeps `test/ui/components/**`.


## src/ui/components/shell.ts: wrap "Zora" in its own span in the wordmark

What: in `lockup()`, wrap the word "Zora" on its own: `<span class="shell-wordmark-zora">Zora</span>
Agent Lab` in place of the plain `Zora Agent Lab` text, so a stylesheet can colour it apart from the
rest of the wordmark.
Why: every pixel board (`design/project/*Pixel*.dc.html`) draws the wordmark with "ZORA" in the
accent colour and "AGENT LAB" in plain ink, inside one Silkscreen, uppercase span. Without a markup
hook around just that word, `pixel.css` cannot recolour part of a text node, so it can only style the
whole `.shell-brand-name` as one colour.
Until this lands: `pixel.css` sets the whole wordmark in `--font-head` (Silkscreen), uppercase, in the
default ink colour; "Zora" is not picked out in amber.

**Integrator, 2026-10-01: done.** `lockup()` wraps the word in `span.shell-wordmark-zora`; `pixel.css` colours it
`var(--accent)`, with an assertion in the pixel test. The lab look leaves it in the wordmark ink.
