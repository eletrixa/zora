"""The Scorecard boards (product 2, the partner experience daily probe): lab and pixel, desktop and phone.

Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
Module:  design/gen/scorecard.py
Deps:    design/gen/common.py; the data shapes ScorecardReport and SyncStatus in src/contracts/reports.ts
Tested:  python3 design/gen/build.py scorecard, then node design/gen/shots.js scorecard

Round 3. The page runs in the brief's order: hero, verdict, tiles, the 30-day runs, then Failing steps,
Latency per endpoint, Catalogue sync, Contract drift and Findings, each full width, then the drawn
states and the foot. Catalogue sync is the side cards form Price truth's Freshness uses: the latest
syncs on the left, the shared sync card on the right, never a second tiles row. Every board is read at
the sample clock in common.CLOCK (30 Sep, 23:23 UTC), so the latest run is the 04:00 UTC one. The step
names, latency figures, catalogue counts and findings are the live page's; the 30-day history and the
two drift rows are sample data.
"""
import common as c
from common import CLOCK, esc, raw

EYEBROW = "Product 2 · Partner experience daily probe"
NBSP = "\u00a0"


def pct(value):
    """98.6 % with the non-breaking space the language asks for."""
    return f"{value:.1f}{NBSP}%"


def utc(clock_time):
    """"04:00 UTC" with a non-breaking space, so a note never leaves "UTC" alone on a line."""
    return clock_time.replace(" UTC", f"{NBSP}UTC")


PROBE_AT = utc(CLOCK["probe_at"])
DAILY = f"Refreshes daily at {PROBE_AT}"

# ------------------------------------------------------------------------------------ sample data

# The latest run (ProbeRunRow): 39 steps, 04:00 UTC today.
STEPS, PASSED, FAILED, SKIPPED = 39, 37, 1, 1

# One square per day, 1 to 30 September, the day's last run; oldest left.
FAIL_DAYS, NO_RUN_DAYS = {4, 12, 13, 26, 30}, {17, 18}
DAYS = ["none" if d in NO_RUN_DAYS else "fail" if d in FAIL_DAYS else "pass" for d in range(1, 31)]
WORD = {"pass": "Pass", "fail": "Fail", "none": "No run"}
DAY_TITLES = [f"{d} Sep: {WORD[s]}" for d, s in enumerate(DAYS, start=1)]
RUNS = len(DAYS) - DAYS.count("none")
RUNS_PASSED = DAYS.count("pass")

# The pass rates count steps, as src/probe/scorecard.ts does: passed over passed plus failed, skipped
# left out. 30 days: 28 runs of 38 counted steps, 15 failed. 7 days: 7 runs, 8 failed (26 and 30 Sep).
RATE_7D = pct(100 * (7 * 38 - 8) / (7 * 38))
RATE_30D = pct(100 * (RUNS * 38 - 15) / (RUNS * 38))
# Labelled like Price truth's "Carts, 30 days": the unit is steps, where the strip counts runs.
RATES = [("Steps, 7 days", RATE_7D), ("Steps, 30 days", RATE_30D)]

VERDICT_SENTENCE = "1 of 39 steps failed: a state code answers HTTP 400 where the guide promises an empty page."
PASS_SENTENCE = "Every step that ran passed: 38 of 38, and 1 skipped."

FAILING = [
    {"name": "refusals · state-code", "status": "fail",
     "detail": [("Expected", "Guide, Inventory scope values: a state code with no state scope answers HTTP 200 with zero products."),
                ("Observed", "HTTP 400 invalid_argument, and no products array.")]},
]
FAILING_REST = "The other 38 steps: 37 passed, 1 skipped."

# (check, step, p50 ms, p95 ms): the eight slowest of 29 steps by p95, seven days of runs (the live figures).
# The two price-mismatch steps time one call, so they tie at the top, as they do on the live page.
LATENCY_STEPS = [
    ("price-mismatch", "current-price", 524, 3723),
    ("price-mismatch", "refused", 524, 3723),
    ("openapi-drift", "hash", 627, 2418),
    ("openapi-drift", "fetch", 591, 2347),
    ("cart-lifecycle", "remove", 476, 1399),
    ("cart-lifecycle", "create", 665, 1110),
    ("cart-lifecycle", "add", 561, 924),
    ("buy-link", "present", 651, 899),
]


def step_label(check, step):
    """The step name as check · step, breaking only at the dot: live names run to 30 characters, never split mid word."""
    keep = '<span style="white-space: nowrap">{}</span>'
    return raw(f"{keep.format(esc(check))} · {keep.format(esc(step))}")


