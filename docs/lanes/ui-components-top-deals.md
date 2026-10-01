<!-- Module: docs/lanes/ui-components-top-deals.md · Tested: n/a · Given verbatim to the lane agent, 2026-09-30 15:37 UTC, model sonnet -->
# Lane ui-components, round for Top deals

**You build:** two building blocks for the Top deals page (a select field and a segmented sort toggle), the stylesheet rules for the ranked table, its footnotes, the freshness line and the phone layout, and the nav test for the new "Top deals" link (the link itself is already in `src/ui/components/shell.ts`).
**Keep these exports:** everything `src/ui/components/*.ts` exports today, unchanged; add `SelectOption`, `selectField` and `sortToggle` to `src/ui/components/blocks.ts`.
**Read first:** `src/ui/components/blocks.ts` (`formField`, `FieldWidth`, `dataTable`, `emptyState`), `src/ui/components/shell.ts`, `src/ui/components/README.md`, `public/static/app.css` (all of it: the tokens, `.field`, `.table`, `.table-wrap`, `.num`, the `@media (max-width:480px)` block), `test/ui/components/blocks-2.test.ts` and `app-css.test.ts` (the test style), `design/project/TopDeals.dc.html` and `design/project/TopDealsPhone.dc.html` when they exist in your worktree (they are the design; if they are not there yet, the description below is the design).
**Test with:** plain string assertions on the returned HTML; `readFileSync` on the stylesheet.

## Behaviour

1. **`selectField({ label, name, value?, options, width? })`** in `blocks.ts`, after `formField`: the same `.field` wrapper and label as `formField` (`<div class="field[ field--wide]"><label class="field-label" for="name">Label</label>`), then `<select id="name" name="name" autocomplete="off">` with one `<option value="...">Label</option>` per entry and ` selected` on the one whose `value` equals `value` (none when nothing matches). `SelectOption` is `{ readonly value: string; readonly label: string }`. Every value and label escaped with `esc`.
2. **`sortToggle({ options, current, hrefFor })`**: `<nav class="sort" aria-label="Sort">` holding one `<a href="...">Label</a>` per option, the `href` from `hrefFor(key)`, ` aria-current="true"` on the current one and on no other. Links, not buttons: a GET with the same pickers, works without JavaScript. Escape the href and the label.
3. **Stylesheet** (`public/static/app.css`, 11,523 bytes today, cap 20,480 bytes; the design tokens are the `:root` variables, use them, no new colours). Append after the form-field block:

```css
/* select (Top deals pickers): the text-field look, the chevron drawn by the stylesheet */
.field select{min-height:48px;padding:10px 40px 10px 14px;border-radius:10px;border:1px solid var(--line);background:var(--white) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%2354567A' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 14px center;font-family:var(--font-body);font-size:15px;color:var(--ink);width:100%;appearance:none;-webkit-appearance:none}

/* sort toggle: two links drawn as one segmented control */
.sort{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--white)}
.sort a{padding:10px 16px;min-height:44px;display:flex;align-items:center;font-size:14px;font-weight:500;color:var(--muted)}
.sort a+a{border-left:1px solid var(--line)}
.sort a[aria-current="true"]{background:var(--indigo);color:var(--white)}

/* ranked table (Top deals) */
.results-head{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.table td.rank{color:var(--muted);width:44px}
.table td.pay{font-weight:600}
.table s{color:var(--muted)}
.table-option{display:block;font-size:12px;color:var(--muted)}
.fn{font-size:11px;margin-left:4px}
.footnotes{margin:0;padding-left:28px;font-size:13px;line-height:1.5;color:var(--muted)}
.footnotes li::marker{font-family:var(--font-mono)}
.freshness{margin:0;font-size:13px;color:var(--muted)}
```

   And inside the existing `@media (max-width:480px){ ... }` block, before its closing brace:

```css
  .sort{display:flex}
  .sort a{flex:1;justify-content:center}
  .ranked,.ranked tbody{display:block}
  .ranked thead{display:none}
  .ranked tr{display:grid;grid-template-columns:36px minmax(0,1fr);column-gap:8px;padding:12px 0;border-bottom:1px solid var(--line)}
  .ranked td{display:block;border:0;padding:0;text-align:left;white-space:normal}
  .ranked td.rank{grid-row:1/span 5;width:auto}
  .ranked td.city{display:none}
  .ranked td[data-label]::before{content:attr(data-label) ": ";color:var(--muted);font-family:var(--font-body)}
```

   `minmax(0,1fr)` and `white-space:normal` keep the grid inside 390 px (a nowrap cell in a `1fr` track widens the page; loop 3 learned that). The page wraps the struck price in `<s>` so the `::before` label is not struck. Adjust only what the two design boards show differently; keep the class names, the page lane builds against them.
