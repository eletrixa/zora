<!--
Shared-file changes lane ui-finder needs but cannot make itself, with what the integrator did.

Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
Module:  requests/ui-finder.md
Deps:    n/a
Tested:  n/a
-->
## Add `now` to FinderPageProps (src/contracts/pages.ts, src/ui/routes.ts)

What: add `readonly now: number` to `FinderPageProps`, the same field `TopDealsPageProps`,
`PriceTruthPageProps` and `ScorecardPageProps` already carry, and pass `c.var.deps.clock.now()` to it
from the three `renderFinder(...)` calls in `pages.get("/find", ...)` in `src/ui/routes.ts`.

Why: the foot line should end its sentence with the next delta sync time, the way Top deals and Price
truth do (`nextDeltaText(now)`, exported from `src/ui/pages/price-truth.tsx`). `FinderPageProps` has
no `now` today, and lane code may not call `Date.now()` (AGENTS.md rule 8), so `src/ui/pages/finder.tsx`
currently prints the plain sentence "Prices refresh every 3 hours." with no next-sync time.

Exact change, in `src/contracts/pages.ts`:

```ts
export interface FinderPageProps {
  readonly query: SearchQuery;
  readonly searched: boolean;
  readonly cards: readonly DealCard[];
  readonly listableDeals: number;
  readonly featuredTheme: string | null;
  readonly cities: readonly TopCity[];
  readonly categories: readonly TopCategory[];
  /** Epoch milliseconds at render time, so the page can say when the next delta sync runs. */
  readonly now: number;
}
```

In `src/ui/routes.ts`, `pages.get("/find", ...)`, add `now: c.var.deps.clock.now()` to the `base` object
(or to each of the three `renderFinder({ ...base, ... })` calls).

Until this lands, `finder.tsx` keeps the shorter sentence; nothing here blocks the page.

**Integrator, 2026-10-01: done.** `FinderPageProps.now` is in the contract, `/find` passes `deps.clock.now()`, and
`finder.tsx` ends the foot line with "the next delta sync runs at HH:MM UTC" through `nextDeltaText`,
with a test in `test/ui/pages/finder.test.tsx`.

## Let `dealGrid` label one or two cards (ui-components, `src/ui/components/card.ts`)

What: give `dealGrid(cards, options?)` an optional way to name the label a specific card's save pill
carries, e.g. `dealGrid(cards, { labelFor: (card, rank) => string | undefined })`, mirroring the
`label` `dealCard` already takes.

Why: round 2 of loop 5 (`docs/ops/loop5.md`, item 10) asks Find a deal to carry the "Biggest saving"
and "Cheapest" labels on the cards its own tiles name, the same way the Top deals podium already labels
its winner. `dealGrid` numbers the cards and foots the promo notes but has no way to pass a label
through to one card, so `src/ui/pages/finder.tsx` now rebuilds the same grid and footnotes by hand from
the documented `dealCard`, `footnotes` and `box` blocks (see `resultsGrid` there), duplicating
`dealGrid`'s own body. A `labelFor` option would let Find a deal (and any later page with the same
need) go back to calling `dealGrid` directly.

Until this lands, `finder.tsx` keeps its own `resultsGrid`; nothing here blocks the page.

**Integrator, 2026-10-01: done.** `dealGrid(cards, { labelFor: (card, rank) => string | undefined })` is in
`src/ui/components/card.ts`, with a test; `finder.tsx` can call it in place of its own `resultsGrid`.
