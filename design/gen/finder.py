"""The Find a deal boards of loop 5: the sentence picker, the tiles, nine result cards with their promo lines, both empty cases.

Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
Module:  design/gen/finder.py
Deps:    design/gen/common.py (every part); the data shape is FinderPageProps and DealCard in src/contracts
Tested:  python3 design/gen/build.py finder, then node design/gen/shots.js finder

The sample is the live answer to "massage" in Chicago, IL under $150.00 on 2026-09-30, trimmed to the
nine deals that answer it. Three promo codes were dropped so the board shows cards without a promo line;
every sentence that remains is the live PromoNote.instruction verbatim. Money is written as formatMoney
prints it. Round 3 builds every part from common.py with no patch of its output: the whole card is the
link, the lead tile is capped at the card price, the list is scoped to one city so no card repeats it,
and the Promo codes tile counts exactly the promo lines.
"""
from statistics import median

import common as c

PAGE = "Finder"
ACTIVE = "finder"
NBSP = " "

EYEBROW = "Product 3 · Agent shopping tool"
TITLE = "Find a deal"
# Two sentences at most (LANGUAGE.md section 6); the promo line under a card already shows where a promo code goes.
LEAD = ("Search Groupon deals in plain words, the way an agent asks over HTTP, MCP or the command line. "
        "Every card shows the price you pay at Groupon checkout and what you save.")

QUERY = {"what": "massage", "city": "Chicago, IL", "category": "Beauty & Spas", "under": "$150.00"}
CITY_DEALS = "809"
# A list scoped to one city names it in its head, not on every card; "anywhere" spans cities, so its cards carry one.
SPANS_CITIES = QUERY["city"] == "anywhere"

# (title, option, pay minor, original minor, promo sentence or None). Order is relevance.
DEALS = [
    ("Up to 38% Off on Couples Massage at Elite Massage | Foot & Head Spa",
     "50-Minutes Custom Combo Massage with Hot Stone Treatment", 7500, 12000,
     "Type code RELAX at Groupon checkout to pay $60.00. Without it you pay $75.00."),
    ("Unwind at Glory Spa Chicago: 60 or 90-Minute Couples Massages with Soothing Aromatherapy and Hot Stones",
     "60-Minute Couples Full Body Massage with Aromatherapy", 13500, 19400,
     "Type code RELAX at Groupon checkout to pay $108.00. Without it you pay $135.00."),
    ("Discover Ultimate Relaxation W/ a Choice of a 90-min Deep Tissue Massage or Hot Stone Massage - Up to 31% Off",
     "One 90 Minute Deep Tissue Massage", 14900, 20000, None),
    ("Relax With a 60-, 70-, or 90-Minute Scalp Massage Treatment at Massage House (Up to 23% Off)",
     "60-Minute Scalp Massage with Hydration Base Ginger Qi or Camellia Season", 8500, 9800,
     "Type code RELAX at Groupon checkout to pay $68.00. Without it you pay $85.00."),
    ("Discover Armitage Massage & Chiropractic's tailored massage and chiropractic services, with savings up to 32%",
     "60-Minute Massage: Deep-Tissue, Swedish, Hot-Stone, Reflexology, or Cupping", 6599, 8000,
     "Type code RELAX at Groupon checkout to pay $60.05. Without it you pay $65.99."),
    ("60-minute Tailored Deep-Tissue or Swedish Massage with Couples Option at Pure Serenity Spa (Up to 37% Off)",
     "One 60-Minute Deep-Tissue or Swedish Massage with Free Hot Stones and Pure Massage Oil", 9400, 13000, None),
    ("Get 60 Minute Massage, Facial, or Massage with Facial and Wine - Up to 38% Off at Mirror Mirror Spa Salon",
     "60 Minute Massage", 7900, 12000,
     "Type code RELAX at Groupon checkout to pay $63.20. Without it you pay $79.00."),
    ("Up to 30% Off on Swedish Massage at Ravenswood Health and Wellness Center",
     "One 60-minute Swedish or Deep-Tissue Massage", 7000, 10000,
     "Type code RELAX at Groupon checkout to pay $56.00. Without it you pay $70.00."),
    ("Up to 30% Off on Full Body Massage at Tonyz Massage Therapy",
     "30 Minutes: Full Body Deep Tissue Massage", 7700, 11000, None),
]

# The shared refresh note, in the words every section head of the site uses.
REFRESH = "Refreshes every 3 hours"
FOOT = ("Prices refresh every 3 hours; the next delta sync runs at 00:00 UTC. The city list and the category "
        "tags refresh daily at 00:30 UTC.")


def money(minor):
    """formatMoney for USD: $1,238.00."""
    return f"${minor // 100:,}.{minor % 100:02d}"


def pct_text(share):
    return f"{share * 100:.1f}{NBSP}%"


def cards():
    """The nine DealCards in the shape deal_card() draws; sentence is the promo, drawn as the line under the card."""
    out = []
    for i, (title, option, pay, original, promo) in enumerate(DEALS, start=1):
        save = original - pay
        d = {
            "title": title, "option": option,
            "pay": money(pay), "original": money(original), "save": money(save),
            "pct": pct_text(save / original), "promo": i if promo else None, "letter": c.monogram(title),
            "share": save / original, "save_minor": save, "pay_minor": pay, "sentence": promo,
        }
        if SPANS_CITIES:
            d["city"] = QUERY["city"]
        out.append(d)
    return out


