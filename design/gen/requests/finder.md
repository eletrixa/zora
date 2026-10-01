<!-- Module: design/gen/requests/finder.md · Tested: n/a · Parts design/gen/finder.py draws locally in round 1, for the language step to fold into common.py -->
- `picker` (desktop): keep each word with its slot and the last pair with the button (nowrap groups), because a live select is as wide as its longest option ("Fort Lauderdale, FL", "Personalized Items"), so the sentence wraps and today the button can end up alone on a line; finder.py `picker` draws it. **folded: `picker`** (desktop groups; plus the `("break",)` part, so the four-slot sentence breaks after City in both looks, see LANGUAGE.md).
- `picker` parts: let a ("text", ...) part carry its width, so a page can set the typed slot to 180 without drawing the picker itself; the Find a deal sentence fits one line at 1280 only with What at 180. **folded: `picker`** (`("text", label, value, placeholder, width)`; 220 by default).
- `sentence_text` (pixel): `min-height: 48px` lets the input grow to 52 while the selects stay 48, so its label rides 4 px higher than the others; use `height: 48px`; finder.py `typed_slot` patches it. **folded: `sentence_text`** (the pixel slot is a fixed 48 in `_pick_box`, select and input alike).
- `tiles`: a two-line clamp on the hint, because a DealCard names its deal only by the full title, and live titles run to 110 characters; finder.py `clamp`. **folded: `tiles`** (every hint on every page stops at two lines).
- `deal_card`: an optional `tag` ("Biggest saving", "Cheapest") on the photo's top left, compact form above the title, so a tile points at its card in the tile's own words; finder.py `tag` and `tagged_card`. **declined**: r1-finder change 1 drops the ribbon (two components for one job). Folded instead: `deal_card` reads `d["label"]` and fills the save pill with it, `save_pill(label=...)`: "Biggest saving · You save …".
- `deal_grid`: pass `tag` through; today the tagged cards need their own grid in finder.py `grid`. **folded: `deal_grid`** (no parameter needed: the label rides in each deal dict).
- `photo` monogram: skip a leading "Up to N% Off on" and any word that starts with a figure, because four of nine live massage titles start "Up to" and the fallback read U, U, U, U; finder.py `monogram`. **folded: `monogram`** (`deal_card` uses it by default; finder.py's own copy is removed and `cards()` calls `c.monogram`).

## Also in common.py for round 2 (from r1-finder.md)

- Change 2: the compact card puts "You pay" on its own line over the price and the original, in both looks.
- Change 3: see the first line; a single line with What at 220 is 24 px over in lab and 90 px over in pixel.
- Change 5: `promo_marker` has inline padding 16 by 4, a tap target near 44 that does not move the line.
- Change 8: `footnotes` adds "Numbers match the list above; deals without a code are left out." when the numbers skip.
- `tiles` no longer sets the pixel lead in Press Start 2P by default (a saving never takes the display face).

## Round 2 (design/gen/finder.py)

- `deal_grid`: take the Deal board's `href` and pass it to `deal_card`, because every card links to `Deal.dc.html`, so a pixel or phone board opens the lab desktop Deal board; finder.py `grid` rewrites the link. **folded: `deal_grid(href=...)`** (pass `c.board_href("Deal", theme, phone)`).
- `empty_state`: a `fill=True` that lets the panel grow to its row (as `section(fill=True)` does), because two drawn states side by side end on different lines when their sentences differ by a line; finder.py `filled`. **folded: `empty_state(fill=True)`** (built on `drawn_state(fill=True)`).
- `save_pill` (with a label): when it wraps, break after the label ("Biggest saving" on its own line, then "You save $59.00 · 30.4 %"), because in a 375 wide finder card the labelled pill is about 5 px too wide in both looks and leaves "30.4 %" alone after a trailing "·"; finder.py leaves it as common draws it. **folded: `save_pill`** ("Biggest saving ·" breaks first; "You save $59.00 · 30.4 %" moves as one unit).
- `picker` (phone): set the words in one column as wide as the widest word ("under"), so every slot starts at one x, because the four Find a deal slots start at four different x and the left edge reads ragged; finder.py leaves it as common draws it. **folded: `picker`** (the phone sentence is two columns, words and slots; every slot starts at one x).
- `tiles`: cap the lead figure at the page's biggest price to pay when the page has no podium, because LANGUAGE caps the lead by the podium winner (lab 36, pixel 32) and on Find a deal, whose cards pay at 30 (pixel 28), the lead saving is the biggest figure on the page; finder.py leaves it. **folded: `tiles(cap=...)`** with `price_size` (`cap=c.price_size(theme, phone, compact=phone)`: lead 30, others 26 in lab; pixel 28 and 24; phone 26 and 22, pixel 24 and 20).

## Also in common.py for round 3 (from r2-finder.md)

- Change 1: `deal_card` covers the whole card with its title link (a stretched span inside the `<a>`, the article `position: relative`); the promo marker stays above it.
- Change 2: see the `tiles(cap=...)` line above; the cap is not applied until finder.py passes it.
- Change 4: see the `save_pill` line above.
- Change 5: the quiet strip is a flat `--bar` band with the 2 px `--line` rule; the skyline is the home page's alone.
- Change 8: see the `picker` line above.

## Round 3 (design/gen/finder.py)

- No local parts: finder.py now draws every part with common.py and patches none of its output (the Deal link rewrite, the filled empty state and the nowrap link phrase are gone).
- Words, not a part: the "Promo codes" tile counts every promo marker, but `PromoNote.code` may be null and then the sentence is "Groupon may offer $X at checkout. Expect to pay $Y." (src/shopping/index.ts); LANGUAGE.md should say whether that note keeps the "promo N" marker and the tile label, because live Top deals counts every note under "Promo codes".
