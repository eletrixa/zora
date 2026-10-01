<!-- Module: design/LANGUAGE.md · Tested: n/a · The design language of loop 5, both looks; design/gen/common.py draws every part named here -->
# Zora Agent Lab: one site, two looks

One structure, two skins. Every page is the same stack of parts in both looks, in this order: header
with the lockup and the switch, hero, picker or verdict, tiles, sections, the drawn states (empty,
example), foot line. Every page has exactly **one** tiles row, right after the page's answer (the
picker, the verdict, or the Deal page's buy box) and before the first section. A section that states
figures of its own draws them as a figure row [`figure_row`], never as a second tiles row. The **lab** look (default) is warm
ivory, rounded, 1 px lines. The **pixel** look (Zora) is dark, square, 2 px lines and hard black shadows.
A part never changes its place, its order or its words between the looks; only its skin changes.
Each part below names its helper in `design/gen/common.py` in brackets. Numbers are px.

Binding rules: money only as `formatMoney` prints it (`$1,238.00`); the price a shopper pays is the
retail price and is the biggest figure of every card and row; the promo code and the promo price live
only in the promo sentence (the promo line under the deal, or the deal page's note), never in a column, a tile or a price slot; the only
prices on a page are the original (struck) and the price to pay. The lead tile is never set larger
than the page's biggest price to pay: the podium winner's on Top deals (lab 36, pixel 32), a card's on
Find a deal (lab 30, pixel 28; compact phone card 26 and 24), where `tiles(cap=price_size(...))` sets
it. A saving never takes the display face.

## 1. Tokens

A builder writes these as custom properties on `:root` (lab) and overrides them under
`[data-theme="pixel"]`. `--accent` is `{{accent}}` on the boards.

| Token | Lab | Pixel | Used for |
|---|---|---|---|
| `--ground` | `#FBF8F3` | `#14151C` | page |
| `--surface` | `#FFFFFF` | `#1B1D26` | cards, picker card, lab header |
| `--panel` | `#F3EEE5` | `#1B1D26` | tiles, lab photo slot, lab empty state, lab switch track |
| `--bar` | `#FFFFFF` | `#0F1016` | header, skyline ground, pixel switch track, pixel sort track |
| `--field` | `#FFFFFF` | `#0F1016` | fields, pixel sentence slots |
| `--track` | `#F3EEE5` | `#0F1016` | bar tracks |
| `--line` | `#E3DDD2` | `#3A3D4D` | card borders, the rule under a table head |
| `--row-line` | `#E3DDD2` | `#2E3140` | row separators (pixel: dotted) |
| `--field-line` | `#E3DDD2` | `#4A4E62` | field borders |
| `--ink` | `#1E1F4B` | `#E8E4D8` | text, the price to pay |
| `--muted` | `#54567A` | `#A8A5B8` | labels, notes, the struck original |
| `--action` | `#2B2D6E` | `--accent` | buttons, current segment, links, bar fills |
| `--on-action` | `#FFFFFF` | `#14151C` | text on `--action` |
| `--accent` | `#FF6B4A` | `#F2B33D` | the mark, rules, lab slot underline, pixel h1 |
| `--figure` | `#2B2D6E` | `#E8E4D8` | tile figures |
| `--eyebrow` | `#B93A22` | `#B9A6F2` | the eyebrow |
| `--save` | `#B93A22` | `#F2B33D` | "You save" text |
| `--save-tint`, `--save-line` | `#FFF1EC`, `#F6C9BC` | `#2A2410`, `#F2B33D` | the save pill |
| `--promo` | `#2B2D6E` | `#B9A6F2` | the promo line |
| `--promo-tint`, `--promo-line` | `#FFF1EC`, `#F6C9BC` | `#211D30`, `#B9A6F2` | the promo note |
| `--pass`, `--pass-tint`, `--pass-line` | `#1F4FBF`, `#EAF0FF`, `#C3D2F3` | `#7FE0A6`, `#132A1E`, `#2F6B4A` | pass |
| `--fail` (fills) | `#F2A541` | `#FF7A6B` | failed square, banner rule |
| `--fail-ink`, `--fail-tint`, `--fail-line` | `#B4500B`, `#FFF3E3`, `#F4CFA0` | `#FF7A6B`, `#2A1716`, `#7A2E26` | fail text and banner |
| `--fail-hatch` | `#B4500B` | `#7A2E26` | stripes in a failed square |
| `--neutral` | `#B9B4C9` | `#5A5D70` | no data, skipped, minor, the p95 fill (lab) |
| `--monogram` | `#CFC6B6` | `#7A5A12` | the photo fallback letter (decoration, `aria-hidden`) |
| `--panel-stripe` | `#EEE7DB` | n/a | the lab photo fallback's second stripe |

Pixel only: `--accent-shadow #7A5A12`, `--accent-hi #FFD97A`, `--accent-tint #2A2410`, the mark's
dome `#B9A6F2`, skyline bodies `#262B3A #1E2230 #1A1D29`, roofs `#3A3F52`, unlit windows `#4A4E62`.

Contrast (text on its ground, all at least 4.5:1): lab muted on ivory 6.6, `#B93A22` on ivory 5.4,
`#B4500B` on its tint 4.7, white on indigo 12.3; pixel muted on panel 7.0, amber on ground 9.8,
`#14151C` on amber 9.8, red on panel 6.6, lavender on panel 7.8, mint on panel 10.5. A toned tile sits
on its tone's tint, because fail ink on the plain lab panel is only 4.4: lab fail ink on its tint 4.7,
pass ink 6.3, muted 6.2 and 6.4; pixel red on its tint 6.7, mint 9.5, muted 6.3 and 7.1. Coral on ivory
is 2.7:1, so **coral is never text** and never sits under white text.

## 2. Type

Lab: Sora (headings, big figures), IBM Plex Sans (text), IBM Plex Mono (figures in rows and tables).
Pixel: Silkscreen (labels, nav, section titles, buttons; always `text-transform: uppercase`), Press
Start 2P (the h1 and **one** display figure per page), IBM Plex Mono (text and every other figure).

| Role | Lab (phone) | Pixel (phone) |
|---|---|---|
| Wordmark | Sora 700 18, +0.02em (15) | Silkscreen 700 16, +0.12em, "ZORA" in accent (11, +0.08em) |
| Nav link | Plex Sans 500 15 (14) | Silkscreen 12, +0.08em (10, +0.04em) |
| Eyebrow | Plex Mono 500 12, +0.06em, caps (11) | Silkscreen 12, +0.1em (11) |
| h1 | Sora 700 38/1.15 (28); over 60 characters 30 (24) | Press Start 2P 28/1.4, accent, 4 px black text shadow (20, 3 px); over 60 characters 22 (18) |
| Lead (at most two sentences) | Plex Sans 16/1.5 muted, max 820 wide (14) | Plex Mono 15/1.6 muted (14) |
| Section title | Sora 600 22/1.3 (18) | Silkscreen 700 16, +0.08em (13) |
| Card title | Sora 600 16 muted (15) | Silkscreen 700 12, +0.1em, muted |
| Picker word | Sora 600 26 (20) | Silkscreen 700 20, +0.04em (16) |
| Picker slot | Sora 600 24, `--action` (22) | Plex Mono 600 18, accent (16) |
| Field label | Plex Sans 500 12 (slot), 13 (field) | Silkscreen 11, +0.1em |
| Body | Plex Sans 15/1.5 | Plex Mono 14/1.6 |
| Note, hint, foot | Plex Sans 13/1.45 muted | Plex Mono 12/1.6 muted |
| Tile label | Plex Sans 500 13 muted | Silkscreen 11, +0.1em |
| Tile figure | Sora 700 32, lead 36 (24, lead 30); capped: lead at the cap, the others 4 under it | Plex Mono 700 28, lead 32 (20, lead 24); capped the same way |
| Figure (label over a figure) | label Plex Sans 500 12 muted, Sora 700 26 (22) | label Silkscreen 10, Plex Mono 700 24 (20) |
| Deal title | Plex Sans 600 16/1.35 | Plex Mono 600 15/1.4 |
| Price to pay, card | Sora 700 30, winner 36 (28, winner 30) | Plex Mono 700 28, winner 32 (26, winner 28) |
| Price to pay, row (rank, gap and option rows) | Plex Mono 600 16 (18) | Plex Mono 700 16 (18) |
| Price to pay, deal page | Sora 700 44 (36) | Press Start 2P 28 accent (22) |
| Original | Plex Mono 14, struck, muted | same |
| Table head | Plex Sans 600 12, +0.04em, caps | Silkscreen 11, +0.1em |
| Badge | Plex Sans 600 13 | Silkscreen 700 11, +0.08em |
| Button | Plex Sans 600 15 | Silkscreen 700 14, +0.1em |
| Verdict word | Sora 700 36, caps (28); example 28 (24) | Press Start 2P 28 (20); example Silkscreen 700 20 (16) |

The pixel display figure (at most one per page, never on a saving): Price truth and Scorecard spend it
on the live verdict word, Deal on the price to pay in the buy box; Top deals and Find a deal spend none,
because their lead tile is a saving and must not outshout the prices. So every lead tile is Plex Mono
32 (`tiles()` default; `display_lead=True` is only for a page with no price and no verdict). An example
verdict drawn under a page is never a second display figure. Fonts: lab loads Sora 400/600/700, Plex Sans 400/500/600, Plex Mono
400/500/600; pixel loads Press Start 2P, Silkscreen 400/700, Plex Mono 400/500/600/700.

## 3. Space, radii, lines, shadows

4 px grid. Desktop: 56 gutters, main padding 40 top and 56 bottom, 28 between blocks, 20 inside a
section, cards padded 24, picker 24 by 28 (pixel 20 by 24), tiles 18 by 20 (pixel 16 by 18), grid gaps
20 on every side by side row (`columns` defaults to 20: podium, grids, strip cards, drawn states, the
Deal page's photo and buy box), rows 12 top and bottom. Phone: 16 gutters, main 24 and 32, 20 between blocks, 14 inside a section,
cards 16, tile and podium gaps 10 and 14, card lists 12. Every control is at least 44 tall: picker slots
44 (lab) and 48 (pixel), buttons 48, sort segments and nav links 44, the switch segments 44 as their own
hit boxes, breadcrumb links 44, a link on its own line 44 [`text_link`].

Lab radii: card 16; nested card (finding, empty state, compact photo) 12; field, button, sort 10; switch
track 10 and segment 7; pill and badge 999; histogram 6; bar and square 4. **Pixel radius is 0
everywhere.** Lines: lab 1 px `--line`, row rules 1 px solid; pixel 2 px `--line`, row rules 2 px dotted.
Lab has no shadows. Pixel: cards, tiles, picker and sort `4px 4px 0 #000`; switch `3px 3px 0 #000`;
primary button 2 px `--accent-hi` border and `4px 4px 0 --accent-shadow`; winner card 2 px accent border
and `4px 4px 0 --accent-shadow`; fields `inset 2px 2px 0 #000`; `shape-rendering: crispEdges` on SVG,
`image-rendering: pixelated` on photos. Pixel gradients exist only as segmented fills, the checker, the hatch.

## 4. The lockup and the switch  [`lockup`, `mark`, `wordmark`, `switch`]

The lockup is the mark, the wordmark (together one home link to `/`), a rule, and the look switch.

```
Desktop, lab look (header 72 tall plus its 1 px line, 56 gutter, everything centred on one line)
 |28 | 12|      147      |16|1|16|  56  |2|  64   |      = 187 + 33 + 130
 [mark]   Zora Agent Lab    |    ( ● Lab | ■ Pixel )      track 32 tall: panel, 1 px line, r10, 3 inset
                            |      ^^^^^                   segments 24 tall, r7, 10 sides, glyph 8, gap 6
                                   indigo fill, white text; the other muted, no fill

Desktop, pixel look (header 72 tall plus its 2 px line, then the skyline)
 |32 | 12|        205          |16|2|16|  63  |  82   |      = 249 + 34 + 149
 [mark]   ZORA AGENT LAB         ‖    [ ● LAB ‖ ■ PIXEL ]     track 32: #0F1016, 2 px line, 3 px black shadow
                                                ^^^^^^^       segments 28 tall, 10 sides, 2 px divider
                                                accent fill, #14151C text; the other muted

Phone (both looks): row 1 is 60 tall, row 2 is the nav, 44 tall
 |16| mark |10| wordmark (15 lab, 11 pixel)          switch |16|
 |16| Top deals   Find a deal   Price truth   Scorecard       |16|   spread, current marked
```

- The lab mark (SVG, `viewBox 0 0 32 32`, drawn 28, phone 24): accent bars `7,3,3,9`, `14.5,0,3,12`,
  `22,3,3,9`; arch `M3 25a13 13 0 0 1 26 0z` in `#2B2D6E`; accent base `3,27.5,26,3`.
- The pixel mark (SVG, `viewBox 0 0 16 16`, drawn 32 so a cell is 2 px, also on the phone): accent bars
  `3,2,2,4`, `7,0,2,6`, `11,2,2,4`; stepped dome `6,6,4,1`, `4,7,8,1`, `3,8,10,1`, `2,9,12,3` in `#B9A6F2`;
  accent base `2,13,12,2`.
- The switch shows the current look filled, drawn in the current look. Glyphs preview the looks: a circle
  before "Lab", a square before "Pixel", both `currentColor`.
- Markup: `<form method="post" action="/theme" aria-label="Look">` holding `<button name="theme"
  value="lab" aria-pressed>` and the same for `pixel`. Without scripts it posts and the next page renders
  from the `zal_theme` cookie; with scripts it sets `data-theme` on `<html>` at once, stores the choice
  and posts in the background. No reload, no flash.
- Hit area: each segment is its own 44 tall transparent box (the `<button>`, on a board the `<a>`)
  holding the visible pill as an inner span (lab 24, pixel 28, centred); the 32 tall track is a layer
  drawn behind the segments (top 6), so the pills sit exactly where they did and the whole 44 is live.
  Hover on the other segment: lab white fill and ink text; pixel accent text on `--accent-tint`. Focus: lab `outline: 2px solid #2B2D6E; outline-offset: 1px`; pixel `outline: 2px
  dashed accent; outline-offset: -5px`.
- On the phone the wordmark shrinks (15 lab, 11 pixel; it may drop on screens under 360) and the switch
  moves to the right edge, under the thumb. See `Lockup.dc.html` and `LockupPixel.dc.html`.

## 5. Header, nav, skyline  [`header`, `nav`, `skyline`]

Header: lockup left, nav right, `padding: 14px 56px`, `--bar` fill, one line under it. Nav, always in this
order: **Top deals** (`/`), **Find a deal** (`/find`), **Price truth**, **Scorecard**; the current link
has `aria-current="page"`. Lab links: gap 28, `padding: 10px 4px`, 44 tall, muted; current: ink with a
3 px accent underline. Pixel links: gap 8, `padding: 0 14px`, 44 tall, a transparent 2 px border; current:
accent text, 2 px accent border, `--accent-tint` fill. Phone: the nav is the header's second row
(links spread, lab 44 tall, pixel 40 tall in a 44 row). The Deal page marks no link.

Skyline (pixel only, `aria-hidden`), right under the header. Top deals: 56 tall, buildings 24 to 44 wide
and 18 to 50 tall, 6 apart, 2 px roofs, 4 px windows lit in accent or unlit, a 4 px accent rule under it.
The skyline is the home page's own mark. Every other page: the quiet strip, a flat `--bar` band 24 tall
with a 2 px `--line` rule, no buildings and no windows. Nothing sits on it. The strip never shrinks
(`flex-shrink: 0`): a board short of its content clips its foot, never the strip.

## 6. The parts of a page

**Hero** [`hero`]. Eyebrow ("Product 4 · an AI Builder showcase"), h1 (the page name), lead (one or two
sentences, never three; on Price truth and Scorecard it states today's answer with its numbers; what the
promo line under a deal already shows, such as where a promo code goes, is not repeated). Column, gap 8 (pixel
12), max 820 wide; the sample pill sits at the right, bottom aligned (phone: under the lead, left).

**Picker card** [`picker`]. One sentence of words and slots on a surface card, the button ending it,
a note under it (13 muted: what the lists hold). The sentence wraps like text (gap 10 by 14, bottom
aligned); a word sits on its slot's baseline. Slot: its label above (Plex Sans 12 muted; pixel
Silkscreen 11). Lab slot: no box, 44 tall on both widths, a 3 px accent underline, `--action` text, a
12 by 8 chevron. Pixel slot: a box exactly 48 tall (a fixed height, so a text input never grows past
the selects), `--field`, 2 px `--field-line`, a 4 px accent bottom border, inset shadow, accent text, a
stepped chevron. A typed slot is the same without the chevron, 220 wide by default (the part may carry
its width). Button: primary, 48 tall. Desktop: each word stays on one line with the slots after it,
and the last group with the button, so a wide live select breaks the sentence between groups and the
button is never alone on a line. Phone: two columns, the words in one column as wide as the widest
word and the slots in the other, so every slot starts at one x. A word shares its row with the slot
after it; a word of more than 8 characters, or one with no slot after it, takes a row of its own (so
a slot keeps at least 200); a slot with no word before it stays in the slot column. Pair a slot with
a short word where the sentence has one: "Top 20 deals" and "in" as two words, so "in" sits beside City
(the desktop joins them back with a plain space). The button is full width. The two sentences, same lists, same labels:

- Top deals: "Top 20 deals in [City] for [Category] [Within it] **Show**", one line on the desktop.
- Find a deal: "Find [What] in [City] / for [Category] under [Price] **Search**", where City offers
  "anywhere", Category "anything", Price "any price". Four slots do not fit one line at 1280 with What
  at 220 (measured: lab 24 px over, pixel 90 px over), and a live select is as wide as its longest
  option, so the sentence breaks after City in both looks (the `("break",)` part); the phone ignores
  the break.

Boxed fields exist for other forms only [`text_field`, `select_field`]: label 13 above, 48 tall, padding
10 by 14, lab r10 1 px `--field-line`; pixel 2 px `--field-line` with the inset shadow.

**Section and the title rule** [`section`, `title_rule`]. A section is its head on the ground, then its
body (cards, tiles, podium). Title: lab Sora 600 22 with a 3 px accent rule under the text only
(`padding-bottom: 8px`); pixel Silkscreen 16 caps after an 8 by 8 accent square, with a 4 px accent rule.
Right of the title: the sort toggle, or the refresh note ("Refreshes daily at 04:00 UTC", 13 muted, on
the title's baseline; on the phone it sits under the note with no baseline padding). Under it: the note (14 muted), what the order is or what the section measures;
when a sort and a refresh share a head, the refresh joins the note after " · ". Every section of Price
truth and Scorecard carries its refresh note ("Refreshes ..."), including a section whose rows arrive
as they are found: "Added as they are found" joins the note, it never takes the refresh's place. Side
by side, sections end on one line: `columns(..., stretch=True)` with `section(..., fill=True)`, so each
card fills its section. A section a link points at carries an id: `section(..., anchor="promo-gap")`.

**Results head** [`results_head`]. The section head of a result list. The title states the count and the
query ("Top 20 in New York, NY: Things To Do", "9 deals for "massage" in Chicago, IL", "Today's picks:
massage"); the note states the order ("Ordered by relevance."). Card title inside a section [`card`]:
Sora 600 16 muted (pixel Silkscreen 12 caps muted), e.g. "Ranks 4 to 20".

**Sort toggle** [`sort_toggle`]. Links, not buttons. 44 tall, `padding: 10px 16px`. Lab: 1 px line, r10,
white; current indigo fill and white text, the others indigo text, 1 px dividers. Pixel: 2 px line,
`--bar` fill, 4 px shadow; current accent fill; Silkscreen 12 caps. The word "Sort" before it (13 muted).
Phone: full width, equal segments, no "Sort", pixel 11 px.

**Tiles** [`tiles`]. Three or four figures computed from the page's own data. With a lead tile the grid
has one column more than tiles and the lead spans two (four tiles: five columns). Lab tile: `--panel`,
no border, r16; label, figure (`--figure`), hint; lead: a 3 px accent top rule, figure 36. Pixel tile:
panel, 2 px line, 4 px shadow; lead: a 4 px accent top border, figure 32. A page with prices but no
podium caps its tiles at its biggest price to pay (`tiles(cap=price_size(theme, phone, compact=phone))`
on Find a deal): the lead takes the cap, the other tiles 4 under it. A label is at most 16 characters
(Silkscreen 11 wraps past that at half the phone row; the build prints a note). A hint stops at two
lines with an ellipsis, on every page, so a hint may name a deal by its full title. A figure may take
the pass or fail tone; then the tile takes that tone's tint (`--pass-tint`, `--fail-tint`) in both looks
and its label carries the check or cross glyph (14 lab, 12 pixel), so the tone never rests on colour
alone. A tile that counts promo codes ("Promo codes: 5 of 9") counts exactly the promo lines on the
cards, so the two always agree. Phone: two per row, the lead full
width, an odd last tile full width.

**Figure and figure row** [`figure`, `figure_row`]. A label over a figure outside a tile, with an
optional pass or fail tone. A figure row sets figures side by side on the ground (gap 28, phone 24,
wrapping): the verdict's rates, and the figures a section states under its note (Price truth's promo
gap: sellable options, with a code, median gap, 90th percentile).

**Deal card** [`deal_card`]. One card for the finder grid and the podium. Top to bottom: photo slot (150,
winner 200), title (the link; a stretched span inside it covers the card, so the photo and every line
open the deal), option, city (only when the list spans cities, as "anywhere" does; a list scoped to one
city names it in its head, not on every card), the promo line when the deal has a code; then at
the card's foot "You pay", the price to pay, the original struck, and the save pill. A grid links every
card to the Deal board of its own look and width (`deal_grid(..., href=...)`). Lab: surface, 1 px line, r16; winner adds a 4 px accent top border. Pixel: surface, 2 px
line, 4 px shadow; winner: 2 px accent border, `--accent-shadow` shadow.

Photo fallback [`photo`, `monogram`]: a placeholder, never the loudest mark of a card. The letter is
the first letter of the title's first word that starts with a letter, after a leading "Up to N% Off
on" (so no row of U, and never a digit beside a rank badge). It is centred in `--monogram`, sized to
the slot: lab a fifth of the slot's height, pixel 0.18, on a 4 px step (slot 88 or 120: 24 and 20; 150:
28 and 24; 200: 40 and 36; 360: 72 and 64). Lab ground: 45° stripes of `--panel` and `--panel-stripe`,
12 wide; pixel ground: the 16 px checker (`#1F2230`, `#181A23`), the letter in Silkscreen 700 with a
2 px black shadow.

Save pill: "You save $61.00 · 43.6 %", Plex Mono 13, lab `--save-tint` with `--save-line` and `--save`
text r14 (a full pill on one line, a soft chip on two), pixel `--accent-tint` with a 2 px accent
border. "You save $61.00 · 43.6 %" is one unit: a labelled pill breaks after the label ("Biggest saving
·" over "You save $59.00 · 30.4 %"), never between a saving and its percent; only a unit wider than the
pill's line breaks, before the percent. Filled (lab indigo and white, pixel accent and `#14151C`) on
the podium winner and on any card or option row a tile names; the naming tile's own label leads it:
"Biggest saving · You save $45.00 · 37.5 %", "Cheapest · You save …". In an option row the filled pill
takes the place of the plain "You save" text on the price line; the row's button is secondary
(outlined), so the pill never reads as a second primary action. There is no other card marker (no ribbon, no
corner tag). Phone compact form (the finder): an 88 photo left (lab r12), the text right, "You pay" on
its own line over the price (26, pixel 24) and the original, so both looks hold that line alike.

**Podium** [`podium`]. Ranks 1 to 3 as deal cards with a rank badge (36, 12 from the photo's top left;
lab an indigo circle, Sora 700 16 white; pixel an accent square, Silkscreen 700 16 `#14151C`, 3 px
shadow). Grid `1.5fr 1fr 1fr`, gap 20; cards stretch, so prices of 2 and 3 line up. The winner's pill is
filled; it carries a tile's label only when that tile names the winner ("Biggest saving" when the
list is ordered by amount). The words "Best deal" are gone.

**Rank rows and the saving bar** [`rank_rows`, `saving_bar`]. Ranks 4 to 20 in a card. Columns `44px
1fr 110px 120px 120px 150px`: #, Deal (title, marker, option under it), Original, You pay, You save,
Saved; gap 12, row rules; head in the table-head style. Rank: lab mono muted "4", pixel mono accent
"04". You save in `--save`. Saving bar: lab a 72 by 8 track r4 with an indigo fill; pixel a 76 by 6 fill
inside a 2 px line, segmented accent (6 on, 2 off); the percent after it, mono 13. Phone: rank 36 wide, then three lines on every row: title and option; "You pay", the price
(mono 18) and the original (13); "You save $36.00" (13) opening the bar line, then the bar with the
bare percent "60.0 %" (the column head says Saved; " saved" pushed the bar to a fourth line at 390).
No city column on a ranked list.

**Gap rows** [`gap_rows`]. Price truth's largest promo gaps in the rank rows' form: #, Deal (title and
promo line), You pay, Gap (the bar and "40.1 %"); columns `44px 1fr 130px 180px`. A WorstGapDeal has no
original, and its promo price lives only in the promo line. Phone: the deal, "You pay" and the price,
then the bar with "40.1 % gap". Every row is shown on the phone too, with its promo line.

