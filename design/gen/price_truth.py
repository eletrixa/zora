"""The Price truth boards: today's verdict, the tiles, then cart, groupon.com, promo gap and freshness, in both looks.

Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
Module:  design/gen/price_truth.py
Deps:    design/gen/common.py; the data shape is PriceTruthReport in src/contracts/reports.ts
Tested:  python3 design/gen/build.py price_truth, then node design/gen/shots.js price_truth

Sample data follows the live page of 2026-09-30 (154,038 sellable options, 94.0 % with a promo code,
20 of 20 carts, 59 of 59 listing pages) and the schedule in wrangler.jsonc. Every board is read at the
one sample moment in common.CLOCK (30 Sep, 23:23 UTC), so today's price changes cover 8 delta syncs.
The largest gaps show only the price you pay and the gap; the promo price lives only in the promo line
sentence, per AGENTS.md rule 2. Round 3 draws every part from common.py; the page adds only its data.
"""
import common as c

NBSP = " "
CLOCK = c.CLOCK


def pct(value):
    """43.6 % with the non-breaking space the language asks for."""
    return f"{value:.1f}{NBSP}%"


def of(part, whole):
    """"2 of 1,599" kept on one line, so a count never breaks across a wrap."""
    return f"{part}{NBSP}of{NBSP}{whole}"


def utc(clock_time):
    """"04:30 UTC" with the space kept, so a time never breaks from its zone."""
    return clock_time.replace(" ", NBSP)


# ------------------------------------------------------------------------------------ sample data

DAYS = [f"{d} Sep" for d in range(1, 31)]
TODAY = CLOCK["today"]

# Catalogue against cart: no sample on 8 Sep (the job did not run), one mismatch on 19 Sep.
CART_DAYS = ["pass"] * 30
CART_DAYS[7] = "none"
CART_DAYS[18] = "fail"
CART_SAMPLED = 20 * (CART_DAYS.count("pass") + CART_DAYS.count("fail"))
CART_MISMATCH = 1
LAST_CART_MISMATCH = "19 Sep"

# API against groupon.com: the collector skipped 5, 6 and 13 Sep; on 22 Sep two pages showed the promo price.
PAGE_DAYS = ["pass"] * 30
for i in (4, 5, 12):
    PAGE_DAYS[i] = "none"
PAGE_DAYS[21] = "fail"
PAGES_PER_DAY = [58, 60, 57, 59, 0, 0, 61, 58, 62, 57, 60, 59, 0, 58, 61, 57, 60, 59, 62, 58, 60, 61, 57, 59, 60, 58, 61, 60, 58, 59]
PAGES_SEEN = sum(PAGES_PER_DAY)
PAGES_MISMATCH = 2
LAST_PAGE_MISMATCH = "22 Sep"

# The last day any cart or page disagreed (the page mismatch on 22 Sep); the tile counts the days since.
DAYS_SINCE = 30 - 22

# Price changes the delta sync picked up per day. Mondays (7, 14, 21, 28 Sep) run higher: the weekly
# full load lands at 05:00 UTC. Today (a Wednesday) holds all 8 syncs up to 21:00 UTC.
CHANGES = [812, 764, 901, 688, 540, 497, 1046, 873, 790, 835, 702, 566, 512, 1121, 884,
           806, 759, 690, 604, 533, 1284, 912, 845, 798, 731, 588, 521, 1157, 866, 781]

# The promo gap over today's catalogue; the bands sum to the 144,772 options that carry a code.
SELLABLE = 154_038
WITH_CODE = 144_772
BANDS = [("0 to 5", 5142), ("5 to 10", 14248), ("10 to 15", 1716), ("15 to 20", 2211), ("20 to 25", 95570),
         ("25 to 30", 25232), ("30 to 35", 633), ("35 to 40", 3), ("over 40", 17)]
assert sum(n for _, n in BANDS) == WITH_CODE

# WorstGapDeal: title, retail (you pay), promo price (only inside the sentence), gap, code.
WORST = [
    ("12x18 Inch Custom Big Head Cutouts on a Stick from Best Big Heads", "$5.99", "$3.59", 40.1, "FLASHSALE"),
    ("Lifetime Key to Microsoft Office 2024: Professional Plus (Windows) or Standard (Mac)", "$29.99", "$17.99", 40.0, "FLASHSALE"),
    ("Red Wine Gift: Splash Wines 6, 15 or 18 Bottle Cabernet Sauvignon Sampler", "$69.00", "$41.40", 40.0, "FLASHSALE"),
    ("Windows 11 Home, Pro or Enterprise Lifetime Activation Key with Digital Download", "$11.00", "$6.60", 40.0, "FLASHSALE"),
    ("Premium Winter Wine Sampler: Crisp Whites, Bold Reds and Global Favorites, up to 18 Bottles", "$115.31", "$74.95", 35.0, "WINE35"),
    ("Online Microsoft Excel Course from eLearn Excel", "$60.00", "$39.00", 35.0, "EXCEL35"),
    ("White Wine Sampler Pack: 12, 15 or 18 Bottles of Chardonnay, Sauvignon Blanc and More", "$81.46", "$52.95", 35.0, "WINE"),
    ("Catalina Island Self-Guided Audio Tour for Two", "$7.99", "$5.59", 30.0, "FALL"),
]

