<!-- Module: docs/lanes/ui-deal.md · Tested: n/a · Given verbatim to the lane agent, 2026-09-30 (loop 5, wave B), model sonnet -->
# Lane ui-deal, loop 5: the deal page in the language of the site

**You build:** `src/ui/pages/deal.tsx`, the deal page at `/deals/:id`: a pure renderer from `DealPageProps` to a full HTML document, cut from the boards, built from the shared blocks.
**Keep these exports:** `renderDeal: PageRenderer<DealPageProps>`.
**Read first:** `design/project/Deal.dc.html` and `DealPhone.dc.html` (the structure, wording and order; the `Pixel` siblings are the other look, carried by the stylesheets), `docs/ops/loop5/design/r3-deal.md`, `design/LANGUAGE.md`, `src/ui/components/README.md` (the contract: every block and class you may use; nothing else), `src/contracts/pages.ts`, `src/contracts/ports.ts` (`DealDetail`, `DealOption`, `PromoNote`, `PriceChangeRow`, `StoredLocation`), the page as it is (keep every fact and every form exactly: the checkout forms post `productId`, `optionId` and `quantity` to `/checkout`, and nothing about them changes), `test/ui/pages/deal.test.tsx` (extend it), `AGENTS.md` rules 2 and 3 (the price a shopper pays is `payText`; the promo is a sentence; no checkout address is ever built here).
**Test with:** literal deals; string assertions on the HTML.

## Behaviour

1. **Document**: `shell({ title: deal.title, active: null, body })`. Body in order as the board has it: the breadcrumb (Top deals, the finder, the deal), the hero (the eyebrow with the category labels as pills or the first label, the h1 as the deal title, the lead as the short description), then the two columns or the stacked layout the board draws: the photo, the price block (`priceBlock(deal, "large")`, the promo sentence inside it as today), the tiles where the board has them (options, the cheapest option, the largest saving, computed from `deal.options`), the option rows (`optionRow` and `optionList` exactly as today, one checkout form per sellable option), the locations, the terms and the description, the price history (the existing table or the block the board uses; the existing empty sentence when none).
2. Every value through `esc`. Money only through `formatMoney` or the `payText` fields. The promo price appears only inside `promo.instruction`. `buyLink` is never built here. Never "no data".

## Tests you must have

`test/ui/pages/deal.test.tsx`, extended:
- opens with the breadcrumb to the home page and the finder, and the hero with the title and the short description
- shows the price to pay as the largest figure and the promo as a sentence, never as the price
- keeps one checkout form per sellable option with productId, optionId and quantity, and none for an option that cannot be sold
- computes the tiles from the options when the board has them
- keeps the locations, the terms and the price history with their empty sentences
- escapes a title and a location that carry HTML
- marks no nav link current

## How you work

You are a lane agent of Zora Agent Lab (zorasocial). Your worktree is next to the repo at `../zorasocial-wt/ui-deal`, on branch `lane/ui-deal`; you never touch `main`. Read `AGENTS.md` first: the ten rules, the file headers, the TDD loop. `lanes.json` says which files you own; `bun bin/lane-check.ts ui-deal` fails on any other file. Do not push, do not merge, do not add packages, do not edit a shared file: a change you need there goes to `requests/ui-deal.md` (what, why, the exact change) and you build against what exists. A block or class the README does not list is not yours to add: build the part inside your page file as a local function and write it into `requests/ui-deal.md` for the components lane. Never read a vault or a secrets file; a token you need is in the environment under its name. Never write a key, token or PIN anywhere.

TDD: the failing test first, then the smallest code that passes, then check against the contract and against `AGENTS.md`. Test names read as facts. Every file you create or change carries the header of `AGENTS.md`. Plain words, short sentences, no dashes as punctuation in user-facing text.

Gates before you hand in, all three green, run from your worktree:

```
bun run typecheck
bun test
bun bin/lane-check.ts ui-deal
```

Your changelog lines go in `changes/ui-deal.md` (a `### Added` or `### Changed` block dated 2026-09-30, the same voice as `CHANGELOG.md`). One row in `docs/ops/runs/ui-deal.md`: `| 2026-09-30 hh:mm | what you built | ui-deal | sonnet (Claude Code subagent, Max subscription) | subscription, no per-run bill |` under a `| When (UTC) | What | Lane | Model | Billed cost |` header. Commit after each passing group as `ui-deal: <outcome>` and end every commit message with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Leave nothing uncommitted.

Report back in under 200 words: the commits, the three gate results, the changes file, any request you wrote, anything the integrator must know. No transcript, no code.

## Round 2, loop 5 fixes

From the round 1 check of 2026-10-01 01:00 UTC (`docs/ops/loop5.md`, Round 1). Each item: what is wrong, where, what the board or the acceptance list expects, how to see it. The boards are in `design/preview/shots/` and `design/project/`. Keep every walkthrough check green; a check you must change goes to your `requests/` file.

1. **No buy box.** Where: `/deals/<id>`, both looks: the price sits beside a short photo strip (about 150 px tall at 1280), no checkout button above the fold, no saving. Expected: `Deal.png`: the photo at full height beside "The cheapest option" card: the option title, "You pay" with the original struck, the save pill, the promo note, the primary "Get checkout link", "You pay on Groupon's checkout page. Groupon sends the voucher." and "See all N options". See: `docs/ops/loop5/deal-lab-1280.png`.
2. **Locations is a raw bulleted list.** Where: the Locations section, both looks: a default `<ul>` bullet with the address. Expected: `Deal.png`: one row per location with the pin icon, the place name in bold and the address under it. See: `docs/ops/loop5/deal-lab-1280.png`.
3. **Options repeat the promo sentence and show no saving.** Where: Options, both looks: a pink promo box under every option, no "You save". Expected: `Deal.png`: each option with "You pay", the original struck and "You save $X · N %", a "promo N" marker, one numbered "Promo codes" list under the options, the cheapest marked "In the box above"; four tiles (Biggest saving, Options, Promo codes, Price changes); the eyebrow is the deal's City, ST. See: `docs/ops/loop5/deal-lab-1280.png`.

## Round 3, loop 5 fixes

From the round 2 check of 2026-10-01 01:32 UTC (`docs/ops/loop5.md`, Round 2). Each item: what is wrong, where, what the board or the acceptance list expects, how to see it. The boards are in `design/preview/shots/` and `design/project/`. Keep every walkthrough check green; a check you must change goes to your `requests/` file.

1. **The photo is a strip beside a tall buy box, and the buy box misses parts.** Where: `/deals/<id>` (the first card on `/find`), both looks, 1280: the photo is about 150 px tall over a blank area, beside a buy box about 440 px tall; the box has no "The cheapest option" heading, the "Get checkout link" button is not full width, and the Options section has no lead. Expected: `Deal.png`: the photo fills its column to the buy box's height (cover fit), the buy box opens with "The cheapest option" over the option title, the button spans the box, Options leads with "Ordered by the price you pay; the cheapest is in the box above." A class the stylesheet must style goes to `requests/ui-deal.md`. See: `docs/ops/loop5/deal-lab-1280.png`.
