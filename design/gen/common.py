"""Shared parts of the loop 5 artboards: the tokens and one HTML helper per part, for the lab and the pixel look.

Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
Module:  design/gen/common.py
Deps:    Python 3 standard library (html, json, random, re); design/LANGUAGE.md is the spec these helpers draw
Tested:  design/gen/lockup.py, built by design/gen/build.py and screenshotted by design/gen/shots.js

Every helper takes the look ("lab" or "pixel") first and returns an HTML string with inline styles.
Text arguments are escaped; wrap trusted markup in raw(...) to pass it through. Phone variants are the
same helpers with phone=True. The accent is the placeholder {{accent}}, filled by the canvas editor.
Rounds 2 and 3 folded in the parts the designers drew in their own modules (design/gen/requests/*.md)
and the shared fixes the round judges asked for (docs/ops/loop5/design/r*-*.md).
"""
import html as _html
import json
import math
import random
import re

A = "{{accent}}"

SORA = "'Sora', 'Trebuchet MS', sans-serif"
SANS = "'IBM Plex Sans', 'Segoe UI', sans-serif"
MONO = "'IBM Plex Mono', 'Consolas', monospace"
SILK = "'Silkscreen', 'IBM Plex Mono', monospace"
PRESS = "'Press Start 2P', 'Silkscreen', monospace"

FONTS = {
    "lab": "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
    "pixel": "https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Silkscreen:wght@400;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap",
    "both": "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600;700&family=Press+Start+2P&family=Silkscreen:wght@400;700&display=swap",
}

# Token names match the CSS custom properties in LANGUAGE.md (--ground, --surface, ...).
LOOKS = {
    "lab": {
        "accent_hex": "#FF6B4A", "accent_options": ["#FF6B4A", "#F2A541", "#3A7CA5"],
        "ground": "#FBF8F3", "surface": "#FFFFFF", "panel": "#F3EEE5", "bar": "#FFFFFF", "field": "#FFFFFF",
        "track": "#F3EEE5", "line": "#E3DDD2", "row_line": "#E3DDD2", "field_line": "#E3DDD2",
        "ink": "#1E1F4B", "muted": "#54567A", "action": "#2B2D6E", "on_action": "#FFFFFF", "figure": "#2B2D6E",
        "eyebrow": "#B93A22", "save": "#B93A22", "save_tint": "#FFF1EC", "save_line": "#F6C9BC",
        "promo": "#2B2D6E", "promo_tint": "#FFF1EC", "promo_line": "#F6C9BC",
        "pass": "#1F4FBF", "pass_ink": "#1F4FBF", "pass_tint": "#EAF0FF", "pass_line": "#C3D2F3",
        "fail": "#F2A541", "fail_ink": "#B4500B", "fail_tint": "#FFF3E3", "fail_line": "#F4CFA0", "fail_hatch": "#B4500B",
        "neutral": "#B9B4C9", "neutral_ink": "#54567A", "neutral_tint": "#F3EEE5",
        "monogram": "#CFC6B6", "panel_stripe": "#EEE7DB",
        "bw": 1, "r_card": 16, "r_row": 12, "r_field": 10, "r_pill": 999, "r_sq": 4,
        "shadow": "none", "body_font": SANS,
    },
    "pixel": {
        "accent_hex": "#F2B33D", "accent_options": ["#F2B33D", "#7FE0A6", "#B9A6F2"],
        "ground": "#14151C", "surface": "#1B1D26", "panel": "#1B1D26", "bar": "#0F1016", "field": "#0F1016",
        "track": "#0F1016", "line": "#3A3D4D", "row_line": "#2E3140", "field_line": "#4A4E62",
        "ink": "#E8E4D8", "muted": "#A8A5B8", "action": A, "on_action": "#14151C", "figure": "#E8E4D8",
        "eyebrow": "#B9A6F2", "save": A, "save_tint": "#2A2410", "save_line": A,
        "promo": "#B9A6F2", "promo_tint": "#211D30", "promo_line": "#B9A6F2",
        "pass": "#7FE0A6", "pass_ink": "#7FE0A6", "pass_tint": "#132A1E", "pass_line": "#2F6B4A",
        "fail": "#FF7A6B", "fail_ink": "#FF7A6B", "fail_tint": "#2A1716", "fail_line": "#7A2E26", "fail_hatch": "#7A2E26",
        "neutral": "#5A5D70", "neutral_ink": "#A8A5B8", "neutral_tint": "#0F1016",
        "monogram": "#7A5A12", "panel_stripe": "#181A23",
        "bw": 2, "r_card": 0, "r_row": 0, "r_field": 0, "r_pill": 0, "r_sq": 0,
        "shadow": "4px 4px 0 #000000", "body_font": MONO,
        "accent_shadow": "#7A5A12", "accent_hi": "#FFD97A", "accent_tint": "#2A2410", "dome": "#B9A6F2",
    },
}

# The one sample moment every board reads (LANGUAGE.md section 8): Wednesday 30 Sep 2026, 23:23 UTC.
# The times follow the cron schedule in wrangler.jsonc; a board that states a time takes it from here.
CLOCK = {
    "now": "2026-09-30T23:23:00Z",
    "today": "30 Sep",
    "delta_every": "every 3 hours",
    "last_delta": "21:00 UTC",
    "next_delta": "00:00 UTC",
    "next_delta_in": "37 minutes",
    "delta_runs_today": 8,
    "probe_at": "04:00 UTC",
    "probe_run": "2026-09-30T04:00:12Z",
    "probe_age": "19 hours ago",
    "cart_sample_at": "04:30 UTC",
    "pages_read_at": "06:00 UTC",
    "tags_walk_at": "00:30 UTC",
    "full_load": "Mondays at 05:00 UTC",
    "last_full_load": "28 Sep, 05:00 UTC",
}

# The four nav links, in this order on every page: (key, label, board base name, live path).
NAV = [
    ("top-deals", "Top deals", "TopDeals", "/"),
    ("finder", "Find a deal", "Finder", "/find"),
    ("price-truth", "Price truth", "PriceTruth", "/price-truth"),
    ("scorecard", "Scorecard", "Scorecard", "/scorecard"),
]
BASE_FOR_ACTIVE = {key: base for key, _, base, _ in NAV}


class Raw(str):
    """Trusted markup: esc() passes it through unchanged."""


def raw(markup):
    return Raw(markup)


def esc(value):
    if isinstance(value, Raw):
        return value
    return _html.escape(str(value), quote=True)


def look(theme):
    if theme not in LOOKS:
        raise ValueError(f"theme must be 'lab' or 'pixel', got {theme!r}")
    return LOOKS[theme]


def is_px(theme):
    look(theme)
    return theme == "pixel"


def board_name(base, theme, phone=False):
    """TopDeals + pixel + phone -> TopDealsPixelPhone, the file name stem of that board."""
    return base + ("Pixel" if is_px(theme) else "") + ("Phone" if phone else "")


def board_href(base, theme, phone=False):
    return board_name(base, theme, phone) + ".dc.html"


def _b(t, color=None):
    """One border in the look's width: 1 px in lab, 2 px in pixel."""
    return f"{t['bw']}px solid {color or t['line']}"


def _shadow(theme, t):
    return f"; box-shadow: {t['shadow']}" if is_px(theme) else ""


def _sh(n):
    return f"{n}px {n}px 0 #000000"


def _grow(markup):
    """Lets a part fill the flex column it sits in: flex 1 on its root element."""
    return markup.replace('style="', 'style="flex: 1; ', 1)


def _sep(t):
    """The rule between rows: 1 px solid in lab, 2 px dotted in pixel."""
    return f"2px dotted {t['row_line']}" if t["bw"] == 2 else f"1px solid {t['row_line']}"


# ---------------------------------------------------------------------------------------------- page