LATENCY = [(step_label(ch, st), p50, p95) for ch, st, p50, p95 in LATENCY_STEPS]

# SyncStatus: 61,477 deals in the catalogue, 55,805 listable. SyncRunRow, newest first: today's last two
# delta syncs (the live figures) and Monday's full load, the kind the page names "full load".
LISTABLE = ("Listable deals", "55,805 of 61,477")
SYNC_HEAD = ["Sync", "Started, UTC", "Deals read", "Errors"]
SYNC_ROWS = [
    ("Delta sync", "2026-09-30 21:00", "131", "0"),
    ("Delta sync", "2026-09-30 18:00", "172", "0"),
    ("Full load", "2026-09-28 05:00", "61,420", "0"),
]
SYNC_NOTE = f"A delta sync reads only the deals that changed; the full load reads them all, Mondays at 05:00{NBSP}UTC."

# DriftEvent: kind leads the row, the figures (the day seen, the hashes and versions) sit right aligned.
DRIFT_HEAD = ["Kind", "Seen", "From", "To"]
DRIFT = [
    ("openapi.json", "2026-09-14", "3f9ac1…0c21", "8b04e2…e17d"),
    ("Guide", "2026-09-02", "version 6", "version 7"),
]

FINDINGS = [
    {"severity": "major", "area": "Products API", "status": "Reported",
     "expected": "Guide and OpenAPI: every page carries a timestamp, and the sync watermark is the last page's timestamp minus 10 minutes.",
     "observed": "GET /products answers with hasMore, nextCursor and products only. A client built to the guide rejects every page."},
    {"severity": "minor", "area": "Carts API", "status": "Open",
     "expected": "Guide, Managing the cart: PATCH sets the new quantity and returns the cart. Nothing says what happens above maxUnits.",
     "observed": "PATCH to quantity 2 on an option with maxUnits 1 answers success and keeps quantity 1, without a word."},
    {"severity": "minor", "area": "Products API", "status": "Open",
     "expected": "Guide, Inventory scope values: a state code such as IL, for a partner without a state scope, returns an empty page.",
     "observed": "GET /products?state=IL answers HTTP 400 invalid_argument with no products array."},
]
OPEN_FINDINGS = sum(1 for f in FINDINGS if f["status"] == "Open")

TILES = [
    {"label": "Steps passed", "value": f"{PASSED} of {STEPS}", "tone": "fail",
     "hint": f"{FAILED} failed, {SKIPPED} skipped in the run of 30{NBSP}Sep, {PROBE_AT}"},
    {"label": "Days with a run", "value": f"{RUNS} of {len(DAYS)}", "hint": f"The job did not run on 17 and 18{NBSP}Sep"},
    {"label": "Slowest p95", "value": f"{LATENCY_STEPS[0][3]:,} ms",
     "hint": f"Two {LATENCY_STEPS[0][0]} steps, tied"},
    {"label": "Open findings", "value": f"{OPEN_FINDINGS} of {len(FINDINGS)}", "hint": "The major one is reported to Groupon"},
]

# The next step for this page's reader before any run: the contract the probe reads every day.
OPENAPI_URL = "https://api.enc.groupon.com/octo-gateway/v1/openapi.json"
EMPTY = ("Before the first probe run",
         f"No probe run yet. The probe runs daily at {PROBE_AT}, and this page fills in after its first run.",
         ("Read the API contract", OPENAPI_URL))

FOOT = (f"Probe results refresh daily at {PROBE_AT}, the catalogue sync {CLOCK['delta_every']}; "
        f"the next delta sync runs at {utc(CLOCK['next_delta'])}.")

TITLES = {
    "Scorecard": "Scorecard, lab",
    "ScorecardPixel": "Scorecard, pixel",
    "ScorecardPhone": "Scorecard phone, lab",
    "ScorecardPixelPhone": "Scorecard phone, pixel",
}
HEIGHTS = {"Scorecard": 3303, "ScorecardPixel": 3384, "ScorecardPhone": 5137, "ScorecardPixelPhone": 5400}


# ------------------------------------------------------------------------------ parts of this page


def lead_text(theme):
    counts = f"fail, {PASSED} passed, {FAILED} failed, {SKIPPED} skipped"
    return raw(f"Last probe run {c.moment(CLOCK['probe_age'], CLOCK['probe_run'])}: {c.strong(theme, counts)}. "
               f"Every day at {esc(PROBE_AT)} the probe walks the partner journey on production, as an outside builder would.")


