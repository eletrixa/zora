<!--
Shared-file changes lane ui-deal needs but cannot make itself.

Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
Module:  requests/ui-deal.md
Deps:    n/a
Tested:  n/a
-->
## Round 2, loop 5: new classes the deal page needs styled (public/static/app.css, pixel.css)

What: `src/ui/pages/deal.tsx` now draws three parts the README's blocks do not cover, in new classes
with no rule in either stylesheet today. Nothing crashes or is unescaped without them; the page just
renders unstyled in these spots until `app.css` (and `pixel.css`) pick them up.

1. **Locations, as pin rows instead of a bullet list** (`Deal.png`, round 1 miss #20): each location is
   now `<div class="location-row"><svg class="location-pin">…</svg><div class="location-body">
   <span class="location-name">Foot Smile Spa</span><span class="location-address">100 Main St,
   Chicago, IL 60611</span></div></div>`, several inside a `<div class="location-rows">` in the
   existing `box()`. Needs: the pin tinted (`--muted` or `--action`) and sized to sit left of the text,
   `.location-name` bold, `.location-address` under it in `--muted`, `.location-rows` as a vertical
   list with the row gap `box` already uses elsewhere. The old `.location-list`/`<li>` rule can be
   dropped from `app.css` once this lands; `deal.tsx` no longer emits it.
2. **`.option-row-boxed`**: the text an option's row shows in place of its checkout form when that
   option is already the one bought from the buy box above ("In the box above"). Same role as
   `.option-row-unavailable` (a muted line where the action would sit) and can likely take the same
   rule.
3. **`.buy-box-note` and `.buy-box-link`**: the two sentences at the foot of the buy box card ("You pay
   on Groupon's checkout page. Groupon sends the voucher." and "See all N options", a link to
   `#options`). `.buy-box-note` can take `box-note`'s muted treatment; `.buy-box-link` just needs the
   site's normal link colour and a 44 px tall hit area like the other inline links LANGUAGE.md asks for.

Until these land, the content and every link, form and button are correct and tested
(`test/ui/pages/deal.test.tsx`); only the look is plain in these three spots.

## Round 2, loop 5: `optionRow`/`OptionRowProps` do not cover the new Options design

What: round 1 miss #21 (`docs/ops/loop5.md`) asks the Options section for a "You save" pill per row, a
numbered `promoMarker` instead of the inline promo box, and the deal's own cheapest option marked "In
the box above" with no second checkout form. `optionRow()` (`src/ui/components/blocks.ts`) has none of
these, and `src/ui/components/**` is frozen to lane ui-deal, so `deal.tsx` now builds its own
`dealOptionRow()` next to it, reusing `savePill`, `promoMarker`, `footnotes` and the existing
`option-row*` classes (`optionRow()` itself is no longer called from this page).

Why worth taking: `dealOptionRow()` duplicates `optionRow()`'s title/price/action markup, just with the
three additions above. If another page ever needs the same shape, folding `saveText`/`sharePct`,
`promoRank` and a `boxed: boolean` into `OptionRowProps` (mirroring how `dealCard`'s `options.rank` and
`options.label` already work) would let it call one shared function again. Not blocking: `deal.tsx`
builds and tests clean against today's `optionRow()` export, untouched.

**Integrator, 2026-10-01: the classes are styled.** `.location-rows`, `.location-row`, `.location-pin`, `.location-body`,
`.location-name`, `.location-address`, `.option-row-boxed` (with `.option-row-unavailable`), `.buy-box-note` (with
`.box-note`) and `.buy-box-link a` (44 px) are in `app.css`; the pixel look retints them through the tokens. Folding
`dealOptionRow()` into `optionRow` stays open as polish.

## Round 3, loop 5: two more classes, for the photo's height and the button's width (public/static/app.css, pixel.css)

What: round 3 miss #1 (`docs/ops/loop5.md`, Round 2 check) asks the photo beside the buy box to fill the
buy box's own height (cover fit), the checkout button to span the box, and the box to open with "The
cheapest option" over the option title. The heading and the option title use blocks already styled
(`box()`'s own `h3.box-title`, and the existing `.option-row-title`), so only two classes are new:

1. **`.deal-photo`**: `src/ui/pages/deal.tsx`'s own hero photo, `<img class="deal-photo">` or, with no
   `imageUrl`, `<div class="deal-photo">Deal photo</div>`, in place of `.card-image` (that class keeps
   its fixed 150 px height for the deal cards elsewhere; this photo needs to grow). Needs: `width:100%`,
   `object-fit:cover`, the same rounded corners and striped placeholder background `.card-image` has, but
   no fixed height; instead it should stretch to fill `.two-column-main`'s full height, which the grid
   row (`.two-column`) already sets to the buy box's own height, e.g. `height:100%` on `.deal-photo`
   plus `flex:1` so `.two-column-main`'s flex column gives it the space. `Deal.png`: the photo covers its
   whole column, flush with the buy box's bottom edge.
2. **`.buy-box`**: a new wrapper around the whole buy box card (`<div class="buy-box">` holding the
   existing `box()` output), so its checkout button can be targeted without touching `.btn` or
   `.option-row-form` everywhere else they appear (the Options rows keep their own narrow buttons).
   Needs: `.buy-box .btn{width:100%}`, the button spans the card (`Deal.png`).

Until these land, the content, the heading, the option title and the button are correct and tested
(`test/ui/pages/deal.test.tsx`); only the photo's height and the button's width are plain.

**Integrator, 2026-10-01 (round 3): styled.** `.deal-photo` (cover fit, `flex:1`, `height:100%`, the striped placeholder,
220 px floor) and `.buy-box .btn{width:100%}` are in `app.css`; `pixel.css` squares the photo and gives it the checker.