def page(theme, title, width, height, body, both_fonts=False):
    """The artboard: x-dc, the helmet with the look's fonts, the fixed-width root, the accent editor."""
    t = look(theme)
    props = {
        "accent": {"editor": "color", "default": t["accent_hex"], "options": t["accent_options"]},
        "$preview": {"width": width, "height": height},
    }
    dp = json.dumps(props).replace("&", "&amp;").replace("'", "&#39;")
    fonts = FONTS["both"] if both_fonts else FONTS[theme]
    link_hover = "#B93A22" if theme == "lab" else "#FFD97A"
    link = "#2B2D6E" if theme == "lab" else t["accent_hex"]
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{esc(title)}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="{fonts}">
<style>
body{{margin:0;font-family:{t['body_font']};color:{t['ink']};background:{t['ground']}}}
a{{color:{link}}}a:hover{{color:{link_hover}}}
</style>
</helmet>
<div data-theme="{theme}" style="width: {width}px; height: {height}px; box-sizing: border-box; background: {t['ground']}; display: flex; flex-direction: column; font-family: {t['body_font']}; color: {t['ink']}; overflow: hidden">
{body}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{dp}'>
class Component extends DCLogic {{
renderVals() {{
return {{ accent: this.props.accent ?? '{t['accent_hex']}' }};
}}
}}
</script>
</body>
</html>
"""


def main(theme, content, phone=False):
    """The page column under the header: 56 px gutters and 28 px between blocks (16 and 20 on the phone)."""
    look(theme)
    pad = "24px 16px 32px" if phone else "40px 56px 56px"
    gap = 20 if phone else 28
    return f'<main style="padding: {pad}; display: flex; flex-direction: column; gap: {gap}px; min-width: 0">\n{content}\n</main>'


def stack(items, gap=16):
    return f'<div style="display: flex; flex-direction: column; gap: {gap}px; min-width: 0">{"".join(items)}</div>'


def columns(items, template, gap=20, stretch=False):
    """A grid row, e.g. columns([a, b], "repeat(2, minmax(0, 1fr))"). Children get min-width 0.

    The gap is 20 on every side by side row of the site (podium, strip cards, grids, drawn states).
    stretch=True makes every item fill its cell, so cards side by side end on one line; a section in
    such a row takes section(fill=True), and an empty state empty_state(fill=True), so its card or
    panel fills the cell too.
    """
    if stretch:
        items = [_grow(i) for i in items]
    cells = "".join(f'<div style="min-width: 0; display: flex; flex-direction: column">{i}</div>' for i in items)
    return f'<div style="display: grid; grid-template-columns: {template}; gap: {gap}px">{cells}</div>'


# ------------------------------------------------------------------------------------ the lockup


def mark(theme, phone=False):
    """The lab mark (bars over an arch on a base) or the pixel mark (the same bars snapped to a 16 grid)."""
    t = look(theme)
    if not is_px(theme):
        s = 24 if phone else 28
        return (f'<svg width="{s}" height="{s}" viewBox="0 0 32 32" fill="none" aria-hidden="true" style="flex-shrink: 0">'
                f'<rect x="7" y="3" width="3" height="9" fill="{A}"></rect><rect x="14.5" y="0" width="3" height="12" fill="{A}"></rect>'
                f'<rect x="22" y="3" width="3" height="9" fill="{A}"></rect><path d="M3 25a13 13 0 0 1 26 0z" fill="#2B2D6E"></path>'
                f'<rect x="3" y="27.5" width="26" height="3" fill="{A}"></rect></svg>')
    d = t["dome"]
    cells = [(3, 2, 2, 4, A), (7, 0, 2, 6, A), (11, 2, 2, 4, A),
             (6, 6, 4, 1, d), (4, 7, 8, 1, d), (3, 8, 10, 1, d), (2, 9, 12, 3, d), (2, 13, 12, 2, A)]
    rects = "".join(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{c}"></rect>' for x, y, w, h, c in cells)
    return (f'<svg width="32" height="32" viewBox="0 0 16 16" fill="none" shape-rendering="crispEdges" aria-hidden="true" '
            f'style="flex-shrink: 0">{rects}</svg>')


def wordmark(theme, phone=False):
    t = look(theme)
    if is_px(theme):
        size, ls = (11, 0.08) if phone else (16, 0.12)
        return (f'<span style="font-family: {SILK}; font-weight: 700; font-size: {size}px; letter-spacing: {ls}em; '
                f'color: {t["ink"]}; white-space: nowrap"><span style="color: {A}">ZORA</span> AGENT LAB</span>')
    size = 15 if phone else 18
    return (f'<span style="font-family: {SORA}; font-weight: 700; font-size: {size}px; letter-spacing: 0.02em; '
            f'color: {t["ink"]}; white-space: nowrap">Zora Agent Lab</span>')


def switch(theme, current=None, phone=False, hrefs=None, focus=False, hover=False):
    """The look switch "Lab | Pixel": a 32 px track, each segment a 44 px tall hit box, the current look filled.

    Drawn in `theme`. `current` defaults to `theme` (the only state a live page shows); `focus` and
    `hover` mark the other segment, for the lockup board. On the site it is a form that posts to
    /theme with two buttons; on a board the segments are links to the other look's board. Each
    segment is a transparent box 44 tall holding the visible pill (lab 24, pixel 28), and the track
    is a layer drawn behind them, so the hit area is real on a board as on the site.
    """
    t = look(theme)
    current = current or theme
    hrefs = hrefs or {"lab": "#", "pixel": "#"}
    px = is_px(theme)
    segs = []
    for i, (key, label) in enumerate((("lab", "Lab"), ("pixel", "Pixel"))):
        on = key == current
        glyph_r = "999px" if key == "lab" else "0"
        glyph = f'<span aria-hidden="true" style="display: block; width: 8px; height: 8px; border-radius: {glyph_r}; background: currentColor; flex-shrink: 0"></span>'
        other = not on
        if px:
            color = t["on_action"] if on else (A if (other and hover) else t["muted"])
            bg = A if on else (t["accent_tint"] if (other and hover) else "transparent")
            sep = f"border-left: 2px solid {t['line']}; " if i == 1 else ""
            ring = f"outline: 2px dashed {A}; outline-offset: -5px; " if (other and focus) else ""
            pill = (f"{sep}{ring}display: inline-flex; align-items: center; gap: 6px; height: 28px; box-sizing: border-box; "
                    f"padding: 0 10px; background: {bg}; color: {color}; font-family: {SILK}; font-size: 12px; "
                    f"letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap")
        else:
            color = t["on_action"] if on else (t["ink"] if (other and hover) else t["muted"])
            bg = "#2B2D6E" if on else ("#FFFFFF" if (other and hover) else "transparent")
            ring = "outline: 2px solid #2B2D6E; outline-offset: 1px; " if (other and focus) else ""
            pill = (f"{ring}display: inline-flex; align-items: center; gap: 6px; height: 24px; box-sizing: border-box; "
                    f"padding: 0 10px; border-radius: 7px; background: {bg}; color: {color}; font-family: {SANS}; "
                    f"font-weight: 600; font-size: 13px; white-space: nowrap")
        pressed = "true" if on else "false"
        box = "position: relative; display: inline-flex; align-items: center; height: 44px; text-decoration: none"
        segs.append(f'<a href="{esc(hrefs[key])}" aria-pressed="{pressed}" style="{box}"><span style="{pill}">{glyph}{label}</span></a>')
    if px:
        layer = (f"border: 2px solid {t['line']}; background: {t['bar']}; box-shadow: 3px 3px 0 #000000")
        group = "padding: 0 2px"
    else:
        layer = f"background: {t['panel']}; border: 1px solid {t['line']}; border-radius: 10px"
        group = "padding: 0 4px; gap: 2px"
    track = (f'<span aria-hidden="true" style="position: absolute; left: 0; right: 0; top: 6px; height: 32px; '
             f'box-sizing: border-box; {layer}"></span>')
    return (f'<form method="post" action="/theme" aria-label="Look" style="display: flex; align-items: center; height: 44px; '
            f'margin: 0; flex-shrink: 0"><div role="group" aria-label="Look" style="position: relative; display: inline-flex; '
            f'align-items: center; height: 44px; box-sizing: border-box; {group}">{track}{"".join(segs)}</div></form>')


def lockup(theme, phone=False, page=None, current=None):
    """Mark, wordmark (the home link) and the switch. On the phone the switch goes to the right edge."""
    t = look(theme)
    base = page or "TopDeals"
    hrefs = {"lab": board_href(base, "lab", phone), "pixel": board_href(base, "pixel", phone)}
    home = board_href("TopDeals", theme, phone)
    gap = 10 if phone else 12
    brand = (f'<a href="{home}" style="display: flex; align-items: center; gap: {gap}px; min-height: 44px; '
             f'text-decoration: none; color: {t["ink"]}; min-width: 0">{mark(theme, phone)}{wordmark(theme, phone)}</a>')
    sw = switch(theme, current=current, phone=phone, hrefs=hrefs)
    if phone:
        return (f'<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; '
                f'width: 100%">{brand}{sw}</div>')
    divider = f'<span aria-hidden="true" style="display: block; width: {t["bw"]}px; height: 24px; background: {t["line"]}; margin: 0 16px"></span>'
    return f'<div style="display: flex; align-items: center">{brand}{divider}{sw}</div>'


def nav(theme, active, phone=False):
    t = look(theme)
    px = is_px(theme)
    links = []
    for key, label, base, _ in NAV:
        on = key == active
        cur = ' aria-current="page"' if on else ""
        href = board_href(base, theme, phone)
        if px:
            size, ls, padx = (10, 0.04, 5) if phone else (12, 0.08, 14)
            color = A if on else t["muted"]
            border = A if on else "transparent"
            bg = t["accent_tint"] if on else "transparent"
            style = (f"text-decoration: none; font-family: {SILK}; font-size: {size}px; letter-spacing: {ls}em; "
                     f"text-transform: uppercase; padding: 0 {padx}px; min-height: {40 if phone else 44}px; box-sizing: border-box; "
                     f"display: flex; align-items: center; white-space: nowrap; color: {color}; border: 2px solid {border}; background: {bg}")
        else:
            size = 14 if phone else 15
            color = t["ink"] if on else t["muted"]
            under = A if on else "transparent"
            style = (f"text-decoration: none; font-family: {SANS}; font-weight: 500; font-size: {size}px; "
                     f"padding: {'0 2px' if phone else '10px 4px'}; min-height: 44px; box-sizing: border-box; display: flex; "
                     f"align-items: center; white-space: nowrap; color: {color}; border-bottom: 3px solid {under}")
        links.append(f'<a href="{href}"{cur} style="{style}">{label}</a>')
    if phone:
        pad = "2px 16px" if px else "0 16px"
        return (f'<nav aria-label="Main" style="display: flex; align-items: center; justify-content: space-between; '
                f'padding: {pad}; border-top: {_b(t, t["row_line"] if px else t["line"])}">{"".join(links)}</nav>')
    gap = 8 if px else 28
    return f'<nav aria-label="Main" style="display: flex; align-items: center; gap: {gap}px">{"".join(links)}</nav>'


def skyline(theme, width, phone=False, quiet=False, seed=7):
    """The pixel look's signature strip: the skyline (56 px, lit windows) on the home page only.

    Every other page gets the quiet strip: a flat 24 px `--bar` band with the 2 px `--line` rule and
    no buildings, so the skyline stays the home page's own mark (r2-finder change 5).
    """
    t = look(theme)
    if not is_px(theme):
        return ""
    # flex-shrink 0: in the board's fixed-height column the strip would otherwise absorb any shortfall.
    if quiet:
        return (f'<div aria-hidden="true" style="height: 24px; flex-shrink: 0; background: {t["bar"]}; '
                f'border-bottom: 2px solid {t["line"]}"></div>')
    rng = random.Random(seed + (1 if phone else 0))
    gutter = 16 if phone else 56
    avail = width - 2 * gutter
    blocks, used = [], 0
    while True:
        w = rng.choice((24, 28, 36, 44))
        if used + w > avail:
            break
        h = rng.choice((18, 22, 26, 30, 34, 42, 50))
        body = rng.choice(("#262B3A", "#1E2230", "#1A1D29"))
        wins = ""
        for _ in range(rng.randint(2, 4)):
            lit = A if rng.random() < 0.55 else "#4A4E62"
            wins += f'<span style="display: block; width: 4px; height: 4px; background: {lit}"></span>'
        blocks.append(
            f'<div style="width: {w}px; height: {h}px; background: {body}; border-top: 2px solid #3A3F52; display: flex; '
            f'gap: 4px; padding: 4px; align-items: flex-start; flex-wrap: wrap; box-sizing: border-box; flex-shrink: 0">{wins}</div>')
        used += w + 6
    return (f'<div aria-hidden="true" style="display: flex; align-items: flex-end; gap: 6px; padding: 0 {gutter}px; '
            f'height: 56px; flex-shrink: 0; background: {t["bar"]}; border-bottom: 4px solid {A}; overflow: hidden">{"".join(blocks)}</div>')


def header(theme, active, phone=False, page=None, strip="auto", current=None):
    """The header: the lockup with the switch, then the four nav links (a second row on the phone).

    `page` is the board base name the switch links to (defaults from `active`). `strip` is "auto"
    (the full skyline on Top deals, the quiet one elsewhere), "full", "quiet" or "none"; lab has none.
    """
    t = look(theme)
    base = page or BASE_FOR_ACTIVE.get(active, "TopDeals")
    width = 390 if phone else 1280
    if phone:
        head = (f'<header style="background: {t["bar"]}; border-bottom: {_b(t)}">'
                f'<div style="display: flex; align-items: center; padding: 8px 16px; min-height: 60px; box-sizing: border-box">'
                f'{lockup(theme, True, base, current)}</div>{nav(theme, active, True)}</header>')
    else:
        head = (f'<header style="display: flex; align-items: center; justify-content: space-between; gap: 24px; '
                f'padding: 14px 56px; background: {t["bar"]}; border-bottom: {_b(t)}">'
                f'{lockup(theme, False, base, current)}{nav(theme, active)}</header>')
    if strip == "auto":
        strip = "full" if active == "top-deals" else "quiet"
    if is_px(theme) and strip in ("full", "quiet"):
        head += skyline(theme, width, phone, quiet=strip == "quiet")
    return head


# ------------------------------------------------------------------------------------- the hero


def sample_pill(theme, phone=False):
    t = look(theme)
    if is_px(theme):
        return (f'<span style="align-self: {"flex-start" if phone else "flex-end"}; font-family: {SILK}; font-size: 11px; '
                f'letter-spacing: 0.08em; text-transform: uppercase; padding: 6px 10px; background: {t["surface"]}; '
                f'color: {t["muted"]}; border: 2px dashed {t["line"]}; white-space: nowrap">Sample data</span>')
    return (f'<span style="align-self: {"flex-start" if phone else "flex-end"}; font-family: {MONO}; font-size: 12px; '
            f'padding: 4px 10px; border-radius: 999px; background: {t["panel"]}; color: {t["muted"]}; '
            f'border: 1px dashed {t["muted"]}; white-space: nowrap">Sample data</span>')


def strong(theme, text):
    """A figure inside running text (a lead, a note): ink, semibold, never a price."""
    t = look(theme)
    return raw(f'<strong style="font-weight: 600; color: {t["ink"]}">{esc(text)}</strong>')


def eyebrow(theme, text, phone=False):
    t = look(theme)
    if is_px(theme):
        return (f'<span style="font-family: {SILK}; font-size: {11 if phone else 12}px; letter-spacing: 0.1em; '
                f'text-transform: uppercase; color: {t["eyebrow"]}">{esc(text)}</span>')
    return (f'<span style="font-family: {MONO}; font-weight: 500; font-size: {11 if phone else 12}px; letter-spacing: 0.06em; '
            f'text-transform: uppercase; color: {t["eyebrow"]}">{esc(text)}</span>')


LONG_TITLE = 60  # an h1 longer than this (a live deal title runs to 120) steps down a size


def h1(theme, text, phone=False):
    """The page name. Past 60 characters it steps down (lab 30, phone 24; pixel 22, phone 18)."""
    t = look(theme)
    long = len(str(text)) > LONG_TITLE
    if is_px(theme):
        n = 3 if phone else 4
        size = (18 if phone else 22) if long else (20 if phone else 28)
        return (f'<h1 style="margin: 0; font-family: {PRESS}; font-weight: 400; font-size: {size}px; '
                f'line-height: 1.4; text-transform: uppercase; color: {A}; text-shadow: {_sh(n)}; overflow-wrap: anywhere">{esc(text)}</h1>')
    size = (24 if phone else 30) if long else (28 if phone else 38)
    return (f'<h1 style="margin: 0; font-family: {SORA}; font-weight: 700; font-size: {size}px; '
            f'line-height: 1.15; color: {t["ink"]}; overflow-wrap: anywhere">{esc(text)}</h1>')


def lead(theme, text, phone=False):
    t = look(theme)
    if is_px(theme):
        return (f'<p style="margin: 0; font-family: {MONO}; font-size: {14 if phone else 15}px; line-height: 1.6; '
                f'color: {t["muted"]}">{esc(text)}</p>')
    return (f'<p style="margin: 0; font-family: {SANS}; font-size: {14 if phone else 16}px; line-height: 1.5; '
            f'color: {t["muted"]}">{esc(text)}</p>')


def hero(theme, eyebrow_text, title, lead_text, phone=False, pill=True):
    """Eyebrow, h1, lead; the sample pill at the right (under the lead on the phone)."""
    gap = 12 if is_px(theme) else 8
    inner = eyebrow(theme, eyebrow_text, phone) + h1(theme, title, phone) + lead(theme, lead_text, phone)
    if phone:
        return (f'<div style="display: flex; flex-direction: column; gap: {gap}px">{inner}'
                f'{sample_pill(theme, True) if pill else ""}</div>')
    return (f'<div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 24px">'
            f'<div style="display: flex; flex-direction: column; gap: {gap}px; max-width: 820px">{inner}</div>'
            f'{sample_pill(theme) if pill else ""}</div>')


# ------------------------------------------------------------------------------ the picker card


_CHEV_LAB = ("url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath "
             "d='M1 1l5 5 5-5' fill='none' stroke='%2354567A' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E&quot;)")
_CHEV_PX = ("url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' "
            "shape-rendering='crispEdges'%3E%3Cpath d='M0 0h4v2h4V0h4v2h-2v2H8v2H4V4H2V2H0z' fill='%23A8A5B8'/%3E%3C/svg%3E&quot;)")


def word(theme, text, phone=False):
    """A fixed word of the sentence picker ("Top 20 deals in")."""
    t = look(theme)
    if is_px(theme):
        return (f'<span style="font-family: {SILK}; font-weight: 700; font-size: {16 if phone else 20}px; letter-spacing: 0.04em; '
                f'text-transform: uppercase; color: {t["ink"]}; padding-bottom: 14px; white-space: nowrap">{esc(text)}</span>')
    return (f'<span style="font-family: {SORA}; font-weight: 600; font-size: {20 if phone else 26}px; color: {t["ink"]}; '
            f'padding-bottom: 6px; white-space: nowrap">{esc(text)}</span>')


def _pick_label(theme, text):
    t = look(theme)
    if is_px(theme):
        return (f'<span style="font-family: {SILK}; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; '
                f'color: {t["muted"]}">{esc(text)}</span>')
    return f'<span style="font-family: {SANS}; font-size: 12px; font-weight: 500; color: {t["muted"]}">{esc(text)}</span>'


def _pick_box(theme, phone, width, chevron):
    """The shared look of a sentence slot: select and text field differ only by the chevron."""
    t = look(theme)
    w = "width: 100%; " if phone else (f"width: {width}px; " if width else "")
    if is_px(theme):
        # A fixed 48, not a minimum: a text input would grow to 52 and ride 4 px above the selects.
        bg = f"{t['field']} {_CHEV_PX} no-repeat right 12px center" if chevron else t["field"]
        return (f"{w}height: 48px; box-sizing: border-box; padding: 8px {36 if chevron else 12}px 8px 12px; "
                f"background: {bg}; border: 2px solid {t['field_line']}; border-bottom: 4px solid {A}; border-radius: 0; "
                f"box-shadow: inset 2px 2px 0 #000000; font-family: {MONO}; font-weight: 600; font-size: {16 if phone else 18}px; "
                f"color: {A}; appearance: none; -webkit-appearance: none; max-width: 100%")
    bg = f"transparent {_CHEV_LAB} no-repeat right 2px center" if chevron else "transparent"
    # 44 on both widths: the slot is the page's one required control, so it keeps the touch floor.
    return (f"{w}height: 44px; font-family: {SORA}; font-weight: 600; font-size: {22 if phone else 24}px; "
            f"line-height: 1.2; color: {t['action']}; border: 0; border-bottom: 3px solid {A}; border-radius: 0; background: {bg}; "
            f"padding: 2px {26 if chevron else 2}px 4px 2px; appearance: none; -webkit-appearance: none; max-width: 100%; box-sizing: border-box")


def sentence_select(theme, label, value, phone=False, width=None, name=None):
    """A choice inside the sentence ("[New York, NY]"), label above, the accent underline under it."""
    nm = f' name="{esc(name)}"' if name else ""
    full = "; width: 100%" if phone else ""
    return (f'<label style="display: inline-flex; flex-direction: column; gap: {6 if is_px(theme) else 2}px; max-width: 100%{full}">'
            f'{_pick_label(theme, label)}<select{nm} autocomplete="off" style="{_pick_box(theme, phone, width, True)}">'
            f'<option selected>{esc(value)}</option></select></label>')


def sentence_text(theme, label, value="", placeholder="", phone=False, width=220, name=None):
    """A typed word inside the sentence ("Find [massage]"): the select's look without the chevron."""
    t = look(theme)
    nm = f' name="{esc(name)}"' if name else ""
    full = "; width: 100%" if phone else ""
    ph_color = t["muted"]
    val = f' value="{esc(value)}"' if value else ""
    return (f'<label style="display: inline-flex; flex-direction: column; gap: {6 if is_px(theme) else 2}px; max-width: 100%{full}">'
            f'{_pick_label(theme, label)}<input type="text"{nm}{val} placeholder="{esc(placeholder)}" autocomplete="off" '
            f'data-1p-ignore data-lpignore="true" style="{_pick_box(theme, phone, width, False)}; outline: none; '
            f'caret-color: {ph_color}"></label>')


