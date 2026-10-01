"""The Deal page boards (/deals/:id): one deal with its buy box, tiles, options, locations, terms and price history, in both looks.

Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
Module:  design/gen/deal.py
Deps:    design/gen/common.py; the data shapes DealDetail, DealOption, PromoNote, StoredLocation and PriceChangeRow in src/contracts/ports.ts
Tested:  python3 design/gen/build.py deal, then node design/gen/shots.js deal

The sample deal is rank 2 of the Top deals board (the guided tour of The Met in New York, NY), with its
live title of 116 characters, so the boards show what a real long title does to the h1 (r1-deal change
1). Top deals ranked it by its biggest saving, the tour for four adults; the deal's own price
(DealCard.payText) is its cheapest sellable option, and the buy box sells that one. The lead tile names
the four adult option and points below to it, and that option's row carries the filled save pill led by
the tile's label, the rule deal cards follow wherever a tile names one (common.option_row reads it).
Round 3 (r2-deal.md): the Options note is true of every row, the side by side rows take the site's gap
20, each option's promo is one line under its title (no footnote list), and the history dates are figures.
The lead tile is capped at the buy box's price to pay, so the pixel saving never outsizes that price.
"""
import common as c

NBSP = "\u00a0"


def pct(value):
    return f"{value:.1f}{NBSP}%"


# ------------------------------------------------------------------------------------ sample data

TITLE = ("2-Hour Guided Highlights Tour of The Metropolitan Museum of Art for 1-4 People "
         "from Yang Visuals - Up to 66% Off")
CATEGORY = "Things To Do"
LABEL = "Tours"
CITY = "New York, NY"

DEAL = {
    "title": TITLE,
    # The path above names the category and the label, so the eyebrow keeps only where the deal is
    # (DealCard.city and state; "Location not listed" when both are null, as the finder says).
    "eyebrow": CITY,
    "lead": ("An art historian walks you through the museum's highlights in two hours: the Egyptian wing, "
             "the European paintings and the Temple of Dendur. Museum admission is included."),
    "letter": c.monogram(TITLE),
    # The deal's price is its cheapest sellable option (DealCard.payText); the buy box acts on that option.
    "option": "Two Hour Guided Highlights Tour for One Adult",
    "pay": "$79.00", "original": "$199.00", "save": "$120.00", "pct": pct(60.3),
    "promo": "Type code FALL at Groupon checkout to pay $63.20. Without it you pay $79.00.",
}

# Ordered by the price you pay. `sentence` is the option's promo, drawn as the line under its title;
# the option that cannot be sold carries no code.
OPTIONS = [
    {"title": "Two Hour Guided Highlights Tour for One Adult", "pay": "$79.00", "original": "$199.00",
     "save": "$120.00", "pct": pct(60.3), "sellable": True, "sentence": "Type code FALL at Groupon checkout to pay $63.20. Without it you pay $79.00.", "note": "In the box above"},
    {"title": "Two Hour Guided Highlights Tour for Two Adults", "pay": "$145.00", "original": "$398.00",
     "save": "$253.00", "pct": pct(63.6), "sellable": True, "sentence": "Type code FALL at Groupon checkout to pay $116.00. Without it you pay $145.00."},
    {"title": "Two Hour Guided Highlights Tour for Three Adults", "pay": "$210.00", "original": "$597.00",
     "save": "$387.00", "pct": pct(64.8), "sellable": False},
    {"title": "Two Hour Guided Highlights Tour for Four Adults", "pay": "$270.00", "original": "$796.00",
     "save": "$526.00", "pct": pct(66.1), "sellable": True, "sentence": "Type code FALL at Groupon checkout to pay $216.00. Without it you pay $270.00.", "label": "Biggest saving"},
]

# The biggest saving counts only options a shopper can buy now; the tile names its option in full,
# as the Top deals and Find a deal tiles name their deal, and says where it is, since the buy box right
# above it sells a different option (r2-deal change 8).
TILES = [
    {"label": "Biggest saving", "value": "$526.00", "hint": f"{OPTIONS[3]['title']}, in{NBSP}Options{NBSP}below"},
    {"label": "Options", "value": "4", "hint": f"3 on sale now, 1{NBSP}not{NBSP}available"},
    {"label": "Promo codes", "value": "3 of 4", "hint": "typed at Groupon checkout, under the option"},
    {"label": "Price changes", "value": "3", "hint": "in 30 days; the last on 28 Sep"},
]

LOCATIONS = [
    ("Yang Visuals at The Met Fifth Avenue", "1000 5th Ave, New York, NY 10028"),
    ("Yang Visuals at The Met Cloisters", "99 Margaret Corbin Dr, New York, NY 10040"),
]

ABOUT = [
    "Meet your guide on the museum's front steps 10 minutes before the start. Tours start daily at 10:30 and 14:00.",
    "Book online at least 48 hours ahead. Museum admission is included for every adult on the voucher.",
    "Valid for 90 days after purchase. Limit 1 per person, may buy 1 more as a gift. Not valid on days the museum is closed.",
]

# Only "You pay" and "Original" changes are drawn: a promo change as a figure would be a promo price outside its sentence.
# The option leads the row and the figures (the day seen, from, to) sit right aligned, as Scorecard's
# Contract drift table sets them: a date in a table is "2026-09-28" in a figure column (r2-deal change 7).
HISTORY_HEAD = ["Option", "What changed", "Seen", "From", "To"]
HISTORY = [
    ["Two Hour Guided Highlights Tour for Four Adults", "You pay", "2026-09-28", "$296.00", "$270.00"],
    ["Two Hour Guided Highlights Tour for One Adult", "Original", "2026-09-21", "$189.00", "$199.00"],
    ["Two Hour Guided Highlights Tour for Three Adults", "You pay", "2026-09-14", "$219.00", "$210.00"],
]