4. **README** (`src/ui/components/README.md`): the two new functions under `blocks.ts`; the `Active` union under `shell.ts` now reads `"finder" | "top-deals" | "price-truth" | "scorecard" | null`; under the hand-built markup classes: `.ranked` with `data-label` cells, `.rank`, `.pay`, `.fn`, `.footnotes`, `.results-head`, `.freshness`. The header comment of `blocks.ts` names the two additions and its `Tested:` line gains the new test file.

## Tests you must have

- `test/ui/components/shell.test.ts`: lists Top deals second in the nav and marks it current on the top deals page (`/<a href="\/"[^>]*>Find a deal<\/a><a href="\/top-deals"[^>]*aria-current="page"[^>]*>Top deals<\/a>/`, and `/price-truth` not current).
- `test/ui/components/app-css.test.ts`: draws the select like the text field, 48 px tall, with the stylesheet's own chevron (`/\.field select\{[^}]*min-height:48px/`, `appearance:none`); turns the ranked table into a labelled list at phone width and hides the city there (`.ranked thead{display:none}`, the `36px minmax(0,1fr)` grid, the `data-label` `::before`, `.ranked td.city{display:none}`); the stylesheet stays under 20,480 bytes.
- New `test/ui/components/blocks-3.test.ts`: `selectField` renders a labelled select with one option per entry and the chosen value selected; selects nothing when the value matches no option; adds the width class token like `formField`; escapes an option value and label that carry HTML. `sortToggle` renders one link per option with the href from `hrefFor`; marks the current option with `aria-current="true"` and no other; escapes the href and the label.

## Round 2, 19:48 UTC: the third-pass design

The design changed after a critique panel; read `design/project/TopDeals.dc.html` and `design/project/TopDealsPhone.dc.html` now (they exist in your worktree after `git reset --hard main`, which the integrator ran). Keep everything from round 1 (`selectField`, `sortToggle`, the `.ranked` rules; they stay for other pages). Add, in `src/ui/components/blocks.ts` and `public/static/app.css` (cap 20,480 bytes; the design tokens only):

1. **`sentenceSelect({ label, name, value, options })`**: the big inline select of the sentence picker: `<label class="sentence-pick"><span class="sentence-pick-label">City</span><select class="sentence-select" id="name" name="name" autocomplete="off">…</select></label>`, options and `selected` as in `selectField`, everything escaped. CSS: `.picker-card` (white card, radius 16, padding 24px 28px, column flex, gap 16); `.picker-sentence` (flex wrap, align-items flex-end, gap 10px 14px); `.picker-sentence .sentence-word` (Sora 600 26px ink, padding-top 16px); `.sentence-pick` (inline column flex, gap 2); `.sentence-pick-label` (12px 500 muted); `.sentence-select` (Sora 600 24px indigo, no border, `border-bottom:3px solid var(--coral)`, radius 0, transparent background with the same chevron as `.field select` at right 2px, padding 2px 26px 4px 2px, `appearance:none`, max-width 100%); `.picker-note` (13px muted).
2. **`statTiles(tiles, options?)`** gains `options: { panel?: boolean; lead?: boolean }`: `panel` adds class `tiles--panel` (tiles on `var(--panel)`, no border), `lead` adds `tile--lead` on the first tile (`grid-column: span 2`, `border-top:3px solid var(--coral)`, value 40px) and makes the grid `repeat(5, minmax(0,1fr))`; values inside `.tiles--panel` are indigo. Default call unchanged.
3. **`podiumCard({ rank, href, title, optionTitle, imageUrl, payText, originalText, saveText, sharePct, promoRank, winner })`**: the top-three card of the boards as `<article class="podium-card[ podium-card--winner]" data-rank="N">`: a `.podium-photo` (`<img src loading="lazy" alt="">` when `imageUrl` is set, else the monogram panel `<span class="podium-mono" aria-hidden="true">D</span>` with the first letter of the title), the `.podium-rank` badge, then `.podium-body` with the title link, the optional promo marker `<sup class="fn"><a href="#promo-N">promo</a></sup>` when `promoRank` is set, the option title, the price line (`<span class="podium-pay" data-label="You pay">$199.00</span><s class="podium-original" data-label="Original">$349.00</s>`), and the pill `.podium-save` (`data-label="You save"`, text `You save $150.00 · 43.0 %`; on the winner `Best deal · You save …` with the indigo fill and white text). `sharePct` is a number 0..100 with one decimal; `saveText`, `payText`, `originalText` arrive formatted. CSS: `.podium` grid `1.5fr 1fr 1fr` gap 20 (phone: one column, gap 14); the winner card with `border-top:4px solid var(--coral)`, the photo 200px (winner) or 150px, pay 36px (winner) or 30px, as on the boards.
4. **Ranked rows** (the page hand-builds the markup with links): CSS for `.rank-list` (column flex), `.rank-head` and `.rank-row` (grid `44px minmax(0,1fr) 110px 120px 120px 150px`, column-gap 12, `.rank-row` padding 12px 0 with a bottom line, align-items center), `.rank-row .rank-no` (mono muted right), `.rank-row .rank-deal` (min-width 0; the option title beneath as `.table-option`), `.rank-row s` (mono muted), `.rank-row .rank-pay` (mono 600 16px), `.rank-row .rank-save` (mono, `var(--coral-ink)`), numeric cells right-aligned nowrap; **`savingBar(sharePct)`** returning `<span class="saving"><span class="saving-track" aria-hidden="true"><span class="saving-fill" style="width:43%"></span></span><span class="saving-text">43.0 %</span></span>` (the track 72×8 on `var(--panel)`, radius 4, the fill indigo; the width an integer percent, escaped).
5. **Heading and sort**: `.section-title--rule` (`padding-bottom:8px;border-bottom:3px solid var(--coral)`); `.sort-wrap` (inline flex, gap 10, a 13px muted "Sort" word before the toggle); `.sort a` becomes 15px 600 and the inactive link indigo; `.fn a` gets `display:inline-block;padding:8px 4px;margin:-8px -4px` so the tap target grows without moving text. `.page-foot` (`border-top:1px solid var(--line);padding-top:16px`) for the freshness line.
6. **Phone (inside the 480px block)**: `.picker-sentence .sentence-word` 20px; `.sentence-pick` and `.sentence-select` full width; `.tiles--panel` two columns with the lead tile spanning both; `.podium` one column; `.rank-head` hidden; `.rank-row` as `36px minmax(0,1fr)` with the number spanning the rows, every other cell `display:block; text-align:left; white-space:normal` and `[data-label]::before` printing the label as in `.ranked`; `.sort-wrap` full width with the toggle stretched. Nothing wider than 390.