def button(theme, label, kind="primary", href=None, full=False):
    """Primary: the one action of a form. Secondary: the outlined second choice."""
    t = look(theme)
    w = "width: 100%; " if full else ""
    if is_px(theme):
        if kind == "primary":
            skin = (f"border: 2px solid {t['accent_hi']}; background: {A}; color: {t['on_action']}; "
                    f"box-shadow: 4px 4px 0 {t['accent_shadow']}")
        else:
            skin = f"border: 2px solid {A}; background: {t['bar']}; color: {A}; box-shadow: {_sh(4)}"
        style = (f"{w}min-height: 48px; padding: 0 28px; box-sizing: border-box; {skin}; font-family: {SILK}; font-weight: 700; "
                 f"font-size: 14px; letter-spacing: 0.1em; text-transform: uppercase")
    else:
        if kind == "primary":
            skin = f"border: 1px solid {t['action']}; background: {t['action']}; color: {t['on_action']}"
        else:
            skin = f"border: 1px solid {t['action']}; background: {t['surface']}; color: {t['action']}"
        style = (f"{w}min-height: 48px; padding: 0 28px; box-sizing: border-box; border-radius: 10px; {skin}; "
                 f"font-family: {SANS}; font-weight: 600; font-size: 15px")
    style += "; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; cursor: pointer; white-space: nowrap"
    if not full:
        style += "; align-self: flex-start"
    if href:
        return f'<a href="{esc(href)}" style="{style}">{esc(label)}</a>'
    return f'<button type="submit" style="{style}">{esc(label)}</button>'


def _part(theme, part, phone):
    if isinstance(part, str):
        return part
    kind = part[0]
    if kind == "word":
        return word(theme, part[1], phone)
    if kind == "select":
        return sentence_select(theme, part[1], part[2], phone)
    if kind == "text":
        width = part[4] if len(part) > 4 else 220
        return sentence_text(theme, part[1], part[2], part[3] if len(part) > 3 else "", phone, width=width)
    raise ValueError("picker part must be ('word', text), ('select', label, value) or "
                     f"('text', label, value, placeholder[, width]): {part!r}")


PHONE_WORD_MAX = 8  # a picker word longer than this takes a phone row of its own, so every slot keeps 200 px


def picker(theme, parts, button_label, note=None, phone=False, action="#"):
    """The picker card: one sentence of words and slots, the button at its end, a note under it.

    parts: ("word", "Top 20 deals in"), ("select", "City", "New York, NY"), ("text", "What", "massage",
    "placeholder", 220), ("break",), or ready HTML; the text part's width is optional (220). On the
    desktop each word stays with the slots after it and the last group with the button, so a wide live
    select breaks the sentence between groups and the button never ends up alone. ("break",) starts a
    new line there in both looks, so a four-slot sentence (Find a deal) wraps at the same pair whatever
    the widths of the live lists; the phone ignores it.

    On the phone the sentence is two columns: the words in one column as wide as the widest word, the
    slots in the other, so every slot starts at one x. A word shares its row with the slot after it; a
    word of more than 8 characters, or one not followed by a slot, takes a row of its own; a slot with
    no word before it keeps to the slot column. The button takes the full width under the last row.
    So a long lead phrase is given as two words, ("word", "Top 20 deals"), ("word", "in"): the phone
    pairs "in" with City, and the desktop joins words in a row with a plain space, as one word.
    """
    t = look(theme)
    px = is_px(theme)
    pad = ("16px" if px else "20px 16px") if phone else ("20px 24px" if px else "24px 28px")
    skin = (f"background: {t['surface']}; border: {_b(t)}; border-radius: {t['r_card']}px{_shadow(theme, t)}")
    btn = button(theme, button_label, full=phone)
    if phone:
        items = [p for p in parts if not (isinstance(p, tuple) and p[0] == "break")]
        kinds = [p[0] if isinstance(p, tuple) else "html" for p in items]
        cells = []
        for i, part in enumerate(items):
            html = _part(theme, part, True)
            if kinds[i] == "word":
                pairs = i + 1 < len(items) and kinds[i + 1] in ("select", "text") and len(str(part[1])) <= PHONE_WORD_MAX
                place = "grid-column: 1" if pairs else "grid-column: 1 / -1"
                cells.append(f'<div style="{place}; display: flex; align-items: flex-end; min-width: 0">{html}</div>')
            elif kinds[i] in ("select", "text"):
                cells.append(f'<div style="grid-column: 2; display: flex; min-width: 0">{html}</div>')
            else:
                cells.append(f'<div style="grid-column: 1 / -1; min-width: 0">{html}</div>')
        # The word column is sized by the paired words only: a word that spans both columns never widens it.
        grid = (f'<div style="display: grid; grid-template-columns: max-content minmax(0, 1fr); align-items: end; '
                f'gap: 14px 12px">{"".join(cells)}</div>')
        sentence = f'<div style="display: flex; flex-direction: column; gap: 14px">{grid}{btn}</div>'
    else:
        joined = []
        for part in parts:
            if isinstance(part, tuple) and part[0] == "word" and joined and isinstance(joined[-1], tuple) and joined[-1][0] == "word":
                joined[-1] = ("word", f"{joined[-1][1]} {part[1]}")
            else:
                joined.append(part)
        groups, cur = [], []
        for part in joined:
            kind = part[0] if isinstance(part, tuple) else "html"
            if kind in ("word", "break") and cur:
                groups.append(cur)
                cur = []
            if kind == "break":
                groups.append(None)
                continue
            cur.append(_part(theme, part, False))
        if cur:
            groups.append(cur)
        last = max(i for i, g in enumerate(groups) if g is not None)
        tail = f'<span style="display: flex; align-self: flex-end">{btn}</span>'
        line_break = '<span aria-hidden="true" style="flex-basis: 100%; height: 0"></span>'
        spans = "".join(
            line_break if g is None else
            (f'<span style="display: inline-flex; align-items: flex-end; gap: 14px; white-space: nowrap">'
             f'{"".join(g)}{tail if i == last else ""}</span>') for i, g in enumerate(groups))
        sentence = f'<div style="display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px 14px">{spans}</div>'
    note_html = ""
    if note:
        font = f"font-family: {MONO}; font-size: 12px; line-height: 1.6" if px else f"font-family: {SANS}; font-size: 13px; line-height: 1.5"
        note_html = f'<div style="{font}; color: {t["muted"]}">{esc(note)}</div>'
    return (f'<form method="get" action="{esc(action)}" style="{skin}; padding: {pad}; display: flex; flex-direction: column; '
            f'gap: 16px; margin: 0">{sentence}{note_html}</form>')


def text_field(theme, label, value="", placeholder="", width=None, phone=False):
    """The boxed field, for forms outside the sentence (none on the five pages today)."""
    t = look(theme)
    w = "100%" if (phone or not width) else f"{width}px"
    if is_px(theme):
        box = (f"min-height: 48px; box-sizing: border-box; padding: 10px 14px; border: 2px solid {t['field_line']}; "
               f"background: {t['field']}; box-shadow: inset 2px 2px 0 #000000; font-family: {MONO}; font-size: 15px; color: {t['ink']}; width: 100%")
    else:
        box = (f"min-height: 48px; box-sizing: border-box; padding: 10px 14px; border-radius: 10px; border: 1px solid {t['field_line']}; "
               f"background: {t['field']}; font-family: {SANS}; font-size: 15px; color: {t['ink']}; width: 100%")
    val = f' value="{esc(value)}"' if value else ""
    return (f'<label style="display: flex; flex-direction: column; gap: 6px; width: {w}">{_pick_label(theme, label)}'
            f'<input type="text"{val} placeholder="{esc(placeholder)}" autocomplete="off" data-1p-ignore style="{box}"></label>')


def select_field(theme, label, value, width=None, phone=False):
    t = look(theme)
    w = "100%" if (phone or not width) else f"{width}px"
    if is_px(theme):
        box = (f"min-height: 48px; box-sizing: border-box; padding: 10px 36px 10px 14px; border: 2px solid {t['field_line']}; "
               f"background: {t['field']} {_CHEV_PX} no-repeat right 14px center; box-shadow: inset 2px 2px 0 #000000; "
               f"font-family: {MONO}; font-size: 15px; color: {t['ink']}; width: 100%; appearance: none; -webkit-appearance: none")
    else:
        box = (f"min-height: 48px; box-sizing: border-box; padding: 10px 36px 10px 14px; border-radius: 10px; "
               f"border: 1px solid {t['field_line']}; background: {t['field']} {_CHEV_LAB} no-repeat right 14px center; "
               f"font-family: {SANS}; font-size: 15px; color: {t['ink']}; width: 100%; appearance: none; -webkit-appearance: none")
    return (f'<label style="display: flex; flex-direction: column; gap: 6px; width: {w}">{_pick_label(theme, label)}'
            f'<select autocomplete="off" style="{box}"><option selected>{esc(value)}</option></select></label>')


# ------------------------------------------------------------------------ section and results head


def title_rule(theme, text, phone=False, level=2):
    """The section title with the accent rule under it."""
    t = look(theme)
    if is_px(theme):
        size = 13 if phone else 16
        return (f'<h{level} style="margin: 0; align-self: flex-start; display: inline-flex; align-items: center; gap: 10px; '
                f'font-family: {SILK}; font-weight: 700; font-size: {size}px; letter-spacing: 0.08em; line-height: 1.4; '
                f'text-transform: uppercase; color: {t["ink"]}; padding-bottom: 8px; border-bottom: 4px solid {A}">'
                f'<span aria-hidden="true" style="display: block; width: 8px; height: 8px; background: {A}; flex-shrink: 0"></span>'
                f'<span>{esc(text)}</span></h{level}>')
    size = 18 if phone else 22
    return (f'<h{level} style="margin: 0; align-self: flex-start; font-family: {SORA}; font-weight: 600; font-size: {size}px; '
            f'line-height: 1.3; color: {t["ink"]}; padding-bottom: {6 if phone else 8}px; border-bottom: 3px solid {A}">{esc(text)}</h{level}>')


def refresh_note(theme, text):
    """When a section's numbers refresh ("Refreshes daily at 04:00 UTC")."""
    t = look(theme)
    font = f"font-family: {MONO}; font-size: 12px" if is_px(theme) else f"font-family: {SANS}; font-size: 13px"
    return f'<span style="{font}; color: {t["muted"]}; white-space: nowrap">{esc(text)}</span>'


def section_head(theme, title, note=None, refresh=None, aside=None, phone=False):
    """Title with the rule; on the right the aside (a sort toggle) or the refresh note; the note under it."""
    t = look(theme)
    px = is_px(theme)
    # The padding sets the note on the title's baseline; on the phone the note sits under the title, so none.
    pad = 0 if phone else (14 if px else 11)
    right = aside or (f'<span style="padding-bottom: {pad}px">{refresh_note(theme, refresh)}</span>' if refresh else "")
    note_bits = [esc(note)] if note else []
    if refresh and aside:
        note_bits.append(esc(refresh))
    note_html = ""
    if note_bits:
        font = f"font-family: {MONO}; font-size: 13px; line-height: 1.6" if px else f"font-family: {SANS}; font-size: 14px; line-height: 1.45"
        note_html = f'<p style="margin: 0; {font}; color: {t["muted"]}; max-width: 820px">{" · ".join(note_bits)}</p>'
    if phone:
        rt = f'<div style="display: flex">{right}</div>' if (right and not aside) else (right or "")
        return f'<div style="display: flex; flex-direction: column; gap: 10px">{title_rule(theme, title, True)}{note_html}{rt}</div>'
    return (f'<div style="display: flex; flex-direction: column; gap: 10px"><div style="display: flex; align-items: flex-end; '
            f'justify-content: space-between; gap: 16px; flex-wrap: wrap">{title_rule(theme, title)}{right}</div>{note_html}</div>')


def section(theme, title, body, note=None, refresh=None, aside=None, phone=False, fill=False, anchor=None):
    """A page section: the head on the ground, then its body (cards, podium, a figure row) under it.

    fill=True: the section fills its cell and its body fills the section, for sections side by side in
    columns(stretch=True) whose cards end on one line. anchor: the section's id, for a section a
    footnote, a text link or an empty state points at ("promo-gap", "options").
    """
    gap = 14 if phone else 20
    grow = "flex: 1; " if fill else ""
    if fill:
        body = _grow(body)
    ident = f' id="{esc(anchor)}"' if anchor else ""
    return (f'<section{ident} style="{grow}display: flex; flex-direction: column; gap: {gap}px; min-width: 0">'
            f'{section_head(theme, title, note, refresh, aside, phone)}{body}</section>')


def sort_toggle(theme, options, current=0, phone=False, label=True):
    """The segmented sort: links, the current one filled. Full width on the phone."""
    t = look(theme)
    px = is_px(theme)
    segs = []
    for i, text in enumerate(options):
        on = i == current
        grow = "flex-grow: 1; flex-basis: 0; " if phone else ""
        sep = f"border-left: {_b(t)}; " if i else ""
        if px:
            skin = f"background: {A}; color: {t['on_action']}" if on else f"color: {t['ink']}"
            font = (f"font-family: {SILK}; font-size: {11 if phone else 12}px; letter-spacing: {0.04 if phone else 0.08}em; "
                    f"text-transform: uppercase; white-space: nowrap")
        else:
            skin = f"background: {t['action']}; color: {t['on_action']}" if on else f"color: {t['action']}"
            font = f"font-family: {SANS}; font-size: 15px; font-weight: 600"
        cur = ' aria-current="true"' if on else ""
        segs.append(f'<a href="#"{cur} style="{grow}{sep}text-decoration: none; padding: 10px {8 if phone else 16}px; min-height: 44px; box-sizing: border-box; '
                    f'display: flex; align-items: center; justify-content: center; text-align: center; {font}; {skin}">{esc(text)}</a>')
    if px:
        box = f"border: 2px solid {t['line']}; background: {t['bar']}; box-shadow: {_sh(4)}"
    else:
        box = f"border: 1px solid {t['line']}; border-radius: 10px; overflow: hidden; background: {t['surface']}"
    disp = "flex" if phone else "inline-flex"
    ctl = f'<nav aria-label="Sort" style="display: {disp}; {box}">{"".join(segs)}</nav>'
    if phone or not label:
        return ctl
    lab = (f'<span style="font-family: {SILK}; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: {t["muted"]}">Sort</span>'
           if px else f'<span style="font-size: 13px; color: {t["muted"]}">Sort</span>')
    return f'<div style="display: flex; align-items: center; gap: 10px">{lab}{ctl}</div>'


