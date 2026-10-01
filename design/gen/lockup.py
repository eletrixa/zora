"""The lockup boards: the header as it will appear, the lockup at 2x, the switch's states, the phone header.

Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
Module:  design/gen/lockup.py
Deps:    design/gen/common.py
Tested:  python3 design/gen/build.py lockup, then node design/gen/shots.js lockup
"""
import common as c

GEOMETRY = {
    "lab": [
        "Header 72 tall, white, 1 px rule under it, 56 px gutters.",
        "Mark 28 x 28, 12 to the wordmark (Sora 700 18, +0.02em).",
        "Rule 1 x 24 in line colour, 16 on each side.",
        "Switch 32 tall in a 44 hit area: panel track, 1 px line, radius 10, 3 px inset.",
        "Segments 24 tall, radius 7, 10 px sides, glyph 8, gap 6, Plex Sans 600 13.",
        "Current segment indigo, white text; the other muted, no fill.",
        "Phone: row 60 (mark 24, wordmark 15), switch at the right edge; nav row 44 under it.",
    ],
    "pixel": [
        "Header 72 tall, #0F1016, 2 px rule under it, 56 px gutters; the skyline under it.",
        "Mark 32 x 32 on a 16 grid (2 px cells), 12 to the wordmark (Silkscreen 700 16, +0.12em).",
        "Rule 2 x 24 in line colour, 16 on each side.",
        "Switch 32 tall in a 44 hit area: #0F1016 track, 2 px line, square, 3 px black shadow.",
        "Segments 28 tall, 10 px sides, 2 px divider, glyph 8, Silkscreen 12 caps +0.08em.",
        "Current segment amber, #14151C text; the other muted, no fill.",
        "Phone: row 60 (mark 32, wordmark 11), switch at the right edge; nav row 44 under it.",
    ],
}


def caption(theme, text):
    return f'<div style="margin-bottom: 10px">{c._mini_label(theme, text)}</div>'


def frame(theme, inner, pad=16):
    """A swatch of `theme`'s ground, so a state drawn in the other look sits on its own ground."""
    t = c.look(theme)
    return (f'<div style="background: {t["ground"]}; border: 1px solid {"#E3DDD2" if theme == "lab" else "#3A3D4D"}; '
            f'padding: {pad}px; display: inline-flex">{inner}</div>')


def hit_area(inner):
    """The switch with its 44 px hit area outlined, as a guide."""
    return f'<div style="outline: 1px dashed #8A879C; outline-offset: 0; display: inline-flex">{inner}</div>'


def at2x(inner):
    return f'<div style="zoom: 2; display: inline-flex">{inner}</div>'


def board(theme):
    other = "pixel" if theme == "lab" else "lab"
    t = c.look(theme)
    head = c.header(theme, "top-deals")
    big = at2x(c.lockup(theme, page="Lockup"))
    states = [
        (f"This look: {theme.capitalize()} current", frame(theme, at2x(hit_area(c.switch(theme))))),
        # The other look keeps its own accent: the canvas editor only drives this board's look.
        (f"The other look: {other.capitalize()} current",
         frame(other, at2x(hit_area(c.switch(other).replace(c.A, c.look(other)["accent_hex"]))))),
        (f"Keyboard focus on {other.capitalize()}", frame(theme, at2x(hit_area(c.switch(theme, focus=True))))),
    ]
    state_row = "".join(f'<div style="display: flex; flex-direction: column">{caption(theme, cap)}{box}</div>' for cap, box in states)
    phone = f'<div style="width: 390px; border: 1px solid {t["line"]}; flex-shrink: 0">{c.header(theme, "top-deals", phone=True)}</div>'
    font = f"font-family: {c.MONO}; font-size: 12px; line-height: 1.7; color: {t['muted']}"
    notes = "".join(f"<li>{c.esc(line)}</li>" for line in GEOMETRY[theme])
    spec = f'<ul style="margin: 0; padding-left: 18px; {font}">{notes}</ul>'
    body = (
        f'{head}<main style="padding: 32px 56px; display: flex; flex-direction: column; gap: 28px">'
        f'<div>{caption(theme, "The lockup at 2x: mark, wordmark (the home link), rule, switch")}{big}</div>'
        f'<div>{caption(theme, "The switch at 2x, the dashed line is the 44 px hit area")}'
        f'<div style="display: flex; gap: 24px; align-items: flex-end">{state_row}</div></div>'
        f'<div>{caption(theme, "The phone header at 390, and the geometry")}'
        f'<div style="display: flex; gap: 40px; align-items: flex-start">{phone}{spec}</div></div>'
        f'</main>'
    )
    return body


def boards():
    lab_h, px_h = 672, 760
    return {
        "Lockup": (c.page("lab", "Lockup and look switch, lab look", 1280, lab_h, board("lab"), both_fonts=True), 1280, lab_h,
                   "Lockup and look switch, lab"),
        "LockupPixel": (c.page("pixel", "Lockup and look switch, pixel look", 1280, px_h, board("pixel"), both_fonts=True), 1280, px_h,
                        "Lockup and look switch, pixel"),
    }
