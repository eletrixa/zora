"""The Top deals boards (the home page): lab and pixel, desktop and phone, built from the shared parts.

Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
Module:  design/gen/top_deals.py
Deps:    design/gen/common.py; the data shape of TopDealsReport in src/contracts/reports.ts
Tested:  python3 design/gen/build.py top_deals, then node design/gen/shots.js top_deals

The sample rows are the live page's top 20 for New York, NY and Things To Do on 2026-09-30, sorted by
the amount saved. Money is kept in minor units and printed the way formatMoney prints it. Every part comes
from common.py: the page stacks hero, picker, tiles, results, the drawn states and the foot. Round 3 gives
every picker slot a word ("in", "for", "within"), so the phone reads the sentence straight down.
"""
import common as c

# The brief pins the eyebrow word for word; LANGUAGE.md section 6 quotes it the same way.
EYEBROW = "Product 4 · an AI Builder showcase"
# Two sentences, as LANGUAGE.md asks of a lead; the promo line under a deal already says where a code lives.
LEAD = ("The 20 Groupon deals that save the most in one city and one category, by amount or by percent. "
        "Saving means the original price minus the price you pay at Groupon checkout, before any sales tax.")
PLACE, CATEGORY, TAG = "New York, NY", "Things To Do", "any tag"
# The third slot's label names its list, since the word "within" before it now carries the sentence.
TAG_LABEL = "Tag"
CITY_DEALS, CATEGORY_DEALS = "1,599", "244"
# Short enough that the refresh note joins it on one line in both looks, so no " ·" hangs at a line end.
ORDER_NOTE = "Ordered by the amount you save, largest first; one row per deal."
REFRESH = "Refreshes every 3 hours"
SORTS = ["By amount saved", "By percent saved"]
# Prices lead, as on every page; the walk's moment agrees with the 00:30 UTC schedule and the board's clock (23:23 UTC).
FOOT = c.raw("Prices refresh every 3 hours; the next delta sync runs at 00:00 UTC. The city list and the category tags "
             f"refresh daily at 00:30 UTC; the last walk ended {c.moment('22 hours ago', '2026-09-30T00:41:37Z')}.")