def results_head(theme, title, note=None, sort=None, refresh=None, phone=False):
    """The head of a result list: "Top 20 in New York, NY: Things To Do" or "9 deals for "massage" in Chicago, IL".

    `sort` is (options, current index) or None; `note` states the order ("Ordered by relevance").
    """
    aside = sort_toggle(theme, sort[0], sort[1], phone) if sort else None
    return section_head(theme, title, note, refresh, aside, phone)


# ------------------------------------------------------------------------------------ the tiles


TILE_LABEL_MAX = 16  # Silkscreen 11 wraps past this at half the phone row
_TILE_NOTES = set()


def _tone_glyph(theme, tone, color=None):
    """The pass check or fail cross beside a toned label, so the tone never rests on colour alone."""
    t = look(theme)
    px = is_px(theme)
    color = color or {"pass": t["pass_ink"], "fail": t["fail_ink"]}[tone]
    cap, join, crisp = ("square", "miter", ' shape-rendering="crispEdges"') if px else ("round", "round", "")
    size = 12 if px else 14
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="3" '
            f'stroke-linecap="{cap}" stroke-linejoin="{join}" aria-hidden="true"{crisp} style="flex-shrink: 0">'
            f'<path d="{_GLYPH[tone]}"></path></svg>')


def price_size(theme, phone=False, winner=False, compact=False):
    """The size of the price to pay on a deal card (LANGUAGE.md section 2), the figure a page's lead tile never passes.

    Lab 30, winner 36 (phone 28 and 30); pixel 28, winner 32 (phone 26 and 28); the compact phone card
    26 lab and 24 pixel.
    """
    if compact:
        return 24 if is_px(theme) else 26
    if is_px(theme):
        return (28 if winner else 26) if phone else (32 if winner else 28)
    return (30 if winner else 28) if phone else (36 if winner else 30)


def tiles(theme, items, lead=True, phone=False, display_lead=False, cap=None):
    """Figure tiles. items: dicts with label, value, hint and optional tone ("pass" or "fail").

    With lead=True the first tile is the lead: two columns wide, the accent rule on top, the biggest
    figure of the row. `cap` is the page's biggest price to pay (price_size(...)) when the page has no
    podium, as on Find a deal: the lead is set no bigger than it and the other tiles 4 under the lead,
    so a saving never outsizes a price. On Top deals the defaults already sit at the winner's size.
    display_lead=True sets the pixel lead in Press Start 2P; only a page without prices and without a
    verdict may spend its one display figure there (LANGUAGE.md section 2), so the default is off. A
    hint stops at two lines; a label stays within 16 characters; a toned tile takes its tone's tint
    and carries the pass or fail glyph by its label.
    """
    t = look(theme)
    px = is_px(theme)
    n = len(items)
    if phone:
        grid = "repeat(2, minmax(0, 1fr))"
    else:
        grid = f"repeat({n + (1 if lead else 0)}, minmax(0, 1fr))"
    if px:
        lead_size, rest_size = (24, 20) if phone else (32, 28)
    else:
        lead_size, rest_size = (30, 24) if phone else (36, 32)
    if cap:
        lead_size = min(lead_size, cap)
        rest_size = min(rest_size, lead_size - 4)
    cells = []
    for i, it in enumerate(items):
        is_lead = lead and i == 0
        tone = it.get("tone")
        vcolor = {"pass": t["pass_ink"], "fail": t["fail_ink"]}.get(tone, t["figure"])
        # A toned tile sits on its tone's tint, as the verdict and the badges do: fail ink on the plain lab
        # panel is 4.4:1, on the fail tint 4.7:1.
        fill = {"pass": t["pass_tint"], "fail": t["fail_tint"]}.get(tone, t["panel"])
        rest = n - (1 if lead else 0)
        orphan = phone and rest % 2 == 1 and i == n - 1 and not is_lead
        span = "grid-column: span 2; " if (is_lead or orphan) else ""
        label_text = str(it["label"])
        if len(label_text) > TILE_LABEL_MAX and label_text not in _TILE_NOTES:
            _TILE_NOTES.add(label_text)
            print(f"note: tile label {label_text!r} has {len(label_text)} characters; LANGUAGE.md keeps a tile label within {TILE_LABEL_MAX}")
        size = lead_size if is_lead else rest_size
        if px:
            top = f"border-top: 4px solid {A}; " if is_lead else ""
            skin = f"background: {fill}; border: 2px solid {t['line']}; {top}box-shadow: {_sh(4)}"
            lab = (f'<span style="font-family: {SILK}; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; '
                   f'color: {t["muted"]}">{esc(it["label"])}</span>')
            if is_lead and display_lead:
                vstyle = (f"font-family: {PRESS}; font-size: {18 if phone else 24}px; line-height: 1.3; color: {A}; "
                          f"text-shadow: {_sh(3)}; padding: 4px 0")
            else:
                vstyle = f"font-family: {MONO}; font-weight: 700; font-size: {size}px; line-height: 1.15; color: {vcolor}"
            hint_font = f"font-family: {MONO}; font-size: 12px; line-height: 1.5"
            pad = "14px 14px" if phone else "16px 18px"
        else:
            top = f"border-top: 3px solid {A}; " if is_lead else ""
            skin = f"{top}background: {fill}; border-radius: 16px"
            lab = f'<span style="font-family: {SANS}; font-size: 13px; font-weight: 500; color: {t["muted"]}">{esc(it["label"])}</span>'
            vstyle = f"font-family: {SORA}; font-weight: 700; font-size: {size}px; line-height: 1.1; color: {vcolor}"
            hint_font = f"font-family: {SANS}; font-size: 13px; line-height: 1.4"
            pad = "14px 16px" if phone else "18px 20px"
        if tone in ("pass", "fail"):
            lab = f'<span style="display: inline-flex; align-items: center; gap: 6px">{_tone_glyph(theme, tone)}{lab}</span>'
        # Two lines at most: a hint that names a deal carries its full title, and live titles run to 120 characters.
        clamp = "display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden"
        hint = f'<span style="{hint_font}; color: {t["muted"]}; {clamp}">{esc(it["hint"])}</span>' if it.get("hint") else ""
        cells.append(f'<div style="{span}{skin}; padding: {pad}; display: flex; flex-direction: column; gap: 4px; min-width: 0">'
                     f'{lab}<span style="{vstyle}; overflow-wrap: anywhere">{esc(it["value"])}</span>{hint}</div>')
    gap = 10 if phone else 20
    return f'<div style="display: grid; grid-template-columns: {grid}; gap: {gap}px">{"".join(cells)}</div>'


def figure(theme, label, value, tone=None, phone=False):
    """A small label over a figure outside a tile: the verdict's rates, the counts beside a strip."""
    t = look(theme)
    color = {"pass": t["pass_ink"], "fail": t["fail_ink"]}.get(tone, t["ink"])
    if is_px(theme):
        lab = _mini_label(theme, label)
        vstyle = f"font-family: {MONO}; font-weight: 700; font-size: {20 if phone else 24}px; line-height: 1.15"
    else:
        lab = f'<span style="font-family: {SANS}; font-size: 12px; font-weight: 500; color: {t["muted"]}">{esc(label)}</span>'
        vstyle = f"font-family: {SORA}; font-weight: 700; font-size: {22 if phone else 26}px; line-height: 1.15"
    return (f'<div style="display: flex; flex-direction: column; gap: 2px; min-width: 0">{lab}'
            f'<span style="{vstyle}; color: {color}; white-space: nowrap">{esc(value)}</span></div>')


def figure_row(theme, items, phone=False):
    """Figures side by side on the ground: the verdict's rates, and the figures inside a section.

    A page has one tiles row, right after its picker or verdict; a section that states its own figures
    uses this row instead of a second tiles row. items: (label, value) or (label, value, tone).
    It wraps where the row runs out (on the phone, two or three a line).
    """
    figs = "".join(figure(theme, it[0], it[1], tone=it[2] if len(it) > 2 else None, phone=phone) for it in items)
    return f'<div style="display: flex; flex-wrap: wrap; gap: 12px {24 if phone else 28}px">{figs}</div>'


# ------------------------------------------------------------------------------ cards and deals


def card(theme, body, title=None, phone=False, pad=None, gap=None):
    """The surface card that holds rows, tables, strips and charts inside a section."""
    t = look(theme)
    px = is_px(theme)
    p = pad or ("16px" if phone else "24px")
    g = gap if gap is not None else (14 if phone else 20)
    ttl = ""
    if title:
        if px:
            ttl = (f'<h3 style="margin: 0; font-family: {SILK}; font-weight: 700; font-size: 12px; letter-spacing: 0.1em; '
                   f'text-transform: uppercase; color: {t["muted"]}">{esc(title)}</h3>')
        else:
            ttl = (f'<h3 style="margin: 0; font-family: {SORA}; font-weight: 600; font-size: {15 if phone else 16}px; '
                   f'color: {t["muted"]}">{esc(title)}</h3>')
    return (f'<div style="background: {t["surface"]}; border: {_b(t)}; border-radius: {t["r_card"]}px{_shadow(theme, t)}; '
            f'padding: {p}; display: flex; flex-direction: column; gap: {g}px; min-width: 0">{ttl}{body}</div>')


def card_note(theme, text, foot=False):
    """A muted note inside a card (13; pixel mono 12). foot=True pins it to the card's bottom edge."""
    t = look(theme)
    font = (f"font-family: {MONO}; font-size: 12px; line-height: 1.6" if is_px(theme)
            else f"font-family: {SANS}; font-size: 13px; line-height: 1.45")
    pin = "margin-top: auto; " if foot else ""
    return f'<p style="margin: 0; {pin}{font}; color: {t["muted"]}">{esc(text)}</p>'


def state_caption(theme, text):
    """The caption over a drawn state ("When nothing matches", "When a cart or a page disagrees")."""
    t = look(theme)
    if is_px(theme):
        return _mini_label(theme, text)
    return f'<span style="font-family: {SANS}; font-size: 13px; color: {t["muted"]}">{esc(text)}</span>'


def drawn_state(theme, caption, body, fill=False, width=None):
    """A drawn state under the page: its caption over the drawn block (an example verdict, an empty panel).

    fill=True lets the block grow to the row, so two states side by side end on one line; `width` caps
    the whole state (760 for a lone empty state on the desktop).
    """
    if fill:
        body = _grow(body)
    cap = f"; max-width: {width}px" if width else ""
    return (f'<div style="display: flex; flex-direction: column; gap: 10px; min-width: 0{cap}">'
            f'{state_caption(theme, caption)}{body}</div>')


def monogram(title):
    """The photo fallback's letter: the first word that starts with a letter, after a leading "Up to 38% Off on".

    Live titles often open with "Up to N% Off" or a figure ("2-Hour Guided ..."); a U on every card, or
    a 2 beside the rank badge 2, reads as noise.
    """
    rest = re.sub(r"^\s*Up to \d+\s*% Off( on| at)?\s*", "", str(title), flags=re.I)
    for w in rest.split():
        if w[:1].isalpha():
            return w[:1].upper()
    return next((ch for ch in str(title) if ch.isalpha()), "?").upper()


