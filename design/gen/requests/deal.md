<!-- Module: design/gen/requests/deal.md · Tested: n/a · Parts the Deal boards draw in design/gen/deal.py because common.py lacks them; one line each: the part, why -->
# Requests from the Deal page (round 1)

- `photo(size=...)` or a `photo_frame`: the deal page's one large photo in the card skin, stretched to the buy box beside it, with the monogram scaled to the slot (120 lab, 96 pixel; 80 and 64 on the phone), because a 56 px letter reads as a stray glyph in a 640 wide slot. **folded: `photo_frame`** (on `photo(fill=True)`; the letter now follows the photo rule, 72 lab and 64 pixel at 360, per r1-deal change 5).
- `buy_box`: the card that holds `price_block` for the cheapest option with the option's name, the one primary "Get checkout link", the voucher note and the "See all 3 options" link, because `price_block` alone has no action and no option name. **folded: `buy_box`** (option name, price block, the one primary button, the voucher note, `more` as a `text_link`).
- `option_row(kind="secondary")`: the option rows use the secondary button, because the buy box already carries the page's one primary action and four filled buttons in a column shout. **folded: `option_row(kind="secondary", href=...)`**, and `o["note"]` puts "In the box above" in place of a second button (r1-deal change 2).
- `option_list`: the option rows inside a card, the first row without its top padding, because the card's padding already sits above it (deal.py strips it by string replace today). **folded: `option_list`** (takes `kind`, `href` and the footnotes as `notes`).
- `location_list`: the deal's addresses as rows with a pin glyph (lab stroke pin, pixel stepped pin), the place's name over the street line, because nothing in common.py draws an address. **folded: `location_list`**.
- `data_table(last_rule=False, phone_title=<column>)`: drop the last row's rule, which doubles the card's edge, and let the phone list lead with a chosen column (the option name), because a long option name wraps badly as a right aligned value. **folded: `data_table(last_rule=False, phone_title=1)`**.
- `promo_note` pixel glyph: the pixel look needs a stepped tag glyph, because the lab tag has rounded caps and an arc, which the pixel look never draws (deal.py swaps it today). **folded: `promo_note`** (the stepped tag in pixel, drawn by `_tag_glyph`).
- `columns(stretch=True)`: sections side by side (Locations beside About this deal) whose cards end on one line, because each card stops at its own content today (deal.py adds `flex: 1` by string replace). **folded: `columns(stretch=True)`** with `section(fill=True)`, so each card fills its section.

## Also in common.py for round 2 (from r1-deal.md)

- Change 1: `h1` steps down past 60 characters on its own (lab 30, phone 24; pixel 22, phone 18).
- Change 3: the switch segments are 44 tall hit boxes on every board.
- Change 4: `breadcrumb` links are 44 tall; "See all 3 options" is a `text_link` inside `buy_box`.
- Change 5: the photo fallback is quiet on every page (pale `--monogram`, lab stripes), see LANGUAGE.md.
- Change 6: `option_row` prints "You pay" before the price.
- The page module no longer draws `photo_frame`, `buy_box`, `pixel_tag`, `_pin` or `location_list`: it calls common's.

## Requests from the Deal page (round 2)

- `option_row(label=...)`: the option a tile names ("Biggest saving") carries the save pill led by the tile's label, tinted and not filled in a row, because a filled pill beside a checkout button wears the primary button's skin in pixel and outweighs the 18 px price (drawn by `name_rows` in deal.py); LANGUAGE.md's "filled on any card a tile names" wants one sentence for rows. **folded: `option_row`** (reads `o["label"]`; the pill is filled, not tinted, per r2-deal change 3: the row's button is secondary, so the pill never wears a primary skin. deal.py's `name_rows` is removed, it shadowed this).
- LANGUAGE.md, Deal page parts: the breadcrumb stops at the leaf label on both widths and the eyebrow carries only the city, because the h1 right under it names the deal and a live title of 116 characters repeated in the path wraps onto its own line in pixel. **folded: LANGUAGE.md, Deal page parts** (`breadcrumb` documents the leaf stop).
- LANGUAGE.md, Deal page parts: on the phone the buy box comes before the photo frame, because a live title fills 7 lines of the pixel h1 at 390 and would push the price to pay off the first screen. **folded: LANGUAGE.md, Deal page parts** (`buy_box` then `photo_frame` on the phone).

## Also in common.py for round 3 (from r2-deal.md)

- Change 2: `option_row` draws "In the box above" with a check in `--action` 600; "Not available right now" stays muted.
- Change 3: `option_row` fills the named option's pill (see the first round 2 line).
- Change 4: `option_row` sets the price at the row size: Plex Mono 16 (phone 18), 600 lab, 700 pixel, as `rank_rows`.
- Change 5: `columns` defaults to gap 20, the site's one side by side gap; deal.py still passes `gap=28` three times.
- Change 6: `footnotes(noun="options")` prints "Numbers match the list above; options without a code are left out."; deal.py still passes its own `SKIPPED` note.

## Requests from the Deal page (round 3)

- `price_size(theme, phone, deal_page=True)`: the buy box's price to pay (lab 44, phone 36; pixel 28, phone 22), so the Deal page caps its lead tile from common as Find a deal does, because deal.py keeps these four numbers in its own `BUY_PRICE` beside `price_block`'s and the two can drift.
- `body_text(theme, paragraphs)`: paragraphs in the body type (lab Plex Sans 15/1.5, pixel Plex Mono 14/1.6), for the deal's terms under "About this deal", because LANGUAGE.md names the body role but common.py has no helper for plain paragraphs (deal.py draws them in `terms`).
