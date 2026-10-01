<!-- Module: docs/lanes/ui-pixel.md · Tested: n/a · Given verbatim to the lane agent, 2026-09-30 (loop 5, wave B), model sonnet -->
# Lane ui-pixel: the Zora pixel look as a second stylesheet

**You build:** `public/static/pixel.css`, the pixel look for every page, and `test/ui/components/pixel-css.test.ts`.
**Read first:** `design/LANGUAGE.md` (the pixel section: tokens, type, borders, shadows, the lockup and the switch in pixel), the ten pixel boards `design/project/TopDealsPixel.dc.html`, `FinderPixel.dc.html`, `PriceTruthPixel.dc.html`, `ScorecardPixel.dc.html`, `DealPixel.dc.html` and their `PixelPhone` siblings, `docs/ops/loop5/design/r3-*.md`, then `public/static/app.css` whole (every selector you reskin lives there; the lab look is the structure, yours is the retint and the reshape), `src/ui/components/README.md` (the theme section and the class contract), `src/ui/components/shell.ts` (the lockup markup, both marks, the switch), `AGENTS.md`.
**Test with:** regexes and small parsers over the stylesheet text.

## Facts

The server renders `<html lang="en" data-theme="pixel">` when the visitor chose the pixel look (the `zal_theme` cookie); the switch script flips the attribute in place. `app.css` is loaded first, `pixel.css` second, on every page, always. The lab stylesheet defines its colours as tokens on `:root` (`--ivory`, `--ink`, `--muted`, `--line`, `--panel`, `--white`, `--indigo`, `--coral`, `--coral-ink`, `--coral-tint`, `--coral-tint-line`, `--blue`, `--blue-tint`, `--teal`, `--orange`, `--orange-ink`, `--orange-tint`, `--neutral-fill`, `--font-head`, `--font-body`, `--font-mono`) and uses them everywhere, so redefining them under `:root[data-theme="pixel"]` retints most of the site at once. The marks: `.mark--lab` is shown and `.mark--pixel` hidden by the lab stylesheet.

## Behaviour