# (rank, title, option, original minor, pay minor, promo instruction verbatim or None)
ROWS = [
    (1, "Unlimited All-Day Hop-On Hop-Off Bus Tour – Explore New York at Your Pace",
     "NYC Hop-On Hop-Off Unlimited Day Pass – Hop On for Adventure, Hop Off for Memories 10", 99000, 39600,
     "Type code FALL at Groupon checkout to pay $376.20. Without it you pay $396.00."),
    (2, "2-Hour Guided Highlights Tour of The Metropolitan Museum of Art for 1-4 People from Yang Visuals - Up to 66% Off",
     "Two Hour Guided Highlights Tour for Four Adults", 79600, 27000,
     "Type code FALL at Groupon checkout to pay $216.00. Without it you pay $270.00."),
    (3, "Explore New York Iconic Sightseeing Tours with Iconic Express Boat and Express Bus tours (Up to 50% Off)",
     "Statue of Liberty Boat Tour & NYC Sightseeing Express Bus Tour for Ten", 99900, 49950,
     "Type code FALL at Groupon checkout to pay $399.60. Without it you pay $499.50."),
    (4, "Professional Sound Stage and White Cyc Rentals in Lower Manhattan (Up to 25% Off)",
     "12-hour Sound Stage and White Cyc Rental", 186000, 140000,
     "Type code FALL at Groupon checkout to pay $1,120.00. Without it you pay $1,400.00."),
    (5, "Explore Iconic New York Flavors on a Guided West Village Food Tour",
     "West Village Food Tour of New York for 12", 108000, 64800,
     "Type code FALL at Groupon checkout to pay $518.40. Without it you pay $648.00."),
    (6, "Express City Tour: See NYC's Most Famous Landmarks, Times Square, Wall Street, 5th Avenue, SOHO & More in 75 Minutes",
     "Express City Tour: NYC's Most Famous Landmarks, Times Square, Wall Street, 5th Avenue, SoHo & More in 75-Minutes for 10",
     69000, 31050, "Type code FALL at Groupon checkout to pay $248.40. Without it you pay $310.50."),
    (7, "Join City Best Dance for private and group classes with up to 76% off, featuring an exciting night club performance.",
     "Two Private and Two Group Classes for Two with Night Club Performance/Dance Party", 49900, 12500,
     "Type code FALL at Groupon checkout to pay $87.59. Without it you pay $125.00."),
    (8, "Master the Art of Thai Fruit Carving in New York with Expert-Led Classes",
     "Fruit Carving Class for Ten", 100000, 67500,
     "Type code FALL at Groupon checkout to pay $540.00. Without it you pay $675.00."),
    (9, "Thai Cooking Class and Meal for 2, 4, 6, 8, or 10 People – Learn Authentic Cuisine in NYC",
     "Thai Cooking Class – For 10", 100000, 67500,
     "Type code FALL at Groupon checkout to pay $540.00. Without it you pay $675.00."),
    (10, "Experience City Best Dance's ballroom lessons for individuals, couples, or groups with up to 83% off in a vibrant setting",
     "Ballroom dance lesson for group of four", 39900, 7613,
     "Type code FALL at Groupon checkout to pay $60.90. Without it you pay $76.13."),
    (11, "Elevate Your Journey with 4-Hour Luxury Private Tour for Up to 9 with Black Tie Technology Inc",
     "Tour for 9 passengers with Four Hours Trip", 70000, 37800,
     "Type code FALL at Groupon checkout to pay $302.40. Without it you pay $378.00."),
    (12, "Explore Downtown NYC with Hop-On Hop-Off Bus Tour Flexible Schedule, Unlimited Stops & Scenic Views NO BOOKING REQUIRED",
     "Hop-on-Hop-off NYC Bus Tour Unlimited One Day Pass - For 10", 69000, 37950,
     "Type code FALL at Groupon checkout to pay $303.60. Without it you pay $379.50."),
    (13, "Discover Festive NYC: 2-Hour Guided Christmas Cupcake and Holiday Lights Tour with Delicious Tastings",
     "For 8: New York Christmas Cupcake and Holiday Lights Tour", 76000, 45600,
     "Type code FALL at Groupon checkout to pay $364.80. Without it you pay $456.00."),
    (14, "Discover the Magic of NYC with 75-Minute NYC Sightseeing Double Decker Bus for 1, 2, 5 or 10 (Up to 52% Off)",
     "Night Bus Tour; 75-Minute Sightseeing Bus for Ten", 54500, 26160,
     "Type code FALL at Groupon checkout to pay $209.28. Without it you pay $261.60."),
    (15, "Experience NYC's Illuminated Majesty: Explore Manhattan, Downtown & Brooklyn on an Open-Deck Night Tour",
     "NYC Night Tour: Explore Manhattan, Downtown & Brooklyn's Iconic Lights, Landmarks & Skyline Views After Dark For Ten",
     59000, 34500, "Type code FALL at Groupon checkout to pay $276.00. Without it you pay $345.00."),
    (16, "Spark Your Child's Creativity with Immersive Acting Camp for Kids at Children's Acting Academy",
     "One Week of Acting Camp!", 59500, 35000,
     "Type code FALL at Groupon checkout to pay $280.00. Without it you pay $350.00."),
    (17, "Luxurious Bus Tour with Black Tie Technology for Groups of 12-14",
     "Luxurious Tour for 12 People (4 Hours Minimum)", 80000, 56000,
     "Type code FALL at Groupon checkout to pay $448.00. Without it you pay $560.00."),
    (18, "Explore Iconic NYC: Statue of Liberty & Ellis Island Tours with Guided or Self-Paced Options",
     "Statue of Liberty Fully-Escorted Walking Tour with Guide - For 4 People", 51996, 29500,
     "Type code FALL at Groupon checkout to pay $236.00. Without it you pay $295.00."),
    (19, "Discover Italian delights (New York), offering tours for up to 30% off in New York's Little Italy",
     "Two-Hour Italian Food Tour of New York for Eight", 72000, 50400,
     "Type code FALL at Groupon checkout to pay $403.20. Without it you pay $504.00."),
    (20, "ROYAL at Princes Playhouse: Experience New York's Groundbreaking Male Revue with Seating & Champagne (Up To 43% Off)",
     "Bottle Table For 4", 60000, 39000,
     "Type code FALL at Groupon checkout to pay $312.00. Without it you pay $390.00."),
]

NBSP = "\u00a0"


def money(minor):
    """formatMoney(minor, "USD", 2): "$1,238.00"."""
    whole, cents = divmod(minor, 100)
    return f"${whole:,}.{cents:02d}"


def pct_text(share):
    return f"{share * 100:.1f}{NBSP}%"


def deals():
    """The rows as the helpers want them: text for money and percent, the share for the bar."""
    out = []
    for rank, title, option, original, pay, promo in ROWS:
        save = original - pay
        share = save / original
        out.append({
            "rank": rank, "title": title, "option": option, "original": money(original), "pay": money(pay),
            "save": money(save), "pct": round(share * 100, 1), "pct_text": pct_text(share), "share": share,
            "save_minor": save, "promo": rank if promo else None, "instruction": promo,
        })
    return out


def tile_items(rows):
    """The four tiles, computed from the rows the way src/ui/pages/top-deals.tsx computes them."""
    biggest = max(rows, key=lambda r: r["save_minor"])
    shares = sorted(r["share"] for r in rows)
    mid = len(shares) // 2
    median = (shares[mid - 1] + shares[mid]) / 2 if len(shares) % 2 == 0 else shares[mid]
    total = sum(r["save_minor"] for r in rows)
    with_promo = sum(1 for r in rows if r["promo"])
    n = len(rows)
    return [
        {"label": "Biggest saving", "value": biggest["save"], "hint": biggest["title"]},
        {"label": "Typical saving", "value": pct_text(median), "hint": f"median of the top {n}"},
        {"label": "Total saving", "value": money(total), "hint": "buying one of each"},
        {"label": "Promo codes", "value": f"{with_promo} of {n}", "hint": "typed at Groupon checkout, under the deal"},
    ]