FOOT = (f"Carts and the promo gap refresh daily at {CLOCK['cart_sample_at']}, groupon.com pages at "
        f"{CLOCK['pages_read_at']}, price changes {CLOCK['delta_every']}; the next delta sync runs at "
        f"{CLOCK['next_delta']}.")


def instruction(code, promo, pay):
    """PromoNote.instruction, the fixed sentence, verbatim in shape."""
    return f"Type code {code} at Groupon checkout to pay {promo}. Without it you pay {pay}."


def figure_pairs(theme, items, phone=False):
    """The section's figures: common's figure row on the desktop, two by two on the phone.

    figure_row wraps where the phone row runs out, so four figures read three and one; a two column
    grid keeps them in pairs, as the tiles and the verdict's rates sit (requests/price_truth.md).
    """
    if not phone:
        return c.figure_row(theme, items)
    figs = "".join(c.figure(theme, label, value, phone=True) for label, value in items)
    return f'<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 24px">{figs}</div>'


def square_titles(days, words):
    """One title per square ("19 Sep: Mismatched"), so each carries its date and outcome."""
    return [f"{d}: {words[s]}" for d, s in zip(DAYS, days)]


# ------------------------------------------------------------------------------------ the board


def content(theme, phone=False):
    s = lambda text: c.strong(theme, text)  # noqa: E731 (a figure inside running text)
    words = {"pass": "Matched", "fail": "Mismatched", "none": "No sample"}
    legend = (("pass", "Matched"), ("fail", "Mismatched"), ("none", "No sample"))
    inner = 14 if phone else 20

    lead_text = c.raw(
        f"Today the price the API quotes is the price the cart charges: {s('20 of 20')} carts. "
        f"groupon.com showed the same price on {s('59 of 59')} listing pages.")
    hero = c.hero(theme, "Product 1 · Price truth monitor", "Price truth", lead_text, phone=phone)

    cart_rate = pct(100 * (CART_SAMPLED - CART_MISMATCH) / CART_SAMPLED)
    page_rate = pct(100 * (PAGES_SEEN - PAGES_MISMATCH) / PAGES_SEEN)
    verdict = c.verdict(
        theme, "pass", "Matched",
        f"No cart and no page disagreed with the API today. In 30 days, "
        f"{of(CART_MISMATCH, CART_SAMPLED)} carts and {of(PAGES_MISMATCH, f'{PAGES_SEEN:,}')} pages did.",
        figures=(("Carts, 30 days", cart_rate), ("Pages, 30 days", page_rate)), phone=phone)

    tiles = c.tiles(theme, [
        {"label": "Carts matched", "value": "20 of 20", "tone": "pass",
         "hint": f"Sampled at {utc(CLOCK['cart_sample_at'])}, every cart abandoned at once"},
        {"label": "Pages matched", "value": "59 of 59", "tone": "pass",
         "hint": f"groupon.com, read at {utc(CLOCK['pages_read_at'])}"},
        # Both dates, in the order the page reads: the pages section is second, but its mismatch is the newer one.
        {"label": "Since a mismatch", "value": f"{DAYS_SINCE} days",
         "hint": f"Pages last on {LAST_PAGE_MISMATCH}, carts on {LAST_CART_MISMATCH}"},
        {"label": "Changes today", "value": f"{CHANGES[-1]:,}",
         "hint": f"{CLOCK['delta_runs_today']} delta syncs so far, the next at {utc(CLOCK['next_delta'])}"},
    ], lead=True, phone=phone)

    cart = c.section(
        theme, "Catalogue against cart",
        c.strip_cards(
            theme, CART_DAYS, DAYS[0], DAYS[-1], legend,
            f"Last 30 days: {CART_SAMPLED - CART_MISMATCH} of {CART_SAMPLED} carts matched",
            f"Last mismatch on {LAST_CART_MISMATCH}: 1 of 20 carts charged a price the API did not quote. "
            "No sample on 8 Sep: the job did not run.",
            f"Latest day: {TODAY}",
            ["Day", "Matched", "Mismatched", "Unavailable", "Errors"], ["20 carts sampled", "20", "0", "0", "0"],
            phone=phone, titles=square_titles(CART_DAYS, words)),
        note="Every day 20 options go into a cart at the price the API quotes, and every cart is abandoned at once. "
             "A day is matched when no cart charged another price.",
        refresh=f"Refreshes daily at {CLOCK['cart_sample_at']}", phone=phone, anchor="catalogue-against-cart")

    pages = c.section(
        theme, "API against groupon.com",
        c.strip_cards(
            theme, PAGE_DAYS, DAYS[0], DAYS[-1], legend,
            f"Last 30 days: {PAGES_SEEN - PAGES_MISMATCH:,} of {PAGES_SEEN:,} pages matched",
            f"Last mismatch on {LAST_PAGE_MISMATCH}: 2 of 61 pages showed the promo price. "
            "No sample on 5, 6 and 13 Sep: the collector did not run.",
            f"Latest day: {TODAY}",
            ["Day", "Showed the price you pay", "Showed the promo price", "Showed another price"],
            ["59 listing pages", "59", "0", "0"],
            phone=phone, titles=square_titles(PAGE_DAYS, words)),
        note="Deals on groupon.com listing pages, matched to the API by deal slug. "
             "A day is matched when every page showed the price you pay.",
        refresh=f"Refreshes daily at {CLOCK['pages_read_at']}", phone=phone, anchor="api-against-groupon-com")

    # The section's own figures stand in a figure row on the ground: the page has one tiles row, above.
    figures = figure_pairs(theme, [
        ("Sellable options", f"{SELLABLE:,}"),
        ("With a code", pct(100 * WITH_CODE / SELLABLE)),
        ("Median gap", pct(20.0)),
        ("90th percentile", pct(29.8)),
    ], phone=phone)
    top = max(n for _, n in BANDS)
    bars = [{"label": f"{lb}{NBSP}%", "share": n / top, "value": f"{n:,}"} for lb, n in BANDS]
    bands_note = c.card_note(
        theme, f"{WITH_CODE:,} of {SELLABLE:,} sellable options in today's catalogue carry a code. "
               f"Half of those codes take off {pct(20.0)} or more, one in ten {pct(29.8)} or more.")
    hist = c.card(theme, c.histogram(theme, bars, phone=phone) + bands_note, title="Options by gap", phone=phone)
    # Every rank on the phone too, each with its promo line under the deal.
    rows = [{"rank": i + 1, "title": w[0], "pay": w[1], "gap": w[3], "sentence": instruction(w[4], w[2], w[1])} for i, w in enumerate(WORST)]
    ranked = c.gap_rows(theme, rows, phone=phone, title=f"The {len(WORST)} largest gaps")
    promo = c.section(
        theme, "Promo gap", c.stack([figures, hist, ranked], gap=inner),
        note="How much a promo code takes off the price you pay, over every sellable option that has one. "
             "Without the code the shopper pays the price shown.",
        refresh=f"Refreshes daily at {CLOCK['cart_sample_at']}", phone=phone, anchor="promo-gap")

    peak = max(CHANGES[:-1])
    peak_day = DAYS[CHANGES.index(peak)]
    bars_html = c.day_bars(theme, [min(1.0, n / peak) for n in CHANGES], DAYS[0], f"{TODAY}, so far",
                           peak=f"Peak {peak:,} on {peak_day}", phone=phone)
    history = c.card(theme, bars_html, title="Price changes per day, last 30 days", phone=phone)
    fresh = c.section(
        theme, "Freshness", c.side_cards(theme, history, c.sync_card(theme, phone=phone), phone),
        note=f"Price changes the delta sync picked up, per day. Mondays run higher: the weekly full load "
             f"lands at 05:00{NBSP}UTC.",
        refresh=f"Refreshes {CLOCK['delta_every']}", phone=phone, anchor="freshness")

    # The drawn states: the other verdict as an example (a size down, no live region, no rates) and the empty page.
    fail = c.verdict(
        theme, "fail", "Mismatched",
        "1 of 20 carts charged a price the API did not quote, and 2 of 61 listing pages showed the promo price.",
        phone=phone, example=True)
    empty = c.empty_state(
        theme, "Before the first cart sample",
        f"No cart sample yet. The job runs daily at {CLOCK['cart_sample_at']}: 20 options, every cart abandoned at once.",
        link=("See the promo gap", "#promo-gap"), phone=phone)
    states = c.stack([c.drawn_state(theme, "When a cart or a page disagrees", fail), empty], gap=20 if phone else 24)

    blocks = [hero, verdict, tiles, cart, pages, promo, fresh, states, c.foot(theme, FOOT, phone=phone)]
    return c.header(theme, "price-truth", phone=phone) + c.main(theme, "\n".join(blocks), phone=phone)


# Each height is where the board's content ends, measured by shots.js (contentHeight).
HEIGHTS = {
    ("lab", False): 3371,
    ("pixel", False): 3465,
    ("lab", True): 5054,
    ("pixel", True): 5275,
}


def boards():
    out = {}
    for theme in ("lab", "pixel"):
        for phone in (False, True):
            name = c.board_name("PriceTruth", theme, phone)
            w = 390 if phone else 1280
            h = HEIGHTS[(theme, phone)]
            title = f"Price truth{' phone' if phone else ''}, {theme}"
            html = c.page(theme, f"Price truth, {theme} look{', phone' if phone else ''}", w, h, content(theme, phone))
            out[name] = (html, w, h, title)
    return out