Tests, added to `test/ui/components/blocks-3.test.ts` and `app-css.test.ts`: `sentenceSelect` renders the label, the select and the chosen option, escaped; `statTiles` with `panel` and `lead` adds the two classes and keeps the default call unchanged; `podiumCard` shows the photo when given and the monogram otherwise, marks the winner, carries `data-rank` and the four `data-label` cells, links the promo marker with the rank, escapes the title; `savingBar` clamps the width to 0..100 and prints one decimal; the stylesheet has the `.rank-row` grid and its phone block, the `.sentence-select` rule and the `.podium` grid, and stays under 20,480 bytes. Update `src/ui/components/README.md`.

## How you work

You are a lane agent of Zora Agent Lab (zorasocial). Your worktree is next to the repo at `../zorasocial-wt/ui-components`, on branch `lane/ui-components`; you never touch `main`. Read `AGENTS.md` first: the ten rules, the file headers, the TDD loop. `lanes.json` says which files you own; `bun bin/lane-check.ts ui-components` fails on any other file. Do not push, do not merge, do not add packages, do not edit a shared file: a change you need there goes to `requests/ui-components.md` (what, why, the exact change) and you build against what exists. Never read a vault or a secrets file; a token you need is in the environment under its name. Never write a key, token or PIN anywhere.

TDD: the failing test first, then the smallest code that passes, then check against the contract and against `AGENTS.md`. Test names read as facts. Every file you create or change carries the header of `AGENTS.md`. Plain words, short sentences, no dashes as punctuation in user-facing text.

Gates before you hand in, all three green, run from your worktree:

```
bun run typecheck
bun test
bun bin/lane-check.ts ui-components
```

Your changelog lines go in `changes/ui-components.md` (a `### Added` or `### Changed` block dated 2026-09-30, the same voice as `CHANGELOG.md`). One row in `docs/ops/runs/ui-components.md`: `| 2026-09-30 hh:mm | what you built | ui-components | sonnet (Claude Code subagent, Max subscription) | subscription, no per-run bill |` under a `| When (UTC) | What | Lane | Model | Billed cost |` header. Commit after each passing group as `ui-components: <outcome>` and end every commit message with the line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Leave nothing uncommitted.

Report back in under 200 words: the commits, the three gate results, the changes file, any request you wrote, anything the integrator must know. No transcript, no code.