def picker_note(theme):
    """What the lists hold, with the city and the counts in ink, as Find a deal writes it; one clause says what a tag is."""
    return c.raw(
        f"{c.strong(theme, PLACE)} holds {c.strong(theme, CITY_DEALS)} listable deals, {c.strong(theme, CATEGORY_DEALS)} "
        f"of them in {c.esc(CATEGORY)}. A tag narrows the category to one of Groupon's own deal tags, such as Food Tours. "
        "The lists offer the 50 cities with the most deals and Groupon's top categories.")


def empties(theme, phone):
    """The two states the live page draws in place of the list, small and side by side under the content.

    Both carry a next step on this page. Before the first walk the live page draws no picker, and the walk
    covers every city at once, so the step is the time the list appears, as Find a deal words its own.
    """
    none_found = c.empty_state(
        theme, "When nothing matches",
        "No discounted deals in Miami, FL for Escape Games.",
        # empty_state keeps a link whole, so a narrow column never strands "To Do".
        link=("Try the whole of Things To Do", "#"),
        phone=phone, fill=not phone)
    no_walk = c.empty_state(
        theme, "Before the first category walk",
        "Categories appear after the first category walk, tonight at 00:30 UTC.",
        link=("Show the top 20 after the walk", "#"),
        phone=phone, fill=not phone)
    if phone:
        return c.stack([none_found, no_walk], gap=16)
    return c.columns([none_found, no_walk], "repeat(2, minmax(0, 1fr))", gap=20, stretch=True)


def body(theme, phone=False):
    rows = deals()
    top, rest = rows[:3], rows[3:]
    tiles = tile_items(rows)
    ranked = [{"rank": r["rank"], "title": r["title"], "option": r["option"], "original": r["original"],
               "pay": r["pay"], "save": r["save"], "pct": r["pct"], "sentence": r["instruction"]} for r in rest]
    podium_rows = [{"title": r["title"], "option": r["option"], "pay": r["pay"], "original": r["original"],
                    "save": r["save"], "pct": r["pct_text"], "sentence": r["instruction"]} for r in top]
    # The lead tile names the winner (ordered by amount, rank 1 is the biggest saving), so its label leads the winner's pill.
    if top and top[0]["save_minor"] == max(r["save_minor"] for r in rows):
        podium_rows[0]["label"] = tiles[0]["label"]

    picker = c.picker(theme, [
        # "Top 20 deals" and "in" are two words, so the phone pairs "in" with City; the desktop joins them.
        ("word", "Top 20 deals"), ("word", "in"), ("select", "City", PLACE), ("word", "for"),
        ("select", "Category", CATEGORY), ("word", "within"), ("select", TAG_LABEL, TAG),
    ], "Show", note=picker_note(theme), phone=phone, action="/")
    ranks_title = f"Ranks 4 to {len(rows)}"
    inner = c.podium(theme, podium_rows, phone=phone) + c.rank_rows(theme, ranked, phone=phone, title=ranks_title)
    results = c.section(theme, f"Top {len(rows)} in {PLACE}: {CATEGORY}", inner, note=ORDER_NOTE, refresh=REFRESH,
                        aside=c.sort_toggle(theme, SORTS, 0, phone=phone), phone=phone)
    content = "".join([
        c.hero(theme, EYEBROW, "Top deals", LEAD, phone=phone),
        picker,
        c.tiles(theme, tiles, lead=True, phone=phone),
        results,
        empties(theme, phone),
        c.foot(theme, FOOT, phone=phone),
    ])
    return c.header(theme, "top-deals", phone=phone) + c.main(theme, content, phone=phone)


# Heights measured with design/gen/shots.js (contentHeight), so every board ends where its content ends.
HEIGHTS = {"TopDeals": 3501, "TopDealsPixel": 3715, "TopDealsPhone": 6015, "TopDealsPixelPhone": 6479}
TITLES = {
    "TopDeals": "Top deals, the home page, lab look",
    "TopDealsPixel": "Top deals, the home page, pixel look",
    "TopDealsPhone": "Top deals, the home page, lab look, phone",
    "TopDealsPixelPhone": "Top deals, the home page, pixel look, phone",
}


def boards():
    out = {}
    for theme in ("lab", "pixel"):
        for phone in (False, True):
            name = c.board_name("TopDeals", theme, phone)
            width = 390 if phone else 1280
            height = HEIGHTS[name]
            html = c.page(theme, TITLES[name], width, height, body(theme, phone))
            out[name] = (html, width, height, TITLES[name])
    return out