# The buy box's price to pay, as common.price_block sets it (lab 44, phone 36; pixel Press Start 2P 28,
# phone 22). It is the page's biggest price to pay, so the lead tile is capped at it (LANGUAGE.md,
# binding rules): the pixel lead would otherwise be 32 (phone 24), over the 28 (22) price it sits under.
BUY_PRICE = {("lab", False): 44, ("lab", True): 36, ("pixel", False): 28, ("pixel", True): 22}

REFRESH = "Refreshes every 3 hours"
FOOT = f"Prices refresh every 3 hours; the next delta sync runs at {c.CLOCK['next_delta']}."


# ------------------------------------------------------------------------ parts of this page


def terms(theme, paragraphs):
    """The deal's description as Groupon lists it, in the look's body type."""
    t = c.look(theme)
    font = (f"font-family: {c.MONO}; font-size: 14px; line-height: 1.6" if c.is_px(theme)
            else f"font-family: {c.SANS}; font-size: 15px; line-height: 1.55")
    ps = "".join(f'<p style="margin: 0">{c.esc(p)}</p>' for p in paragraphs)
    return f'<div style="{font}; color: {t["ink"]}; display: flex; flex-direction: column; gap: 10px">{ps}</div>'


# ------------------------------------------------------------------------------------- the board


def body(theme, phone=False):
    finder = c.board_href("Finder", theme, phone)
    path = [("Find a deal", finder), (CATEGORY, finder), (LABEL, finder)]
    # The h1 right under it names the deal, so the path stops at the label on both widths: a live
    # title (116 characters here) repeated in the path wraps in pixel and doubles the longest string.
    crumbs = c.breadcrumb(theme, path, phone)
    hero = c.hero(theme, DEAL["eyebrow"], TITLE, DEAL["lead"], phone)
    head = f'<div style="display: flex; flex-direction: column; gap: {4 if phone else 8}px">{crumbs}{hero}</div>'

    box = c.buy_box(theme, DEAL["option"], DEAL["pay"], DEAL["original"], DEAL["save"], DEAL["pct"], DEAL["promo"],
                    href="Checkout.dc.html", more=(f"See all {len(OPTIONS)} options", "#options"), phone=phone)
    if phone:
        # A live title runs to 7 lines of the pixel h1 at 390, so the photo follows the buy box and the
        # price to pay stays on the first screen (r1-deal change 1). The desktop keeps the photo beside it.
        buy = c.stack([box, c.photo_frame(theme, DEAL["letter"], 150, True)], gap=14)
    else:
        buy = c.columns([c.photo_frame(theme, DEAL["letter"], 360), box], "minmax(0, 1.25fr) minmax(0, 1fr)")

    # The tiles row follows the page's answer (the buy box) and comes before the first section.
    figures = c.tiles(theme, TILES, lead=True, display_lead=False, phone=phone, cap=BUY_PRICE[(theme, phone)])

    rows = c.option_list(theme, OPTIONS, phone=phone, kind="secondary", href="Checkout.dc.html")
    # True of every row, the first included: it has no button, because the buy box above sells it (r2-deal change 1).
    options = c.section(theme, "Options", rows, note="Ordered by the price you pay; the cheapest is in the box above.",
                        refresh=REFRESH, phone=phone, anchor="options")

    where = c.section(theme, "Locations", c.card(theme, c.location_list(theme, LOCATIONS), phone=phone),
                      note="Where the voucher is redeemed.", phone=phone, fill=not phone)
    about = c.section(theme, "About this deal", c.card(theme, terms(theme, ABOUT), phone=phone),
                      note="Terms as Groupon lists them.", phone=phone, fill=not phone, anchor="about")
    if phone:
        detail = c.stack([where, about], gap=20)
    else:
        detail = c.columns([where, about], "minmax(0, 1fr) minmax(0, 1.5fr)", stretch=True)

    table = c.data_table(theme, HISTORY_HEAD, HISTORY, numeric=(2, 3, 4), phone=phone, last_rule=False, grow=0)
    history = c.section(theme, "Price history", c.card(theme, table, phone=phone, pad="4px 16px" if phone else "12px 24px 8px"),
                        note="Every change the delta sync saw on this deal, newest first.", refresh=REFRESH, phone=phone)

    empties = [
        c.empty_state(theme, "When no price has changed yet",
                      "No price change seen yet. The delta sync looks every 3 hours; changes appear here.",
                      ("Compare the options", "#options"), phone, fill=not phone),
        c.empty_state(theme, "When a deal has no listed location",
                      "This deal has no listed location; it is redeemed online or by the merchant's own arrangement.",
                      ("Read the terms", "#about"), phone, fill=not phone),
    ]
    # Two states side by side each take half the row and end on one line (LANGUAGE.md, empty state).
    empty = c.stack(empties, gap=16) if phone else c.columns(empties, "repeat(2, minmax(0, 1fr))", stretch=True)

    content = "".join([head, buy, figures, options, detail, history, empty, c.foot(theme, FOOT, phone)])
    return c.header(theme, "deal", phone, page="Deal") + c.main(theme, content, phone)


SIZES = {
    ("lab", False): 2521,
    ("pixel", False): 2555,
    ("lab", True): 4254,
    ("pixel", True): 4479,
}


def boards():
    out = {}
    for theme in ("lab", "pixel"):
        for phone in (False, True):
            name = c.board_name("Deal", theme, phone)
            width = 390 if phone else 1280
            height = SIZES[(theme, phone)]
            title = f"Deal page, {'phone, ' if phone else ''}{theme}"
            html = c.page(theme, f"Deal page, {theme} look{', phone' if phone else ''}", width, height, body(theme, phone))
            out[name] = (html, width, height, title)
    return out