1. Every rule in `pixel.css` is scoped: the tokens on `:root[data-theme="pixel"]`, everything else under `[data-theme="pixel"] …`, media blocks included. Nothing in the file applies to the lab look.
2. Tokens: redefine every lab token with the pixel palette from LANGUAGE.md (ground `#14151C` where the lab has ivory, panels `#1B1D26` and `#0F1016`, lines `#3A3D4D` and `#2E3140`, ink `#E8E4D8`, muted `#A8A5B8`, amber `#F2B33D` as the accent where the lab has coral and indigo, mint `#7FE0A6` for pass, lavender `#B9A6F2` as the second accent, the fail red LANGUAGE.md chose; fonts: labels, nav, section titles and buttons in Silkscreen, the h1 and the lead tile's value in Press Start 2P, text and figures in IBM Plex Mono). Where a lab token pair cannot carry the pixel meaning (white text on indigo becomes dark text on amber), write the rule.
3. Shape: square corners everywhere (`border-radius:0` on cards, sections, tiles, fields, selects, buttons, pills, badges, the picker card, the podium card, the switch), 2 px borders, the 4 px hard black shadow on cards, buttons and the switch, `shape-rendering` on the pixel mark, `image-rendering:pixelated` on photos, the saving bar and the day strip as hard blocks, the select chevron as the pixel arrow from the boards.
4. The lockup: hide `.mark--lab`, show `.mark--pixel`; the wordmark in Silkscreen with the amber "ZORA" as the boards draw it, if the boards do; the switch square and amber with the current look filled (`[data-theme="pixel"] .theme-switch button[value="pixel"]` is the current one).
5. The signature strip under the header, if LANGUAGE.md keeps it: pure CSS (a repeating gradient or a `::after` on `.shell-header`), quiet, at most 12 px tall, no markup needed.
6. Contrast: every text and background pair at 4.5:1 or better; list the pairs and their ratios in a comment at the top of the file.
7. Phone: the pixel look changes no layout; the lab phone rules stay in charge. Check that nothing you add can widen a page (no fixed widths, no `white-space:nowrap` on text).
8. Cap: 20 KB.

## Tests you must have

`test/ui/components/pixel-css.test.ts`:
- every rule is scoped to the pixel look (split the file into rules, walk into media blocks, assert every selector contains `[data-theme="pixel"]`)
- redefines every token the lab stylesheet declares on `:root`, with the pixel values named in LANGUAGE.md
- swaps the marks (hides `.mark--lab`, shows `.mark--pixel`)
- squares the cards, sections, tiles, fields, buttons and the switch (a `border-radius:0` rule for each)
- sets Silkscreen for the nav and section titles, Press Start 2P for the h1, IBM Plex Mono for the body
- draws the hard shadow on cards and buttons
- stays under the 20 KB cap
- adds no fixed width and no nowrap

## How you work

You are a lane agent of Zora Agent Lab (zorasocial). Your worktree is next to the repo at `../zorasocial-wt/ui-pixel`, on branch `lane/ui-pixel`; you never touch `main`. Read `AGENTS.md` first: the ten rules, the file headers, the TDD loop. `lanes.json` says which files you own; `bun bin/lane-check.ts ui-pixel` fails on any other file. Do not push, do not merge, do not add packages, do not edit a shared file: a change you need there goes to `requests/ui-pixel.md` (what, why, the exact change) and you build against what exists. Never read a vault or a secrets file; a token you need is in the environment under its name. Never write a key, token or PIN anywhere.

TDD: the failing test first, then the smallest code that passes, then check against the contract and against `AGENTS.md`. Test names read as facts. Every file you create or change carries the header of `AGENTS.md`. Plain words, short sentences, no dashes as punctuation in user-facing text.

Gates before you hand in, all three green, run from your worktree:

```
bun run typecheck
bun test
bun bin/lane-check.ts ui-pixel
```

Your changelog lines go in `changes/ui-pixel.md` (a `### Added` or `### Changed` block dated 2026-09-30, the same voice as `CHANGELOG.md`). One row in `docs/ops/runs/ui-pixel.md`: `| 2026-09-30 hh:mm | what you built | ui-pixel | sonnet (Claude Code subagent, Max subscription) | subscription, no per-run bill |` under a `| When (UTC) | What | Lane | Model | Billed cost |` header. Commit after each passing group as `ui-pixel: <outcome>` and end every commit message with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Leave nothing uncommitted.

Report back in under 200 words: the commits, the three gate results, the changes file, any request you wrote, anything the integrator must know. No transcript, no code.

## Round 2, loop 5 fixes

From the round 1 check of 2026-10-01 01:00 UTC (`docs/ops/loop5.md`, Round 1). Each item: what is wrong, where, what the board or the acceptance list expects, how to see it. The boards are in `design/preview/shots/` and `design/project/`. Keep every walkthrough check green; a check you must change goes to your `requests/` file.

1. **No skyline on the home page; an amber dashed strip on every page.** Where: every page, pixel look, both widths. Expected: LANGUAGE.md section 5: on Top deals (`/`) the skyline, 56 px tall, buildings 24 to 44 wide and 18 to 50 tall, 2 px roofs, 4 px windows lit in amber or unlit, a 4 px amber rule under it (`TopDealsPixel.png`); on every other page the quiet strip, a flat `--bar` band 24 px tall with a 2 px `--line` rule (`PriceTruthPixel.png`). Pure CSS is still the rule: the home page is the one whose nav link `href="/"` has `aria-current="page"`, so `.shell-header:has(...)` or a data URI background can tell them apart. See: `docs/ops/loop5/home-pixel-1280.png` against `design/preview/shots/TopDealsPixel.png`.
2. **The look switch in pixel.** Where: every page, pixel look. The labels read "Lab" and "Pixel" in IBM Plex Mono, and a thin vertical line runs through the switch above and below its track. Expected: LANGUAGE.md lockup, pixel: Silkscreen capitals "LAB" and "PIXEL", the 2 px divider only inside the 32 px track (`LockupPixel.png`, `TopDealsPixel.png`). See: the header of `docs/ops/loop5/home-pixel-1280.png`.
3. **Rounded corners and lab type left in the pixel look.** Where: `/price-truth` (the MATCHED verdict banner has round corners) and the Scorecard banner; the eyebrow ("Product 1 · Price truth monitor") in IBM Plex Mono; the lead tile's top rule grey on every page. Expected: square corners everywhere, the eyebrow in Silkscreen, the lead tile's 4 px amber top rule (`PriceTruthPixel.png`, `TopDealsPixel.png`). See: `docs/ops/loop5/price-truth-pixel-1280.png`, `home-pixel-1280.png`.

## Round 3, loop 5 fixes

From the round 2 check of 2026-10-01 01:32 UTC (`docs/ops/loop5.md`, Round 2). Each item: what is wrong, where, what the board or the acceptance list expects, how to see it. The boards are in `design/preview/shots/` and `design/project/`. Keep every walkthrough check green; a check you must change goes to your `requests/` file.

1. **The header strip stops short of the right edge, with a second rule under it.** Where: every page, pixel look, 1280: the home skyline and its amber rule end at x 1168, and the quiet band on the other pages ends there too; a grey 2 px rule runs under the strip across the full width. Cause: `.shell-header::after` takes `flex-basis:100%` of the padded header (1168 px); the `-56px` margins move it left but do not widen it; the header keeps its own `border-bottom`. Expected: `TopDealsPixel.png`: the skyline full bleed edge to edge over one 4 px amber rule; other pages one quiet band with one 2 px line. Fix: `flex-basis:calc(100% + 112px)` (the 390 rule keeps 0 bleed), no header border under the strip. See: `docs/ops/loop5/home-pixel-1280.png`, `price-truth-pixel-1280.png` (top right).