def runs_block(theme, phone=False):
    return c.strip_cards(
        theme, DAYS, "1 Sep", "30 Sep", (("pass", "Pass"), ("fail", "Fail"), ("none", "No run")),
        f"Last 30 days: {RUNS_PASSED} of {RUNS} runs passed",
        f"Last fail on 30{NBSP}Sep: 1 of 39 steps failed. No run on 17 and 18{NBSP}Sep: the job did not run.",
        "Latest run: 30 Sep", ["Run", "Passed", "Failed", "Skipped"],
        [f"{STEPS} steps at {PROBE_AT}", str(PASSED), c.toned(str(FAILED), "fail"), str(SKIPPED)],
        phone=phone, titles=DAY_TITLES)


def failing_block(theme, phone=False):
    rows = c.check_rows(theme, FAILING, phone=phone, last_rule=False)
    return c.card(theme, rows + c.card_note(theme, FAILING_REST), title=f"{FAILED} of {STEPS} steps failed",
                  phone=phone, gap=8 if phone else 10)


def latency_block(theme, phone=False):
    chart = c.latency_bars(theme, LATENCY, phone=phone, more=("Show all 29 steps", "#latency-all"))
    return c.card(theme, chart, title="p50 and p95, last 7 days", phone=phone)


def sync_block(theme, phone=False):
    """The latest syncs beside the shared sync card, as Price truth's Freshness sets its day bars beside it."""
    table = c.data_table(theme, SYNC_HEAD, [list(r) for r in SYNC_ROWS], numeric=(1, 2, 3), phone=phone,
                         last_rule=False, grow=0)
    history = c.card(theme, table + c.card_note(theme, SYNC_NOTE, foot=not phone),
                     title=f"Latest syncs: {sum(int(r[3]) for r in SYNC_ROWS)} errors", phone=phone, gap=4 if phone else 8)
    return c.side_cards(theme, history, c.sync_card(theme, extra=[LISTABLE], phone=phone), phone)


def drift_block(theme, phone=False):
    table = c.data_table(theme, DRIFT_HEAD, [list(r) for r in DRIFT], numeric=(1, 2, 3), phone=phone, last_rule=False,
                         grow=0)
    return c.card(theme, table, title=f"{len(DRIFT)} changes in 30 days", phone=phone, gap=4 if phone else 8)


def findings_block(theme, phone=False):
    return c.stack([c.finding_card(theme, f, phone) for f in FINDINGS], gap=12)


def states_block(theme, phone=False):
    """The drawn states under the page: the verdict on a passing day, then the page before any run."""
    example = c.verdict(theme, "pass", "Pass", PASS_SENTENCE, phone=phone, example=True)
    passed = c.drawn_state(theme, "When the latest run passed", example)
    cap, sentence, link = EMPTY
    empty = c.empty_state(theme, cap, sentence, link, phone)
    return c.stack([passed, empty], gap=20 if phone else 24)


def body(theme, phone=False):
    sec = lambda title, content, note, refresh=DAILY: c.section(theme, title, content, note=note, refresh=refresh, phone=phone)  # noqa: E731
    content = [
        c.hero(theme, EYEBROW, "Scorecard", lead_text(theme), phone),
        c.verdict(theme, "fail", "Fail", VERDICT_SENTENCE, RATES, phone),
        c.tiles(theme, TILES, lead=True, phone=phone, display_lead=False),
        sec("Runs", runs_block(theme, phone),
            "A run passes when every step that ran passed. One square per day, the day's last run."),
        sec("Failing steps", failing_block(theme, phone), "Steps of the latest run that did not pass."),
        sec("Latency per endpoint", latency_block(theme, phone),
            "Seven days of probe runs, 4 to 7 calls a step. The 8 slowest of 29 steps, by p95."),
        sec("Catalogue sync", sync_block(theme, phone),
            "The partner catalogue every other page reads, kept current by the delta sync.",
            f"Refreshes {CLOCK['delta_every']}"),
        sec("Contract drift", drift_block(theme, phone),
            "The guide version and the openapi.json hash, against the run before."),
        sec("Findings", findings_block(theme, phone),
            "What stopped us, and what the guide did not say, worst first · Added as they are found"),
        states_block(theme, phone),
        c.foot(theme, FOOT, phone),
    ]
    return c.header(theme, "scorecard", phone) + c.main(theme, "\n".join(content), phone)


def boards():
    out = {}
    for theme in ("lab", "pixel"):
        for phone in (False, True):
            name = c.board_name("Scorecard", theme, phone)
            width = 390 if phone else 1280
            height = HEIGHTS[name]
            out[name] = (c.page(theme, TITLES[name], width, height, body(theme, phone)), width, height, TITLES[name])
    return out