def _monogram_size(theme, height):
    """The fallback letter follows the slot, quietly: a fifth of it in lab, 0.18 in pixel, on a 4 px step."""
    if is_px(theme):
        return max(20, min(64, int(height * 0.18) // 4 * 4))
    return max(24, min(72, int(height * 0.2) // 4 * 4))


def photo(theme, letter, height, rank=None, square=None, fill=False):
    """The photo slot; boards draw the fallback: a quiet monogram on a texture (lab stripes, pixel checker).

    The monogram is a placeholder, never the loudest mark of a card, so it takes a pale tone and a size
    that follows the slot (150 tall: 28 lab, 24 pixel). fill=True lets the slot grow to its parent's
    height, with `height` as its minimum (the deal page's one large photo).
    """
    t = look(theme)
    px = is_px(theme)
    if square:
        size = f"width: {square}px; height: {square}px; flex-shrink: 0"
    elif fill:
        size = f"width: 100%; height: 100%; min-height: {height}px; flex: 1"
    else:
        size = f"width: 100%; height: {height}px"
    glyph_px = _monogram_size(theme, square or height)
    if px:
        bg = "background: repeating-conic-gradient(#1F2230 0 25%, #181A23 0 50%) 0 0 / 16px 16px"
        glyph = (f"font-family: {SILK}; font-weight: 700; font-size: {glyph_px}px; color: {t['monogram']}; "
                 f"text-shadow: {_sh(2)}")
        radius = "0"
    else:
        bg = f"background: repeating-linear-gradient(135deg, {t['panel']} 0 12px, {t['panel_stripe']} 12px 24px)"
        glyph = f"font-family: {SORA}; font-weight: 700; font-size: {glyph_px}px; color: {t['monogram']}"
        radius = "12px" if square else "0"
    badge = ""
    if rank is not None:
        if px:
            badge = (f'<span style="position: absolute; top: 12px; left: 12px; width: 36px; height: 36px; background: {A}; '
                     f'color: {t["on_action"]}; font-family: {SILK}; font-weight: 700; font-size: 16px; display: flex; '
                     f'align-items: center; justify-content: center; box-shadow: {_sh(3)}">{rank}</span>')
        else:
            badge = (f'<span style="position: absolute; top: 12px; left: 12px; width: 36px; height: 36px; border-radius: 999px; '
                     f'background: {t["action"]}; color: {t["on_action"]}; font-family: {SORA}; font-weight: 700; font-size: 16px; '
                     f'display: flex; align-items: center; justify-content: center">{rank}</span>')
    img = (f'<div aria-hidden="true" style="{size}; {bg}; border-radius: {radius}; display: flex; align-items: center; '
           f'justify-content: center; {glyph}; image-rendering: pixelated">{esc(letter)}</div>')
    if badge:
        return f'<div style="position: relative">{img}{badge}</div>'
    return img


def photo_frame(theme, letter, height, phone=False):
    """The deal page's one large photo in the card skin; it grows to the buy box beside it (`height` is its minimum)."""
    t = look(theme)
    pic = photo(theme, letter, height, fill=True)
    if is_px(theme):
        skin = f"border: 2px solid {t['line']}; box-shadow: {_sh(4)}"
    else:
        skin = f"border: 1px solid {t['line']}; border-radius: 16px; overflow: hidden"
    return f'<div style="{skin}; display: flex; flex-direction: column; height: 100%; box-sizing: border-box">{pic}</div>'


def promo_sentence(instruction):
    """The first sentence of PromoNote.instruction: the code, where to type it and the price it gives.

    The second sentence ("Without it you pay $X.") is the row's own "You pay", so the line leaves it out.
    """
    return instruction.split(". ")[0].rstrip(".") + "."


def promo_line(theme, instruction):
    """The promo as one muted line under the deal it belongs to, in place of a numbered footnote list.

    Twenty footnotes with the same code read as noise, so the promo lives where the deal is: lab Plex
    Sans 12 `--promo`, pixel Plex Mono 12 lavender. The promo price appears only inside this sentence.
    """
    t = look(theme)
    font = f"font-family: {MONO}; font-size: 12px" if is_px(theme) else f"font-family: {SANS}; font-weight: 400; font-size: 12px"
    return f'<span style="display: block; margin-top: 2px; {font}; line-height: 1.4; color: {t["promo"]}">{esc(promo_sentence(instruction))}</span>'


def save_pill(theme, save, pct, best=False, phone=False, label=None, align="flex-start"):
    """"You save $61.00 · 43.6 %"; filled on the podium winner and on a card or option row a tile names.

    `label` is the naming tile's own label ("Biggest saving", "Cheapest") and leads the filled pill;
    a label always fills the pill. The pill breaks after the label first: "You save $61.00 · 43.6 %"
    is one unit that moves to the second line whole, and only a unit wider than the pill's line
    breaks, before its percent. `align` is the pill's align-self ("baseline" in a price line).
    """
    t = look(theme)
    best = best or bool(label)
    pct = str(pct).replace(" %", "\u00a0%")
    nowrap = lambda s: f'<span style="white-space: nowrap">{esc(s)}</span>'  # noqa: E731
    saving = f'<span style="display: inline-block; max-width: 100%">{nowrap(f"You save {save} ·")} {nowrap(pct)}</span>'
    text = raw((f'{nowrap(f"{label} ·")} ' if label else "") + saving)
    if is_px(theme):
        skin = (f"background: {A}; color: {t['on_action']}; border: 2px solid {A}" if best
                else f"background: {t['save_tint']}; color: {A}; border: 2px solid {A}")
        return (f'<span style="align-self: {align}; font-family: {MONO}; font-weight: 600; font-size: {12 if phone else 13}px; padding: 5px {8 if phone else 10}px; '
                f'{skin}">{text}</span>')
    skin = (f"background: {t['action']}; color: {t['on_action']}; font-weight: 600" if best
            else f"background: {t['save_tint']}; border: 1px solid {t['save_line']}; color: {t['save']}")
    # Radius 14 is a full pill on one line and a soft chip when a labelled pill wraps to two.
    return (f'<span style="align-self: {align}; font-family: {MONO}; font-size: 13px; padding: 6px 12px; border-radius: 14px; '
            f'{skin}">{text}</span>')


def pay_figure(theme, pay, size):
    t = look(theme)
    if is_px(theme):
        return (f'<span data-label="You pay" style="font-family: {MONO}; font-weight: 700; font-size: {size}px; line-height: 1; '
                f'color: {t["ink"]}">{esc(pay)}</span>')
    return (f'<span data-label="You pay" style="font-family: {SORA}; font-weight: 700; font-size: {size}px; line-height: 1; '
            f'color: {t["ink"]}">{esc(pay)}</span>')


def struck(theme, original, size=14):
    t = look(theme)
    return (f'<s data-label="Original" style="font-family: {MONO}; font-size: {size}px; color: {t["muted"]}; '
            f'white-space: nowrap">{esc(original)}</s>')


def _you_pay_label(theme):
    t = look(theme)
    if is_px(theme):
        return (f'<span style="font-family: {SILK}; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; '
                f'color: {t["muted"]}">You pay</span>')
    return f'<span style="font-family: {SANS}; font-size: 13px; color: {t["muted"]}">You pay</span>'


def deal_card(theme, d, rank=None, winner=False, phone=False, compact=False, href="Deal.dc.html"):
    """One deal: photo, title (the link), option, city, You pay with the original struck, the save pill.

    d: title, option, pay, original, save, pct, and optional city, promo (footnote number), letter
    (defaults to monogram(title)) and label (the label of the tile that names this card, which fills
    its pill: "Biggest saving", "Cheapest"). rank makes it a podium card (the rank badge on the photo);
    winner adds the accent rule, the bigger photo and price, and the filled pill. compact is the phone
    list form: an 88 px photo at the left, "You pay" over the price line. The title link covers the
    whole card (a stretched span inside it), so the photo and every line open the deal; the promo
    marker sits above the cover and keeps its own tap. Pass `city` only when the list spans cities.
    """
    t = look(theme)
    px = is_px(theme)
    letter = d.get("letter") or monogram(d["title"])
    line = promo_line(theme, d["sentence"]) if d.get("sentence") else ""
    tfont = (f"font-family: {MONO}; font-weight: 600; font-size: 15px; line-height: 1.4" if px
             else f"font-family: {SANS}; font-weight: 600; font-size: 16px; line-height: 1.35")
    cover = '<span aria-hidden="true" style="position: absolute; inset: 0"></span>'
    title = (f'<div style="overflow-wrap: anywhere"><a href="{esc(href)}" style="text-decoration: none; color: {t["ink"]}; {tfont}">'
             f'{esc(d["title"])}{cover}</a>'
             f'<span style="display: block; font-size: 13px; line-height: 1.4; color: {t["muted"]}; margin-top: 2px">{esc(d["option"])}</span>'
             + (f'<span style="display: block; font-size: 13px; line-height: 1.4; color: {t["muted"]}">{esc(d["city"])}</span>' if d.get("city") else "")
             + line + "</div>")
    size = price_size(theme, phone, winner, compact)
    if compact:
        # "You pay" over the line, so the price and the original share one line in both looks at 390.
        price = (f'<div style="display: flex; flex-direction: column; gap: 2px">{_you_pay_label(theme)}'
                 f'<div style="display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap">'
                 f'{pay_figure(theme, d["pay"], size)}{struck(theme, d["original"])}</div></div>')
    else:
        price = (f'<div style="display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap">{_you_pay_label(theme)}'
                 f'{pay_figure(theme, d["pay"], size)}{struck(theme, d["original"])}</div>')
    pill = save_pill(theme, d["save"], d["pct"], best=winner, phone=phone, label=d.get("label"))
    # Price and pill sit at the foot of the card, so cards side by side line their prices up.
    buy = f'<div style="margin-top: auto; display: flex; flex-direction: column; gap: 10px">{price}{pill}</div>'
    if px:
        edge = f"border: 2px solid {A}; box-shadow: 4px 4px 0 {t['accent_shadow']}" if winner else f"border: 2px solid {t['line']}; box-shadow: {_sh(4)}"
        skin = f"background: {t['surface']}; {edge}"
    else:
        top = f"; border-top: 4px solid {A}" if winner else ""
        skin = f"background: {t['surface']}; border: 1px solid {t['line']}; border-radius: 16px{top}"
    if compact:
        pic = photo(theme, letter, 88, square=88)
        return (f'<article style="{skin}; position: relative; padding: 12px; display: flex; gap: 14px; align-items: flex-start; min-width: 0">{pic}'
                f'<div style="display: flex; flex-direction: column; gap: 8px; min-width: 0; flex: 1">{title}{price}{pill}</div></article>')
    ph = (200 if winner else 150) if not phone else (150 if winner else 120)
    if rank is None:
        ph = 140 if phone else 150
    return (f'<article data-rank="{rank or ""}" style="{skin}; position: relative; overflow: hidden; display: flex; flex-direction: column; min-width: 0">'
            f'{photo(theme, letter, ph, rank)}<div style="padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 10px; flex: 1">'
            f'{title}{buy}</div></article>')


def podium_card(theme, d, rank, winner=False, phone=False):
    """The podium card is the deal card with a rank badge."""
    return deal_card(theme, d, rank=rank, winner=winner, phone=phone)


def podium(theme, deals, phone=False):
    """The top three: the winner wide (1.5fr 1fr 1fr), one per row on the phone."""
    cards = [podium_card(theme, d, i + 1, winner=i == 0, phone=phone) for i, d in enumerate(deals[:3])]
    grid = "minmax(0, 1fr)" if phone else "1.5fr 1fr 1fr"
    return f'<div style="display: grid; grid-template-columns: {grid}; gap: {14 if phone else 20}px">{"".join(cards)}</div>'


def deal_grid(theme, deals, phone=False, compact_phone=True, href="Deal.dc.html"):
    """The finder's result grid: three cards a row; on the phone one card per row, compact by default.

    href: the Deal board every card opens, board_href("Deal", theme, phone) so a pixel or phone board
    opens the Deal board of its own look and width.
    """
    if phone:
        cards = [deal_card(theme, d, phone=True, compact=compact_phone, href=href) for d in deals]
        return f'<div style="display: flex; flex-direction: column; gap: 12px">{"".join(cards)}</div>'
    cards = [deal_card(theme, d, href=href) for d in deals]
    return f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px">{"".join(cards)}</div>'


def saving_bar(theme, pct_value, pct_text=None, suffix=""):
    """The small track and percent of a ranked row: the fill is the saving share, 0 to 100."""
    t = look(theme)
    share = max(0, min(100, round(float(pct_value))))
    label = pct_text or f"{float(pct_value):.1f} %"
    if is_px(theme):
        bar = (f'<span aria-hidden="true" style="display: block; width: 76px; height: 6px; padding: 0; border: 2px solid {t["line"]}; '
               f'background: {t["track"]}"><span style="display: block; width: {share}%; height: 100%; '
               f'background: repeating-linear-gradient(90deg, {A} 0 6px, transparent 6px 8px)"></span></span>')
    else:
        bar = (f'<span aria-hidden="true" style="display: block; width: 72px; height: 8px; border-radius: 4px; background: {t["track"]}; '
               f'overflow: hidden"><span style="display: block; width: {share}%; height: 100%; background: {t["action"]}"></span></span>')
    return (f'<span style="display: inline-flex; align-items: center; gap: 8px; font-family: {MONO}; font-size: 13px; white-space: nowrap">'
            f'{bar}<span data-label="Saved">{esc(label)}{esc(suffix)}</span></span>')


_RANK_COLS = "44px minmax(0, 1fr) 110px 120px 120px 150px"


def rank_rows(theme, rows, phone=False, title="Ranks 4 to 20"):
    """Ranks 4 to 20 in a card: rank, deal (with its promo line), original, you pay, you save, saved.

    rows: dicts with rank, title, option, original, pay, save, pct (number) and optional sentence
    (PromoNote.instruction, drawn as the promo line under the option). On the phone each row is three
    lines: the deal and its option; "You pay", the price and the original; "You save" opening the bar
    line with the bare percent ("40.0 %"), since " saved" pushed the bar to a fourth line at 390.
    """
    t = look(theme)
    px = is_px(theme)
    sep = f"2px dotted {t['row_line']}" if px else f"1px solid {t['row_line']}"
    rnum = (lambda r: f"{int(r):02d}") if px else (lambda r: str(r))
    rcolor = A if px else t["muted"]
    out = []
    if not phone:
        hfont = (f"font-family: {SILK}; font-size: 11px; letter-spacing: 0.1em" if px
                 else f"font-family: {SANS}; font-size: 12px; font-weight: 600; letter-spacing: 0.04em")
        out.append(f'<div aria-hidden="true" style="display: grid; grid-template-columns: {_RANK_COLS}; column-gap: 12px; padding: 0 0 8px; '
                   f'border-bottom: {_b(t)}; {hfont}; text-transform: uppercase; color: {t["muted"]}">'
                   f'<span style="text-align: right; padding-right: 8px">#</span><span>Deal</span><span style="text-align: right">Original</span>'
                   f'<span style="text-align: right">You pay</span><span style="text-align: right">You save</span><span style="text-align: right">Saved</span></div>')
    for r in rows:
        line = promo_line(theme, r["sentence"]) if r.get("sentence") else ""
        tfont = f"font-family: {MONO}; font-size: 14px" if px else f"font-family: {SANS}; font-size: 15px"
        deal = (f'<a href="Deal.dc.html" style="text-decoration: none; font-weight: 500; {tfont}; color: {t["ink"]}">{esc(r["title"])}</a>')
        opt = f'<span style="display: block; font-size: 12px; line-height: 1.4; color: {t["muted"]}">{esc(r["option"])}</span>{line}'
        if phone:
            # Three lines on every row whatever the figures' widths: the deal, You pay with the original,
            # then You save opening the bar line.
            price = (f'<div style="display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap">{_you_pay_label(theme)}'
                     f'<span data-label="You pay" style="font-family: {MONO}; font-weight: 700; font-size: 18px; color: {t["ink"]}; '
                     f'white-space: nowrap">{esc(r["pay"])}</span>{struck(theme, r["original"], 13)}</div>')
            save = (f'<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap"><span data-label="You save" '
                    f'style="font-family: {MONO}; font-size: 13px; color: {t["save"]}; white-space: nowrap">You save {esc(r["save"])}</span>'
                    f'{saving_bar(theme, r["pct"])}</div>')
            out.append(
                f'<div data-rank="{r["rank"]}" style="display: grid; grid-template-columns: 36px minmax(0, 1fr); column-gap: 8px; padding: 12px 0; border-bottom: {sep}">'
                f'<div style="font-family: {MONO}; color: {rcolor}">{rnum(r["rank"])}</div>'
                f'<div style="display: flex; flex-direction: column; gap: 6px; min-width: 0"><div style="overflow-wrap: anywhere">{deal}{opt}</div>'
                f'{price}{save}</div></div>')
        else:
            out.append(
                f'<div data-rank="{r["rank"]}" style="display: grid; grid-template-columns: {_RANK_COLS}; align-items: center; column-gap: 12px; '
                f'padding: 12px 0; border-bottom: {sep}">'
                f'<span style="font-family: {MONO}; color: {rcolor}; text-align: right; padding-right: 8px">{rnum(r["rank"])}</span>'
                f'<span style="min-width: 0; overflow-wrap: anywhere">{deal}{opt}</span>'
                f'<span style="text-align: right">{struck(theme, r["original"])}</span>'
                f'<span data-label="You pay" style="font-family: {MONO}; font-weight: {700 if px else 600}; font-size: 16px; text-align: right; '
                f'white-space: nowrap; color: {t["ink"]}">{esc(r["pay"])}</span>'
                f'<span data-label="You save" style="font-family: {MONO}; color: {t["save"]}; text-align: right; white-space: nowrap">{esc(r["save"])}</span>'
                f'<span style="text-align: right">{saving_bar(theme, r["pct"])}</span></div>')
    body = f'<div style="display: flex; flex-direction: column">{"".join(out)}</div>'
    return card(theme, body, title=title, phone=phone)


_GAP_COLS = "44px minmax(0, 1fr) 130px 180px"


def gap_rows(theme, rows, phone=False, title="Largest gaps"):
    """The largest promo gaps as ranked rows in the rank_rows style: #, the deal with its promo line, you pay, gap.

    A WorstGapDeal has no original and its promo price lives only in the promo line, so the columns
    are rank_rows' without Original, You save and Saved. rows: dicts rank, title, pay, gap (a number,
    the percent), sentence (PromoNote.instruction). On the phone: the deal, "You pay" and the price,
    then the bar with "N % gap".
    """
    t = look(theme)
    px = is_px(theme)
    sep = _sep(t)
    rnum = (lambda r: f"{int(r):02d}") if px else str
    rcolor = A if px else t["muted"]
    out = []
    if not phone:
        hfont = (f"font-family: {SILK}; font-size: 11px; letter-spacing: 0.1em" if px
                 else f"font-family: {SANS}; font-size: 12px; font-weight: 600; letter-spacing: 0.04em")
        out.append(f'<div aria-hidden="true" style="display: grid; grid-template-columns: {_GAP_COLS}; column-gap: 12px; padding: 0 0 8px; '
                   f'border-bottom: {_b(t)}; {hfont}; text-transform: uppercase; color: {t["muted"]}">'
                   f'<span style="text-align: right; padding-right: 8px">#</span><span>Deal</span>'
                   f'<span style="text-align: right">You pay</span><span style="text-align: right">Gap</span></div>')
    tfont = f"font-family: {MONO}; font-size: 14px; line-height: 1.45" if px else f"font-family: {SANS}; font-size: 15px; line-height: 1.4"
    for r in rows:
        line = promo_line(theme, r["sentence"]) if r.get("sentence") else ""
        deal = (f'<a href="Deal.dc.html" style="text-decoration: none; font-weight: 500; {tfont}; color: {t["ink"]}">'
                f'{esc(r["title"])}</a>{line}')
        if phone:
            out.append(
                f'<div data-rank="{r["rank"]}" style="display: grid; grid-template-columns: 36px minmax(0, 1fr); column-gap: 8px; '
                f'padding: 12px 0; border-bottom: {sep}">'
                f'<div style="font-family: {MONO}; color: {rcolor}; line-height: 1.45">{rnum(r["rank"])}</div>'
                f'<div style="display: flex; flex-direction: column; gap: 8px; min-width: 0"><div style="overflow-wrap: anywhere">{deal}</div>'
                f'<div style="display: flex; align-items: baseline; gap: 10px">{_you_pay_label(theme)}'
                f'<span data-label="You pay" style="font-family: {MONO}; font-weight: 700; font-size: 18px; line-height: 1.2; color: {t["ink"]}; '
                f'white-space: nowrap">{esc(r["pay"])}</span></div>{saving_bar(theme, r["gap"], suffix=" gap")}</div></div>')
        else:
            out.append(
                f'<div data-rank="{r["rank"]}" style="display: grid; grid-template-columns: {_GAP_COLS}; align-items: center; column-gap: 12px; '
                f'padding: 12px 0; border-bottom: {sep}">'
                f'<span style="font-family: {MONO}; color: {rcolor}; text-align: right; padding-right: 8px">{rnum(r["rank"])}</span>'
                f'<span style="min-width: 0; overflow-wrap: anywhere">{deal}</span>'
                f'<span data-label="You pay" style="font-family: {MONO}; font-weight: {700 if px else 600}; font-size: 16px; text-align: right; '
                f'white-space: nowrap; color: {t["ink"]}">{esc(r["pay"])}</span>'
                f'<span style="text-align: right">{saving_bar(theme, r["gap"])}</span></div>')
    body = f'<div style="display: flex; flex-direction: column">{"".join(out)}</div>'
    return card(theme, body, title=title, phone=phone)


# ------------------------------------------------------------------------------ tables and charts


def _mini_label(theme, text):
    t = look(theme)
    if is_px(theme):
        return (f'<span style="font-family: {SILK}; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; '
                f'color: {t["muted"]}">{esc(text)}</span>')
    return f'<span style="font-family: {SANS}; font-size: 13px; color: {t["muted"]}">{esc(text)}</span>'


class Toned(str):
    """A table cell in the pass or fail ink (toned("1", "fail")); data_table colours the cell itself."""

    tone = None


def toned(text, tone):
    """A figure in a table or a labelled list set in the pass or fail ink: "Failed 1" in the latest run."""
    if tone not in ("pass", "fail"):
        raise ValueError(f"tone must be 'pass' or 'fail', got {tone!r}")
    cell = Toned(text)
    cell.tone = tone
    return cell


def _cell_ink(t, cell):
    """The colour and weight of a cell: its tone's ink at 600 when toned, else nothing to add.

    A toned cell keeps line height 1.3, what Plex Mono 400 sets by itself: Plex Mono 600 sets a 23 px
    line where 400 sets 18, and a toned figure would push its row apart.
    """
    tone = getattr(cell, "tone", None)
    if tone:
        return f"color: {t[tone + '_ink']}; font-weight: 600; line-height: 1.3; "
    return ""


def data_table(theme, head, rows, numeric=(), phone=False, last_rule=True, phone_title=0, grow=None):
    """The table; on the phone each row becomes a labelled list led by one cell as its title.

    numeric: indexes of the columns set in mono, right aligned, on one line (figures, dates, hashes,
    versions). Cells may be raw(...) or toned(...). last_rule=False drops the rule under the last row,
    for a table that ends on its card's edge. phone_title: the column that leads each phone row (a
    long name wraps well as a title, badly as a right aligned value). grow: the column that takes the
    spare width on the desktop, so the figure columns sit together at the right of a wide card.
    """
    t = look(theme)
    px = is_px(theme)
    sep = _sep(t)
    n = len(rows)
    if phone:
        blocks = []
        for k, row in enumerate(rows):
            lines = "".join(
                f'<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px">{_mini_label(theme, head[i])}'
                f'<span style="font-family: {MONO if i in numeric else t["body_font"]}; font-size: 14px; {_cell_ink(t, c)}text-align: right; '
                f'overflow-wrap: anywhere">{esc(c)}</span></div>' for i, c in enumerate(row) if i != phone_title)
            rule = sep if (last_rule or k < n - 1) else "0"
            blocks.append(f'<div style="display: flex; flex-direction: column; gap: 6px; padding: 12px 0; border-bottom: {rule}">'
                          f'<div style="font-weight: 600; font-size: 15px; overflow-wrap: anywhere">{esc(row[phone_title])}</div>{lines}</div>')
        return f'<div style="display: flex; flex-direction: column">{"".join(blocks)}</div>'
    hfont = (f"font-family: {SILK}; font-size: 11px; letter-spacing: 0.1em" if px
             else f"font-family: {SANS}; font-size: 12px; font-weight: 600; letter-spacing: 0.04em")
    ths = "".join(f'<th scope="col" style="{"width: 100%; " if i == grow else ""}text-align: {"right" if i in numeric else "left"}; '
                  f'padding: 10px 12px; {hfont}; text-transform: uppercase; color: {t["muted"]}; border-bottom: {_b(t)}; '
                  f'white-space: nowrap">{esc(h)}</th>'
                  for i, h in enumerate(head))
    trs = []
    for k, row in enumerate(rows):
        rule = sep if (last_rule or k < n - 1) else "0"
        tds = "".join(
            f'<td style="text-align: {"right" if i in numeric else "left"}; padding: 12px; font-size: 14px; border-bottom: {rule}; '
            f'font-family: {MONO if i in numeric else t["body_font"]}; {"white-space: nowrap; " if i in numeric else ""}'
            f'{"font-weight: 500; " if i == 0 else ""}color: {t["ink"]}; {_cell_ink(t, c)}">{esc(c)}</td>' for i, c in enumerate(row))
        trs.append(f"<tr>{tds}</tr>")
    return (f'<div style="overflow-x: auto; min-width: 0"><table style="width: 100%; border-collapse: collapse">'
            f'<thead><tr>{ths}</tr></thead><tbody>{"".join(trs)}</tbody></table></div>')


def _bar_fill(theme, which, horizontal=True):
    """The fill of a bar: `front` (the figure) or `back` (a second figure behind it, such as p95)."""
    t = look(theme)
    deg = 90 if horizontal else 0
    if is_px(theme):
        color = A if which == "front" else t["accent_shadow"]
        return f"background: repeating-linear-gradient({deg}deg, {color} 0 8px, transparent 8px 10px)"
    return f"background: {t['action'] if which == 'front' else t['neutral']}"


def _share_width(share):
    """A bar's width: its share of the track, and at least 4 px when the value is not zero, so it stays visible."""
    pct = round(max(0.0, min(1.0, float(share))) * 100, 1)
    return f"max(4px, {pct}%)" if share and float(share) > 0 else "0%"


def histogram(theme, bars, phone=False, label_width=None, value_width=None, stack=False, legend=None, axis=None):
    """Horizontal bars: label, track with the fill, the figure. bars: dicts label, share (0..1), value, back.

    `back` (0..1) draws a second fill behind the first (p95 behind p50). stack=True puts the label and
    the figure on one line over a full-width track (long labels, and the phone form of a two-value
    chart). `legend`: (("front", "p50, the typical call"), ("back", "p95, ...")), swatches drawn with the
    bars' own fills. `axis`: tick labels spread evenly under the track ("0", "1 s", ... "4 s").
    A value that is not zero keeps at least 4 px of fill.
    """
    t = look(theme)
    px = is_px(theme)
    lw = label_width or (84 if phone else 110)
    vw = value_width or (64 if phone else 88)
    h = 18 if phone else 22
    r = "0" if px else "6px"
    lfont = f"font-family: {MONO}; font-size: 12px" if px else f"font-family: {SANS}; font-size: 13px"
    if px:
        track = f"height: {h}px; box-sizing: border-box; background: {t['track']}; border: 2px solid {t['line']}; position: relative"
    else:
        track = f"height: {h}px; background: {t['track']}; border-radius: 6px; overflow: hidden; position: relative"
    rows = []
    for b in bars:
        fills = ""
        if b.get("back") is not None:
            fills += (f'<div style="position: absolute; left: 0; top: 0; bottom: 0; width: {_share_width(b["back"])}; '
                      f'{_bar_fill(theme, "back")}; border-radius: {r}"></div>')
        fills += (f'<div style="position: absolute; left: 0; top: 0; bottom: 0; width: {_share_width(b["share"])}; '
                  f'{_bar_fill(theme, "front")}; border-radius: {r}"></div>')
        bar = f'<div style="flex-grow: 1; min-width: 0; {track}">{fills}</div>'
        label = f'<span style="{lfont}; color: {t["muted"]}; overflow-wrap: anywhere">{esc(b["label"])}</span>'
        value = f'<span style="font-family: {MONO}; font-size: 13px; white-space: nowrap; color: {t["ink"]}">{esc(b["value"])}</span>'
        if stack:
            rows.append(f'<div style="display: flex; flex-direction: column; gap: 6px"><div style="display: flex; justify-content: space-between; '
                        f'align-items: baseline; gap: 12px">{label}{value}</div><div style="display: flex">{bar}</div></div>')
        else:
            rows.append(f'<div style="display: flex; align-items: center; gap: 12px"><span style="width: {lw}px; flex-shrink: 0; display: flex">'
                        f'{label}</span>{bar}<span style="width: {vw}px; flex-shrink: 0; text-align: right">{value}</span></div>')
    out = f'<div style="display: flex; flex-direction: column; gap: {14 if stack else 10}px">{"".join(rows)}</div>'
    if axis:
        last = len(axis) - 1
        ticks = "".join(
            f'<span style="position: absolute; left: {i * 100 / last:.4g}%; white-space: nowrap; '
            f'transform: translateX({"0" if i == 0 else "-100%" if i == last else "-50%"})">{esc(tick)}</span>'
            for i, tick in enumerate(axis))
        scale = (f'<div aria-hidden="true" style="position: relative; flex-grow: 1; height: 16px; font-family: {MONO}; '
                 f'font-size: 12px; color: {t["muted"]}">{ticks}</div>')
        if not stack:
            scale = (f'<div style="display: flex; gap: 12px"><span style="width: {lw}px; flex-shrink: 0"></span>{scale}'
                     f'<span style="width: {vw}px; flex-shrink: 0"></span></div>')
        out = f'<div style="display: flex; flex-direction: column; gap: 6px">{out}{scale}</div>'
    if legend:
        keys = "".join(
            f'<span style="display: inline-flex; align-items: center; gap: 8px"><span style="display: block; width: 18px; height: 10px; '
            f'{_bar_fill(theme, which)}; border-radius: {"0" if px else "3px"}; flex-shrink: 0"></span>{_mini_label(theme, text)}</span>'
            for which, text in legend)
        out = f'<div style="display: flex; flex-direction: column; gap: 14px"><div style="display: flex; flex-wrap: wrap; gap: 8px 24px">{keys}</div>{out}</div>'
    return out


def latency_bars(theme, rows, scale_ms=4000, phone=False, more=None):
    """Latency per step: p50 in front, p95 behind, on one track; "524 · 3,723 ms" at the right; an axis in seconds.

    rows: (step name, p50 ms, p95 ms). Built on histogram(): the legend over the bars, the long step
    names at 260 on the desktop, stacked over the track on the phone. `more`: (label, href) of the full
    list, a 44 px text link under the axis.
    """
    bars = [{"label": name, "share": p50 / scale_ms, "back": p95 / scale_ms, "value": f"{p50:,} · {p95:,} ms"}
            for name, p50, p95 in rows]
    axis = ["0"] + [f"{s} s" for s in range(1, scale_ms // 1000 + 1)]
    legend = (("front", "p50, the typical call"), ("back", "p95, the slowest 1 in 20"))
    chart = histogram(theme, bars, phone=phone, label_width=260, value_width=128, stack=phone, legend=legend, axis=axis)
    if more:
        chart += f'<div>{text_link(theme, more[0], more[1])}</div>'
    return chart


DAY_BAR_STEP = 8  # a pixel day bar is whole 8 px segments (6 on, 2 off)


def day_bars(theme, days, first, last, peak=None, phone=False):
    """One vertical bar per day (price changes per day). days: shares 0..1; first and last date under it.

    A day that is not zero keeps a visible bar: lab at least 4 px, pixel at least one segment. In pixel
    every bar is whole 8 px segments, rounded down, so no bar ends in a 1 or 2 px sliver on top.
    """
    t = look(theme)
    px = is_px(theme)
    height = 96 if phone else 120
    gap = 2 if phone else 4
    cols = []
    for share in days:
        share = max(0.0, min(1.0, float(share)))
        if px:
            fill = f"background: repeating-linear-gradient(0deg, {A} 0 6px, transparent 6px 8px)"
            # The small allowance keeps a share already snapped to a segment (0.666 for 80 of 120) on it.
            steps = math.floor(share * height / DAY_BAR_STEP + 0.05)
            size = f"{max(1, steps) * DAY_BAR_STEP if share > 0 else 0}px"
        else:
            fill = f"background: {t['action']}; border-radius: 3px 3px 0 0"
            size = f"max(4px, {share * 100:.1f}%)" if share > 0 else "0"
        cols.append(f'<div style="flex: 1 1 0; min-width: 0; height: {size}; {fill}"></div>')
    base = f"{t['bw']}px solid {t['line']}"
    peak_html = f'<span style="font-family: {MONO}; font-size: 12px; color: {t["muted"]}">{esc(peak)}</span>' if peak else ""
    dates = (f'<div style="display: flex; justify-content: space-between; font-family: {MONO}; font-size: 12px; color: {t["muted"]}">'
             f'<span>{esc(first)}</span><span>{esc(last)}</span></div>')
    return (f'<div style="display: flex; flex-direction: column; gap: 6px">{peak_html}<div aria-hidden="true" style="display: flex; '
            f'align-items: flex-end; gap: {gap}px; height: {height}px; border-bottom: {base}">{"".join(cols)}</div>{dates}</div>')


def _square(theme, state, phone, title=None):
    t = look(theme)
    r = f"{t['r_sq']}px"
    size = "width: 100%; aspect-ratio: 1" if phone else "width: 20px; height: 20px; flex-shrink: 0"
    if state == "pass":
        skin = f"background: {t['pass']}"
    elif state == "fail":
        skin = f"background: repeating-linear-gradient(45deg, {t['fail']} 0 3px, {t['fail_hatch']} 3px 5px)"
    else:
        skin = f"background: transparent; border: {t['bw']}px dashed {t['neutral']}"
    tip = f' title="{esc(title)}"' if title else ""
    return f'<span{tip} style="display: block; box-sizing: border-box; {size}; border-radius: {r}; {skin}"></span>'


def day_strip(theme, days, first, last, legend=(("pass", "Matched"), ("fail", "Mismatched"), ("none", "No sample")), phone=False,
              titles=None):
    """One square per day or run: filled (pass), hatched (fail), dashed (no data). Two rows of 15 on the phone.

    titles: one per square ("30 Sep: Fail"), so each square carries its date and outcome.
    """
    t = look(theme)
    titles = titles or [None] * len(days)
    sq = "".join(_square(theme, d, phone, tt) for d, tt in zip(days, titles))
    if phone:
        grid = f'<div style="display: grid; grid-template-columns: repeat(15, minmax(0, 1fr)); gap: 4px">{sq}</div>'
    else:
        grid = f'<div style="display: flex; gap: 6px; flex-wrap: wrap">{sq}</div>'
    counts = {k: days.count(k) for k in ("pass", "fail", "none")}
    label = f"{len(days)} days: {counts['pass']} {legend[0][1].lower()}, {counts['fail']} {legend[1][1].lower()}"
    dates = (f'<div style="display: flex; justify-content: space-between; font-family: {MONO}; font-size: 12px; color: {t["muted"]}">'
             f'<span>{esc(first)}</span><span>{esc(last)}</span></div>')
    keys = "".join(
        f'<span style="display: inline-flex; align-items: center; gap: 6px"><span style="width: 12px; display: block">{_square(theme, k, True)}</span>'
        f'{_mini_label(theme, v)}</span>' for k, v in legend)
    keyrow = f'<div style="display: flex; flex-wrap: wrap; gap: 8px 20px">{keys}</div>'
    width = "" if phone else f"max-width: {len(days) * 26 - 6}px; "
    return (f'<div role="img" aria-label="{esc(label)}" style="display: flex; flex-direction: column; gap: 8px">'
            f'<div style="{width}display: flex; flex-direction: column; gap: 6px">{grid}{dates}</div>{keyrow}</div>')


def side_cards(theme, left, right, phone=False):
    """A history card beside a 320 wide card with the latest state: the one form of every measured section.

    Price truth's strips and Freshness, Scorecard's runs and its catalogue sync: the history on the
    left (a strip, day bars), the latest state on the right as a labelled list. The cards are the
    grid's own items, so they end on one line; 320 leaves a 30-day strip its 774 px. The phone stacks.
    """
    if phone:
        return stack([left, right], gap=14)
    return f'<div style="display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 20px">{left}{right}</div>'


def strip_cards(theme, days, first, last, legend, strip_title, history, latest_title, latest_head, latest_row, phone=False, titles=None):
    """The 30-day strip beside the latest day: Price truth's comparisons and Scorecard's runs share this form.

    Left, a card titled with the count ("Last 30 days: 580 of 581 carts matched") holding the strip and,
    at its foot, `history` (the last failure, the missing days). Right, a 320 wide card with the latest
    day as a labelled list. The two cards end on one line; on the phone they stack.
    """
    strip = day_strip(theme, days, first, last, legend=legend, phone=phone, titles=titles)
    left = card(theme, strip + card_note(theme, history, foot=not phone), title=strip_title, phone=phone)
    listing = data_table(theme, latest_head, [latest_row], numeric=tuple(range(1, len(latest_head))), phone=True, last_rule=False)
    right = card(theme, listing, title=latest_title, phone=phone, gap=4 if phone else 8)
    return side_cards(theme, left, right, phone)


def sync_card(theme, extra=(), note=None, phone=False):
    """The catalogue sync as one card, in one vocabulary and one clock on every page that reports it.

    Title "Next sync: 00:00 UTC", then a labelled list: the schedule, "Last delta sync", "Delta syncs
    today", "Last full load" (from CLOCK), then `extra` rows as (label, value), such as ("Listable
    deals", "55,805 of 61,477"). `note` sits at the card's foot; by default it says when the next delta
    sync runs and what it picks up. Price truth's Freshness and Scorecard's catalogue section share it,
    beside a history card in side_cards() or on its own.
    """
    nb = lambda s: str(s).replace(" UTC", "\u00a0UTC")  # noqa: E731 (a time never breaks from its zone)
    head = ["Schedule", "Last delta sync", "Delta syncs today", "Last full load"] + [lb for lb, _ in extra]
    row = ([f"Delta sync {CLOCK['delta_every']}", nb(CLOCK["last_delta"]), str(CLOCK["delta_runs_today"]),
            CLOCK["last_full_load"].split(",")[0]] + [v for _, v in extra])
    listing = data_table(theme, head, [row], numeric=tuple(range(1, len(head))), phone=True, last_rule=False)
    if note is None:
        note = f"In {CLOCK['next_delta_in']}. It picks up every price change since {nb(CLOCK['last_delta'])}."
    foot_note = card_note(theme, note, foot=not phone) if note else ""
    return card(theme, listing + foot_note, title=f"Next sync: {nb(CLOCK['next_delta'])}", phone=phone, gap=4 if phone else 8)


VERDICT_WORD_WIDTH = 288  # fits "Mismatched" in both looks, so every banner's sentence starts at one x


def verdict(theme, tone, word_text, sentence, figures=(), phone=False, example=False):
    """The banner that states today's answer: the word, one sentence, the rates beside it.

    example=True draws a sample of the other state under the page (inside drawn_state): no live region,
    and the word a size down and out of the display face, since the page's one display figure is the
    live verdict's word. An example passes no figures: its sentence carries its own counts, so no rate
    on it can be read as today's (r2-price_truth change 2).
    """
    t = look(theme)
    px = is_px(theme)
    tint, line, ink, edge = ((t["pass_tint"], t["pass_line"], t["pass_ink"], t["pass"]) if tone == "pass"
                             else (t["fail_tint"], t["fail_line"], t["fail_ink"], t["fail"]))
    if px:
        skin = f"background: {tint}; border: 2px solid {edge}; box-shadow: {_sh(4)}"
        if example:
            wstyle = (f"font-family: {SILK}; font-weight: 700; font-size: {16 if phone else 20}px; line-height: 1.3; color: {ink}; "
                      f"letter-spacing: 0.04em; text-transform: uppercase")
        else:
            wstyle = (f"font-family: {PRESS}; font-size: {20 if phone else 28}px; line-height: 1.3; color: {ink}; "
                      f"text-shadow: {_sh(3)}; text-transform: uppercase")
        sfont = f"font-family: {MONO}; font-size: {14 if phone else 15}px; line-height: 1.6"
    else:
        skin = f"background: {tint}; border: 1px solid {line}; border-left: 8px solid {edge}; border-radius: 16px"
        size = (24 if phone else 28) if example else (28 if phone else 36)
        wstyle = (f"font-family: {SORA}; font-weight: 700; font-size: {size}px; line-height: 1.1; color: {ink}; "
                  f"letter-spacing: 0.04em; text-transform: uppercase")
        sfont = f"font-family: {SANS}; font-size: {15 if phone else 16}px; line-height: 1.5"
    word_html = f'<span style="{wstyle}">{esc(word_text)}</span>'
    sent = f'<p style="margin: 0; {sfont}; color: {t["ink"]}; flex: 1; min-width: 0">{esc(sentence)}</p>'
    role = "" if example else ' role="status"'
    if phone:
        fig_row = figure_row(theme, figures, phone=True) if figures else ""
        return (f'<div{role} style="{skin}; padding: 16px; display: flex; flex-direction: column; gap: 12px">'
                f'{word_html}{sent}{fig_row}</div>')
    fig_row = f'<div style="flex-shrink: 0">{figure_row(theme, figures)}</div>' if figures else ""
    return (f'<div{role} style="{skin}; padding: 20px 28px; display: flex; align-items: center; gap: 28px">'
            f'<div style="flex: 0 0 {VERDICT_WORD_WIDTH}px">{word_html}</div>{sent}{fig_row}</div>')


# ------------------------------------------------------------------------- badges, checks, findings


_GLYPH = {"pass": "m5 12.5 4.5 4.5L19 7.5", "fail": "M6 6l12 12M18 6 6 18", "neutral": "M6 12h12", "strong": "M6 6l12 12M18 6 6 18"}


def badge(theme, text, tone="neutral", glyph=True):
    """Tones: pass, fail, neutral (skipped, minor, open), strong (blocker: the fail tone filled)."""
    t = look(theme)
    px = is_px(theme)
    colors = {
        "pass": (t["pass_tint"], t["pass_ink"], t["pass_ink"] if px else t["pass_tint"]),
        "fail": (t["fail_tint"], t["fail_ink"], t["fail_ink"] if px else t["fail_tint"]),
        "neutral": (t["neutral_tint"], t["neutral_ink"], t["neutral"] if px else t["neutral_tint"]),
        "strong": (t["fail_ink"], "#14151C" if px else "#FFFFFF", t["fail_ink"]),
    }
    bg, fg, bd = colors[tone]
    cap, join, crisp = ("square", "miter", ' shape-rendering="crispEdges"') if px else ("round", "round", "")
    size = 12 if px else 14
    gl = (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{fg}" stroke-width="3" '
          f'stroke-linecap="{cap}" stroke-linejoin="{join}" aria-hidden="true"{crisp}><path d="{_GLYPH[tone]}"></path></svg>') if glyph else ""
    if px:
        return (f'<span style="display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; background: {bg}; color: {fg}; '
                f'border: 2px solid {bd}; font-family: {SILK}; font-weight: 700; font-size: 11px; letter-spacing: 0.08em; '
                f'text-transform: uppercase; white-space: nowrap">{gl}{esc(text)}</span>')
    return (f'<span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; background: {bg}; '
            f'color: {fg}; font-family: {SANS}; font-weight: 600; font-size: 13px; white-space: nowrap">{gl}{esc(text)}</span>')


def label_line(theme, label, text):
    """One "Label: text" line, the label muted and the text in ink ("Expected: ...", "Observed: ...")."""
    t = look(theme)
    font = f"font-family: {MONO}; font-size: 13px" if is_px(theme) else f"font-family: {SANS}; font-size: 14px"
    return (f'<div style="{font}; line-height: 1.5; color: {t["ink"]}; overflow-wrap: anywhere">'
            f'<span style="color: {t["muted"]}">{esc(label)}: </span>{esc(text)}</div>')


def check_rows(theme, rows, phone=False, last_rule=True, narrow=False):
    """The probe's checks: name, the badge, what it saw. rows: dicts name, status (pass, fail, skip), detail.

    detail is a sentence, or a list of (label, text) pairs drawn as label_line()s ("Expected", "Observed").
    narrow=True is the stacked form (name and badge on one line, the detail under them) for a
    half-width card on the desktop; the phone always stacks. last_rule=False drops the rule under the
    last row, for rows that end on their card's edge.
    """
    t = look(theme)
    px = is_px(theme)
    sep = _sep(t)
    label = {"pass": ("Pass", "pass"), "fail": ("Fail", "fail"), "skip": ("Skipped", "neutral")}
    stacked = phone or narrow
    out = []
    for k, r in enumerate(rows):
        text, tone = label[r["status"]]
        b = badge(theme, text, tone)
        rule = sep if (last_rule or k < len(rows) - 1) else "0"
        nfont = f"font-family: {MONO}; font-weight: 600; font-size: 14px" if px else f"font-family: {SANS}; font-weight: 500; font-size: 15px"
        dfont = f"font-family: {MONO}; font-size: 13px" if px else f"font-family: {SANS}; font-size: 14px"
        name = f'<span style="{nfont}; color: {t["ink"]}; overflow-wrap: anywhere">{esc(r["name"])}</span>'
        if isinstance(r["detail"], (list, tuple)):
            detail = (f'<div style="display: flex; flex-direction: column; gap: 2px; min-width: 0">'
                      f'{"".join(label_line(theme, lb, tx) for lb, tx in r["detail"])}</div>')
        else:
            detail = f'<span style="{dfont}; line-height: 1.45; color: {t["muted"]}; overflow-wrap: anywhere">{esc(r["detail"])}</span>'
        if stacked:
            out.append(f'<div style="display: flex; flex-direction: column; gap: 6px; padding: 12px 0; border-bottom: {rule}">'
                       f'<div style="display: flex; justify-content: space-between; align-items: center; gap: 12px">{name}{b}</div>{detail}</div>')
        else:
            out.append(f'<div style="display: grid; grid-template-columns: 260px 120px minmax(0, 1fr); align-items: center; column-gap: 16px; '
                       f'padding: 12px 0; border-bottom: {rule}">{name}<span>{b}</span>{detail}</div>')
    return f'<div style="display: flex; flex-direction: column">{"".join(out)}</div>'


STATUS_TONE = {"Reported": "pass", "Fixed": "pass", "Open": "neutral"}


def finding_card(theme, f, phone=False):
    """What stopped us: severity, area, expected, observed, status. severity: blocker, major, minor.

    The status badge has its own tone, apart from severity: pass once the finding is handled
    ("Reported", "Fixed"), neutral while it is open; f["status_tone"] overrides.
    """
    t = look(theme)
    px = is_px(theme)
    tone = {"blocker": "strong", "major": "fail", "minor": "neutral"}[f["severity"]]
    edge = {"blocker": t["fail_ink"], "major": t["fail"], "minor": t["neutral"]}[f["severity"]]
    sev = badge(theme, f["severity"].capitalize(), tone, glyph=False)
    status_tone = f.get("status_tone") or STATUS_TONE.get(f.get("status"), "neutral")
    status = badge(theme, f["status"], status_tone, glyph=False) if f.get("status") else ""
    afont = f"font-family: {MONO}; font-weight: 600; font-size: 14px" if px else f"font-family: {SANS}; font-weight: 600; font-size: 15px"
    body = (f'<div style="display: flex; flex-direction: column; gap: 6px; min-width: 0; flex: 1"><span style="{afont}; color: {t["ink"]}">'
            f'{esc(f["area"])}</span>{label_line(theme, "Expected", f["expected"])}{label_line(theme, "Observed", f["observed"])}</div>')
    if px:
        skin = f"background: {t['surface']}; border: 2px solid {t['line']}; border-left: 6px solid {edge}"
    else:
        skin = f"background: {t['surface']}; border: 1px solid {t['line']}; border-left: 4px solid {edge}; border-radius: 12px"
    if phone:
        return (f'<article style="{skin}; padding: 14px; display: flex; flex-direction: column; gap: 10px">'
                f'<div style="display: flex; gap: 8px; flex-wrap: wrap">{sev}{status}</div>{body}</article>')
    return (f'<article style="{skin}; padding: 16px 20px; display: flex; gap: 20px; align-items: flex-start">'
            f'<div style="width: 96px; flex-shrink: 0">{sev}</div>{body}<div style="flex-shrink: 0">{status}</div></article>')


# ---------------------------------------------------------------------- foot, empty state, deal page


SOURCE_LINE = "Prices come from the Groupon Partner Storefront API. The price a shopper pays is the retail price."


def foot(theme, text, phone=False, source=True):
    """The foot line: when the page's numbers refresh, then where the prices come from."""
    t = look(theme)
    px = is_px(theme)
    rule = f"2px solid {t['row_line']}" if px else f"1px solid {t['line']}"
    font = f"font-family: {MONO}; font-size: 12px; line-height: 1.6" if px else f"font-family: {SANS}; font-size: 13px; line-height: 1.5"
    src = f'<p style="margin: 0; {font}; color: {t["muted"]}">{SOURCE_LINE}</p>' if source else ""
    return (f'<footer style="border-top: {rule}; padding-top: {14 if phone else 16}px; display: flex; flex-direction: column; gap: 4px">'
            f'<p style="margin: 0; {font}; color: {t["muted"]}">{esc(text)}</p>{src}</footer>')


def moment(ago, iso):
    """A moment as the language writes it: "3 hours ago (2026-09-30T04:00:12Z)", the stamp kept on one line."""
    return raw(f'{esc(ago)} <span style="white-space: nowrap">({esc(iso)})</span>')


def _link_skin(theme):
    t = look(theme)
    if is_px(theme):
        return (f"font-family: {MONO}; font-size: 14px; font-weight: 600; color: {A}; text-decoration: underline; "
                f"text-underline-offset: 3px")
    return (f"font-family: {SANS}; font-size: 14px; font-weight: 600; color: {t['action']}; text-decoration: underline; "
            f"text-underline-offset: 3px")


def text_link(theme, label, href):
    """A link that stands on its own line ("See all 3 options", "Show all 29 steps"): underlined, in a 44 px box."""
    return (f'<a href="{esc(href)}" style="display: inline-flex; align-items: center; min-height: 44px; {_link_skin(theme)}; '
            f'white-space: nowrap">{esc(label)}</a>')


def empty_state(theme, caption, sentence, link=None, phone=False, small=True, fill=False):
    """The calm empty panel with its next step, inside drawn_state; caption names the case ("When nothing matches").

    link: (text, href); the text is a phrase with no closing period, and every empty state has one. The
    link is one unit: it moves to a line of its own rather than break inside, and wraps only when it is
    wider than the panel. small=True (the board default) keeps a lone state within 760 on the desktop,
    so it reads as a note under the page, not as a section. fill=True lets the panel grow to its row,
    for two states side by side in columns(..., stretch=True), which end on one line.
    """
    t = look(theme)
    px = is_px(theme)
    a = ""
    if link:
        a = (f' <a href="{esc(link[1])}" style="display: inline-block; max-width: 100%; color: {A if px else t["action"]}; '
             f'font-weight: 600; text-decoration: underline; text-underline-offset: 3px">{esc(link[0])}</a>')
    if px:
        box = (f"padding: {16 if phone else 24}px; background: {t['surface']}; border: 2px dashed {t['line']}; "
               f"font-family: {MONO}; font-size: 14px; line-height: 1.6; color: {t['ink']}")
    else:
        box = (f"padding: {16 if phone else 24}px; border-radius: 12px; background: {t['panel']}; border: 1px dashed #CFC6B6; "
               f"font-family: {SANS}; font-size: 15px; line-height: 1.5; color: {t['ink']}")
    width = 760 if (small and not phone) else None
    return drawn_state(theme, caption, f'<div style="{box}">{esc(sentence)}{a}</div>', fill=fill, width=width)


def breadcrumb(theme, items, phone=False):
    """The path line above a deal title. items: (label, href or None). Links are 44 tall.

    The path stops at the leaf label on both widths ("Find a deal / Things To Do / Tours"): the h1 right
    under it names the deal, so the title never repeats in the path.
    """
    t = look(theme)
    px = is_px(theme)
    font = f"font-family: {MONO}; font-size: 13px" if px else f"font-family: {SANS}; font-size: 14px"
    parts = []
    for label, href in items:
        if href:
            parts.append(f'<a href="{esc(href)}" style="display: inline-flex; align-items: center; min-height: 44px; text-decoration: none; '
                         f'color: {A if px else t["action"]}; white-space: nowrap">{esc(label)}</a>')
        else:
            parts.append(f'<span style="color: {t["muted"]}; overflow-wrap: anywhere">{esc(label)}</span>')
    slash = f'<span aria-hidden="true" style="color: {t["muted"]}">/</span>'
    return (f'<nav aria-label="Path" style="display: flex; flex-wrap: wrap; align-items: center; column-gap: 8px; {font}">'
            f'{slash.join(parts)}</nav>')


def _tag_glyph(theme):
    """The promo tag: lab a stroked tag with rounded caps, pixel a stepped tag on a 9 by 8 grid (no curve in pixel)."""
    t = look(theme)
    if is_px(theme):
        cells = [(3, 1, 6, 6), (2, 2, 1, 4), (1, 3, 1, 2)]
        rects = "".join(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{t["promo"]}"></rect>' for x, y, w, h in cells)
        hole = f'<rect x="4" y="3" width="1" height="2" fill="{t["promo_tint"]}"></rect>'
        return (f'<svg width="18" height="16" viewBox="0 0 9 8" shape-rendering="crispEdges" aria-hidden="true" '
                f'style="flex-shrink: 0; margin-top: 2px">{rects}{hole}</svg>')
    return (f'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B93A22" stroke-width="2" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink: 0; margin-top: 2px">'
            f'<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"></path><circle cx="7.5" cy="7.5" r="1.5"></circle></svg>')


def promo_note(theme, sentence):
    """The promo sentence as a note, where a deal page shows it beside the price (never as the price)."""
    t = look(theme)
    px = is_px(theme)
    if px:
        skin = f"background: {t['promo_tint']}; border: 2px solid {t['promo_line']}"
        font = f"font-family: {MONO}; font-size: 13px; line-height: 1.5"
    else:
        skin = f"background: {t['promo_tint']}; border: 1px solid {t['promo_line']}; border-radius: 10px"
        font = f"font-family: {SANS}; font-size: 13px; line-height: 1.45"
    return (f'<div style="display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; {skin}">{_tag_glyph(theme)}'
            f'<span style="{font}; color: {t["ink"]}">{esc(sentence)}</span></div>')


def price_block(theme, pay, original, save=None, pct=None, promo=None, phone=False):
    """The deal page's price: You pay (the page's display figure), the original struck, the saving, the promo note."""
    t = look(theme)
    px = is_px(theme)
    if px:
        fig = (f'<span data-label="You pay" style="font-family: {PRESS}; font-size: {22 if phone else 28}px; line-height: 1.3; '
               f'color: {A}; text-shadow: {_sh(3)}">{esc(pay)}</span>')
    else:
        fig = pay_figure(theme, pay, 36 if phone else 44)
    row = (f'<div style="display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap">{_you_pay_label(theme)}{fig}'
           f'{struck(theme, original, 16)}</div>')
    pill = save_pill(theme, save, pct) if save else ""
    note = promo_note(theme, promo) if promo else ""
    return f'<div style="display: flex; flex-direction: column; gap: 10px">{row}{pill}{note}</div>'


BUY_NOTE = "You pay on Groupon's checkout page. Groupon sends the voucher."


def buy_box(theme, option, pay, original, save=None, pct=None, promo=None, href="#", more=None, note=BUY_NOTE,
            title="The cheapest option", phone=False):
    """The deal page's answer: the option's name, its price block, the page's one primary "Get checkout link".

    Under the button the voucher note and `more` ((label, href), "See all 3 options") as a 44 px text
    link. The card grows to its row, so the button lines up with the foot of the photo beside it.
    """
    t = look(theme)
    px = is_px(theme)
    nfont = (f"font-family: {MONO}; font-weight: 600; font-size: 15px; line-height: 1.4" if px
             else f"font-family: {SANS}; font-weight: 600; font-size: 16px; line-height: 1.35")
    name = f'<div style="{nfont}; color: {t["ink"]}; overflow-wrap: anywhere">{esc(option)}</div>'
    price = price_block(theme, pay, original, save, pct, promo, phone=phone)
    btn = button(theme, "Get checkout link", full=True, href=href)
    tail = card_note(theme, note) if note else ""
    if more:
        tail += f'<div>{text_link(theme, more[0], more[1])}</div>'
    act = f'<div style="margin-top: auto; display: flex; flex-direction: column; gap: 12px">{btn}<div>{tail}</div></div>'
    box = card(theme, f'{name}{price}{act}', title=title, phone=phone, gap=16)
    return box.replace('min-width: 0">', 'min-width: 0; height: 100%; box-sizing: border-box">', 1)


def option_row(theme, o, phone=False, kind="primary", href=None):
    """One option of a deal with its own checkout button. o: title, pay, original, save, pct, sellable, promo (number).

    The price line is "You pay", the price at the row size (Plex Mono 16, phone 18; 600 lab, 700 pixel,
    as rank_rows), the original and "You save". o["label"] is the label of the tile that names this
    option ("Biggest saving"): the saving becomes the filled save pill led by that label, as on a card.
    kind="secondary" when the page already carries its primary action (the buy box). o["note"] puts
    "In the box above" in place of the button, for the option the buy box already sells: a check in
    `--action`, since it is the answer, not a dead end. An option that cannot be sold says "Not
    available right now" in muted text and has no button.
    """
    t = look(theme)
    px = is_px(theme)
    sep = _sep(t)
    line = promo_line(theme, o["sentence"]) if o.get("sentence") else ""
    tfont = f"font-family: {MONO}; font-weight: 600; font-size: 14px" if px else f"font-family: {SANS}; font-weight: 600; font-size: 15px"
    if o.get("label"):
        saving = save_pill(theme, o["save"], o["pct"], phone=phone, label=o["label"], align="baseline")
    else:
        saving = (f'<span style="font-family: {MONO}; font-size: 13px; color: {t["save"]}; white-space: nowrap">'
                  f'You save {esc(o["save"])} · {esc(o["pct"])}</span>')
    info = (f'<div style="display: flex; flex-direction: column; gap: 6px; min-width: 0; flex: 1"><div style="{tfont}; color: {t["ink"]}; '
            f'overflow-wrap: anywhere">{esc(o["title"])}{line}</div><div style="display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap">'
            f'{_you_pay_label(theme)}<span data-label="You pay" style="font-family: {MONO}; font-weight: {700 if px else 600}; '
            f'font-size: {18 if phone else 16}px; color: {t["ink"]}; white-space: nowrap">{esc(o["pay"])}</span>'
            f'{struck(theme, o["original"], 13)}{saving}</div></div>')
    if not o.get("sellable", True):
        act = f'<span style="font-size: 14px; color: {t["muted"]}">Not available right now</span>'
    elif o.get("note"):
        act = (f'<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; '
               f'color: {t["action"]}">{_tone_glyph(theme, "pass", t["action"])}{esc(o["note"])}</span>')
    else:
        act = button(theme, "Get checkout link", kind=kind, full=phone, href=href)
    if phone:
        return f'<div style="display: flex; flex-direction: column; gap: 12px; padding: 14px 0; border-bottom: {sep}">{info}{act}</div>'
    return (f'<div style="display: flex; align-items: center; gap: 20px; padding: 16px 0; border-bottom: {sep}">{info}'
            f'<div style="flex-shrink: 0">{act}</div></div>')


def option_list(theme, options, phone=False, kind="primary", href=None, title=None):
    """The option rows in a card; the first row drops its top padding (the card's is above it)."""
    rows = [option_row(theme, o, phone, kind=kind, href=href) for o in options]
    if rows:
        pad = 14 if phone else 16
        rows[0] = rows[0].replace(f"padding: {pad}px 0", f"padding: 0 0 {pad}px", 1)
    return card(theme, f'<div style="display: flex; flex-direction: column">{"".join(rows)}</div>', title=title, phone=phone)


def _pin(theme):
    t = look(theme)
    if is_px(theme):
        cells = [(5, 1, 6, 1), (4, 2, 8, 1), (3, 3, 10, 6), (4, 9, 8, 1), (5, 10, 6, 1), (6, 11, 4, 1), (7, 12, 2, 2)]
        rects = "".join(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{A}"></rect>' for x, y, w, h in cells)
        hole = f'<rect x="7" y="5" width="2" height="2" fill="{t["surface"]}"></rect>'
        return (f'<svg width="16" height="16" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true" '
                f'style="flex-shrink: 0; margin-top: 2px">{rects}{hole}</svg>')
    return (f'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="{t["action"]}" stroke-width="2" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink: 0; margin-top: 2px">'
            f'<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"></path><circle cx="12" cy="9.5" r="2.5"></circle></svg>')


def location_list(theme, locations):
    """A deal's addresses as rows: a pin (lab stroked, pixel stepped), the place's name, the street line under it.

    locations: (name, street). No rule above the first row or under the last, so the list sits in its card.
    """
    t = look(theme)
    px = is_px(theme)
    sep = _sep(t)
    nfont = f"font-family: {MONO}; font-weight: 600; font-size: 14px" if px else f"font-family: {SANS}; font-weight: 600; font-size: 15px"
    afont = f"font-family: {MONO}; font-size: 13px; line-height: 1.5" if px else f"font-family: {SANS}; font-size: 14px; line-height: 1.45"
    rows = []
    for i, (name, street) in enumerate(locations):
        rule = f"border-top: {sep}; " if i else ""
        rows.append(f'<li style="{rule}display: flex; gap: 12px; align-items: flex-start; padding: {12 if i else 0}px 0 {0 if i == len(locations) - 1 else 12}px">'
                    f'{_pin(theme)}<div style="display: flex; flex-direction: column; gap: 2px; min-width: 0">'
                    f'<span style="{nfont}; color: {t["ink"]}; overflow-wrap: anywhere">{esc(name)}</span>'
                    f'<span style="{afont}; color: {t["muted"]}; overflow-wrap: anywhere">{esc(street)}</span></div></li>')
    return f'<ul style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column">{"".join(rows)}</ul>'