def tile_items(deals):
    """Figures from DealCard fields only: listPriceMinor, payMinor and promo.

    The Promo codes tile counts the cards that carry a promo line, so the tile and the lines always agree.
    """
    biggest = max(deals, key=lambda d: d["save_minor"])
    cheapest = min(deals, key=lambda d: d["pay_minor"])
    typical = median(d["share"] for d in deals)
    marked = sum(1 for d in deals if d["promo"])
    n = len(deals)
    return [
        {"label": "Biggest saving", "value": biggest["save"], "hint": biggest["title"]},
        {"label": "Typical saving", "value": pct_text(typical), "hint": f"median of the {n}"},
        {"label": "Cheapest", "value": cheapest["pay"], "hint": cheapest["title"]},
        {"label": "Promo codes", "value": f"{marked} of {n}", "hint": "typed at Groupon checkout, under the deal"},
    ]


def picker_note(theme):
    """What the lists hold; the category is named once more, in the results note under the search."""
    return c.raw(
        f'{c.strong(theme, QUERY["city"])} holds {c.strong(theme, CITY_DEALS)} listable deals. '
        f"The lists offer the 50 cities with the most deals and Groupon's top categories.")


# The sentence breaks after City, so the first line has room: What takes it, and a typed query of four
# words ("hot stone couples massage", the empty state's own example) shows whole in both looks.
WHAT_WIDTH = 400


def picker(theme, phone):
    """Find [What] in [City] / for [Category] under [Price] Search: four slots break after City in both looks."""
    parts = [
        ("word", "Find"), ("text", "What", QUERY["what"], "massage, oil change, bowling", WHAT_WIDTH),
        ("word", "in"), ("select", "City", QUERY["city"]), ("break",),
        ("word", "for"), ("select", "Category", QUERY["category"]),
        ("word", "under"), ("select", "Price", QUERY["under"]),
    ]
    return c.picker(theme, parts, "Search", note=picker_note(theme), phone=phone, action="/find")


def results_title(n):
    return f'{n} deals for "{QUERY["what"]}" in {QUERY["city"]}'


def results_note():
    return f"In {QUERY['category']}, under {QUERY['under']}. Ordered by relevance, the closest match first."


def empties(theme, phone):
    """The two drawn states: a search that finds nothing, and the page before the first catalogue load."""
    none_found = c.empty_state(
        theme, "When nothing matches",
        f'No deals for "hot stone couples massage" in {QUERY["city"]} under $50.00. '
        "Fewer words, anywhere or any price finds more.",
        link=('Search "massage" anywhere, any price', "#"), phone=phone, fill=not phone)
    not_loaded = c.empty_state(
        theme, "Before the first catalogue load",
        "No deals are loaded yet. The full load runs Mondays at 05:00 UTC, and a delta sync every 3 hours.",
        link=("Search again after the Monday load", "#"), phone=phone, fill=not phone)
    if phone:
        return c.stack([none_found, not_loaded], gap=20)
    return c.columns([none_found, not_loaded], "repeat(2, minmax(0, 1fr))", stretch=True)


def body(theme, phone=False):
    deals = cards()
    # The two cards a tile names carry that tile's label in their filled save pill.
    max(deals, key=lambda d: d["save_minor"])["label"] = "Biggest saving"
    min(deals, key=lambda d: d["pay_minor"])["label"] = "Cheapest"
    grid = c.deal_grid(theme, deals, phone=phone, href=c.board_href("Deal", theme, phone))
    results = c.section(
        theme, results_title(len(deals)), grid,
        note=results_note(), refresh=REFRESH, phone=phone)
    # No podium on this page, so the lead tile is capped at the cards' own price to pay.
    cap = c.price_size(theme, phone, compact=phone)
    content = "".join([
        c.hero(theme, EYEBROW, TITLE, LEAD, phone=phone),
        picker(theme, phone),
        c.tiles(theme, tile_items(deals), phone=phone, cap=cap),
        results,
        empties(theme, phone),
        c.foot(theme, FOOT, phone=phone),
    ])
    return c.header(theme, ACTIVE, phone=phone, page=PAGE) + c.main(theme, content, phone=phone)


# Heights are what the content needs, measured by shots.js (contentHeight) and set here.
HEIGHTS = {"Finder": 2488, "FinderPixel": 2605, "FinderPhone": 4525, "FinderPixelPhone": 4879}


def boards():
    out = {}
    for theme in ("lab", "pixel"):
        for phone in (False, True):
            name = c.board_name(PAGE, theme, phone)
            width = 390 if phone else 1280
            height = HEIGHTS[name]
            look = "pixel" if theme == "pixel" else "lab"
            title = f"Find a deal, {look} look{', phone' if phone else ''}"
            html = c.page(theme, title, width, height, body(theme, phone))
            out[name] = (html, width, height, f"Find a deal, {look}{' phone' if phone else ''}")
    return out