**Promo line** [`promo_line`]. The promo is one line under the deal it belongs to, after the option (and
the city on a card): "Type code FALL at Groupon checkout to pay $376.20.", the first sentence of
`PromoNote.instruction`; lab Plex Sans 400 12 `--promo`, pixel Plex Mono 12 lavender, line height 1.4,
2 above. The second sentence ("Without it you pay $396.00.") is the row's own "You pay", so it is not
repeated. A deal without a code has no line. There is no footnote list: twenty numbered sentences with
the same code under a list read as noise (the owner's words, 1 Oct), and a reader looking at a deal
should see its code there. The promo price appears nowhere but inside this sentence (rule 2).

**Data table** [`data_table`]. Head as above, padding 10 by 12, the line under it; cells padding 12,
14 px; first column 500 ink; figure columns mono, right aligned, on one line (figures include dates,
hashes and versions: "2026-09-14", "3f9ac1…0c21", "version 7"); row rules; wrapped in an `overflow-x:
auto` box. A date in a table is written "2026-09-28" in a figure column, never "28 Sep 2026" as a
lead column. One column may take the spare width (`grow`, usually the first), so the figure columns
sit together at the right of a wide card. A figure may take the pass or fail ink [`toned`]: the cell
itself is coloured (600) and keeps line height 1.3, so a toned row is as tall as its neighbours. Rows that end on their card's edge drop the last rule (`last_rule=False`), and so do check
rows; a card's edge is never doubled by a row rule. Phone: a labelled list led by one cell as the row's
title (600 15; `phone_title` picks the column, such as a long option name), then one line per other
cell, label left (13 muted, pixel Silkscreen 10) and value right.

**Histogram** [`histogram`]. Horizontal bars: label 110 (phone 84) muted, track 22 tall (phone 18),
figure 88 (phone 64) right aligned mono 13. Lab: track `--track` r6, fill indigo r6. Pixel: track with a
2 px line, fill segmented accent (8 on, 2 off). A value that is not zero keeps at least 4 px of fill.
A bar may carry a second value behind the first (`back`): lab `--neutral`, pixel `--accent-shadow`
segmented, the first drawn over it. Long labels stack: label and figure on one line over a full-width
track (`stack=True`). The legend sits over the bars, its swatches drawn with the bars' own fills; an
axis of evenly spread ticks may sit under them. **Latency** [`latency_bars`] is this chart: p50 in
front, p95 behind, "524 · 3,723 ms" as the figure, a 0 to 4 s axis, step names at 260 on the desktop
and stacked on the phone, and "Show all 29 steps" as a text link under it. **Day bars** [`day_bars`]: one vertical bar per day, 120 tall (phone 96), gap 4
(2), a base line; lab indigo r3 top, pixel accent segmented in whole 8 px segments (6 on, 2 off,
rounded down, so no bar ends in a sliver); a day that is not zero keeps a visible bar (lab 4 px, pixel
one segment); the peak above left ("Peak 1,284 on 21 Sep"), first and last date under it (mono 12
muted).

**Day strip** [`day_strip`]. One square per day or run, oldest left. Desktop 20 by 20, gap 6 (30 squares
= 774 wide); phone two rows of 15 filling the width, gap 4. Pass: filled `--pass`. Fail: hatched at 45°,
`--fail` with `--fail-hatch` stripes (3 and 2), so it reads without colour. No data: a dashed
`--neutral` outline. Lab r4, pixel square. Under it the first and last date (mono 12 muted), then the
legend ("Matched", "Mismatched", "No sample"; Scorecard: "Pass", "Fail", "No run"). `role="img"` with a
sentence such as "30 days: 28 matched, 1 mismatched"; each square carries its date and outcome in a
title ("30 Sep: Fail").

**Side cards, strip cards, sync card** [`side_cards`, `strip_cards`, `sync_card`]. Every measured
section has one form: a history card on the left, a 320 wide card with the latest state as a labelled
list on the right, ending on one line; the phone stacks them [`side_cards`]. For a 30-day strip, on
Price truth and on Scorecard [`strip_cards`]: a card titled with the count and its unit ("Last 30 days:
580 of 581 carts matched", "Last 30 days: 23 of 28 runs passed") holding the strip and, at its foot, one
note on the last failure and the missing days; beside it "Latest day: 30 Sep" (or "Latest run: 30
Sep") with the latest counts. The catalogue sync is one card wherever it is reported [`sync_card`]:
"Next sync: 00:00 UTC" over "Delta sync every 3 hours", "Last delta sync 21:00 UTC", "Delta syncs today
8", "Last full load 28 Sep", then any count the page adds ("Listable deals 55,805 of 61,477"), and at
its foot when the next sync runs and what it picks up. Price truth's Freshness puts it beside the day
bars; Scorecard's catalogue section uses the same card, never a second tiles row.

**Verdict banner** [`verdict`]. `role="status"`: the word in a fixed 288 column (it fits "Mismatched"
in both looks, so the sentence starts at one x on every banner), one sentence with today's numbers, the
rates at the right as a figure row. The other state may be drawn under the page as an example, in
`drawn_state` with its caption ("When the latest run passed"): no `role`, the word a size down and, in
pixel, in Silkscreen, never a second display figure, and **no rates**: its sentence carries its own
counts, so no figure on it can be read as today's. Lab: tint fill, 1 px tint line, an 8 px left rule in `--pass` or `--fail`, r16, padding
20 by 28; word Sora 700 36 caps in `--pass` or `--fail-ink`; sentence 16 ink; rates: label 12 muted
over Sora 700 26 ink. Pixel: tint fill, 2 px border in the tone, 4 px shadow; the word is the page's
display figure, Press Start 2P 28 in the tone; rates Plex Mono 700 24. Fail when any cart or page
disagreed (Price truth) or the latest run failed (Scorecard). Phone: stacked.

**Check rows and badges** [`check_rows`, `badge`]. Grid `260px 120px 1fr`: name (500 15), badge, what it
saw (14 muted); phone, and a half-width card on the desktop (`narrow=True`): name and badge on one
line, the detail under them. A detail that compares may be "Expected: …" and "Observed: …" lines
[`label_line`], the same lines the finding card uses. Badge: lab r999, padding 4
by 10, a 14 glyph (check, cross, dash); pixel square, 2 px border, padding 3 by 8, a 12 square-capped
glyph. Tones: pass, fail, neutral (skipped, minor, a status), strong (the fail ink filled; blocker only).

**Finding card** [`finding_card`]. Surface, a line, a left rule in the severity's colour (lab 4 r12,
pixel 6), padding 16 by 20. Severity badge in a 96 column (blocker strong, major fail, minor neutral);
then the area (600 15), "Expected: …" and "Observed: …" (label muted, text ink); the status badge at the
right, in its own tone apart from severity: pass once handled ("Reported", "Fixed"), neutral while
"Open" (never the promo lavender). Phone: the badges on top.

**Foot line** [`foot`]. The page's last block: a rule (lab 1 px, pixel 2 px `--row-line`), 16 above the
text; line one says when the page's numbers refresh and, on every page, ends its first sentence with
"the next delta sync runs at 00:00 UTC"; line two: "Prices come from the Groupon Partner Storefront
API. The price a shopper pays is the retail price."

**Card note, state caption, drawn state** [`card_note`, `state_caption`, `drawn_state`]. A muted line
inside a card (13; pixel mono 12), pinned to the card's foot with `foot=True`. A state caption names a
drawn state over it ("When nothing matches", "When a cart or a page disagrees"): lab 13 muted, pixel
Silkscreen 10. `drawn_state(caption, block)` is the one wrapper for every drawn state, the example
verdict and the empty panel alike (caption, gap 10, the block).

**Sample pill** [`sample_pill`]. Boards only, once, in the hero: "Sample data". Lab Plex Mono 12, panel
fill, 1 px dashed muted, r999; pixel Silkscreen 11 caps, a 2 px dashed line. The live site never shows it.

**Empty state** [`empty_state`]. A caption naming the case ("When nothing matches"), then the panel:
lab `--panel`, 1 px dashed `#CFC6B6`, r12, padding 24, 15 ink; pixel surface, 2 px dashed line, mono 14.
One sentence says what is missing and when it arrives, one link gives the next step (underlined, 600),
worded as a phrase with no closing period and pointing at the next step for this page's reader (not at
another product). Every empty state has its link; a state with no next step is a dead end. The link is
one unit: it moves to a line of its own rather than break inside, so keep it short (about 30
characters: "Read the API contract", not "Read the API contract the probe checks"). Boards draw it
under the main content: a lone state at most 760 wide on the desktop; two states side by side each take
half the row, `columns(..., stretch=True)` with `empty_state(..., fill=True)`, and end on one line.

**Deal page parts** [`breadcrumb`, `photo_frame`, `buy_box`, `price_block`, `promo_note`, `option_row`,
`option_list`, `location_list`]. Breadcrumb: 14, "/" between, links in `--action` in 44 tall boxes; the
path stops at the leaf label on both widths ("Find a deal / Things To Do / Tours"), because the h1
right under it names the deal and a live title of 116 characters repeated in the path wraps onto its
own line. The eyebrow carries only the city ("New York, NY"), since the path already names the
category. Photo frame: the deal's one large photo in the card skin, growing to the buy box beside it
(360 at least; phone 150), the fallback letter sized by the photo rule. Buy box: a card "The cheapest
option" with the option's name, the price block, the page's one primary "Get checkout link", the
voucher note and "See all 3 options" as a text link. Desktop: the photo left, the buy box right. Phone:
the buy box first, then the photo, so the price to pay stays on the first screen under a long h1. Price block: "You pay", the
display price, the original struck (16), the save pill, the promo note (lab `--promo-tint` r10 with a
coral-ink stroked tag glyph; pixel `#211D30` with a 2 px lavender border and a stepped tag on a 9 by 8
grid, no curve). Option row: title and marker, a price line ("You pay", the price at the row size, the
original, "You save", or the filled save pill when a tile names the option), then "Get checkout link"
at the right (phone: full width under it), secondary when the page has a buy box. The option the buy
box already sells says "In the box above" with a check, in `--action` 600 (it is the answer, not a
dead end); an option that cannot be sold says "Not available right now" in muted text and has no
button, so the two states never look alike. The section note is true of every row ("Ordered by the
price you pay; the cheapest is in the box above"), never "each option has its own checkout link". Option list: the rows in a
card, the first without its top padding, each option's promo line under its title. Location list: a pin (lab stroked,
pixel stepped), the place's name over the street line, rules only between rows.

## 7. Phone (390)

- Nothing wider than 390 and no sideways scroll; 16 gutters; every table becomes a labelled list.
- Header in two rows: the lockup row with the switch at the right edge, then the nav.
- Picker: words in one column, slots in the other, every slot at one x; the button full width. Sort: full width.
- Tiles two per row (lead and an odd last one full width); figures 24 and 30 lab, 20 and 18 pixel.
- Podium one card per row; the finder uses the compact card; ranks become labelled rows.
- The price to pay stays the biggest figure of every card and row.
- Long titles `overflow-wrap: anywhere`; figures `white-space: nowrap`; no negative margins.
- The day strip folds into two rows of 15. Touch targets stay 44.
- Every ranked list shows all its rows on the phone, as on the desktop, with every footnote.

## 8. Words

| Thing | Say | Never |
|---|---|---|
| The pages | Top deals, Find a deal, Price truth, Scorecard | Deal finder, Find deals, Partner scorecard |
| The price paid | You pay $49.00 | price, sale price, deal price |
| The struck price | Original | list price, was, regular price |
| The difference | You save $31.00 · 38.8 % | discount, off, deal |
| Promo | promo code, and the fixed sentence | coupon; a promo price outside the sentence |
| A city | New York, NY | NYC, New York (NY) |
| Money | $1,238.00 (two decimals, `formatMoney`) | $1238, 1,238 USD |
| Percent | 43.6 % (one decimal, a non-breaking space) | 43.6%, 44 percent |
| A count | 3 of 20 | 3/20 |
| A schedule | Refreshes daily at 04:00 UTC; Refreshes every 3 hours (the refresh note of every section) | Updated, last sync; "Prices refresh" in a refresh note |
| A moment | 3 hours ago (2026-09-30T04:00:12Z), relative first, the stamp never broken [`moment`]; on a strip, 30 Sep; a tile leads with "2 hours ago", the clock time in its hint | a bare timestamp |
| A date | 28 Sep in text, notes, tiles and strips; 2026-09-28 in a table's figure column | a weekday ("Mon 28 Sep"), 28 Sep 2026 |
| The catalogue sync | delta sync, full load, "Last delta sync", "Last full load", listable deals ("55,805 listable, of 61,477 in the catalogue") | catalogue copy, refresh (for the sync), full run, delta run, products (for deals) |
| Outcomes | Pass, Fail, Skipped; Matched, Mismatched, No sample | OK, Error, N/A |
| Severity | Blocker, Major, Minor | Critical, High, Low |
| Buttons | Show, Search, Get checkout link | Go, Submit |
| The switch | Look: Lab, Pixel | Theme, Dark mode |
| Board tag | Sample data | Demo, Mock |

The sample clock [`CLOCK` in common.py]: every board is read at one moment, Wednesday 30 Sep 2026, 23:23
UTC, and states times that agree with the schedule in `wrangler.jsonc`. Delta syncs every 3 hours from
00:00 (8 so far that day, the last at 21:00, the next at 00:00 UTC); the probe daily at 04:00 (19 hours
ago, 2026-09-30T04:00:12Z); the cart sample and the promo gap daily at 04:30; groupon.com pages at
06:00; the city list and the category tags daily at 00:30; the full load Mondays at 05:00 (the last on
28 Sep).

## 9. Never

- A promo price as the price, a promo column, or any price but the original and the price to pay.
- Two components for one job, or a part that moves between the looks.
- Coral as text; text under 4.5:1; a rounded corner in pixel; Press Start 2P on a second figure or on a
  saving.
- A card marker other than the filled save pill (a ribbon, a corner tag); "Best deal".
- A monogram louder than the price.
- A promo list in two columns; a ranked list cut short on the phone.
- A second tiles row on a page; rates on an example verdict; an empty state with no next step.
- Decoration over a figure, or content wider than the board.
