"""Builds the loop 5 artboards from the page modules, writes their previews and lays them out on the canvas.

Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
Module:  design/gen/build.py
Deps:    Python 3 standard library; design/gen/common.py and the page modules beside it
Tested:  design/gen/lockup.py (python3 design/gen/build.py lockup, then design/gen/shots.js)

python3 design/gen/build.py <page>          one page: its boards and previews, nothing else
python3 design/gen/build.py                 every page module present, then canvas.json
python3 design/gen/build.py --archive r<N>  the full build, then a copy of every board in design/rounds/r<N>/
"""
import importlib.util
import json
import re
import shutil
import sys
from pathlib import Path

GEN = Path(__file__).resolve().parent
DESIGN = GEN.parent
PROJECT = DESIGN / "project"
PREVIEW = DESIGN / "preview"
ROUNDS = DESIGN / "rounds"
CANVAS = PROJECT / "canvas.json"

PAGES = ["top_deals", "finder", "price_truth", "scorecard", "deal", "lockup"]

# Canvas rows for the regenerated boards.
LAB_DESKTOP_Y, PIXEL_DESKTOP_Y, PHONE_Y = 5000, 7800, 10600
DESKTOP_STEP, PHONE_STEP = 1360, 470
NOTES = {
    "loop5_lab": (LAB_DESKTOP_Y, "Loop 5: lab look"),
    "loop5_pixel": (PIXEL_DESKTOP_Y, "Loop 5: pixel look"),
    "loop5_phones": (PHONE_Y, "Loop 5: phones"),
}

sys.path.insert(0, str(GEN))  # page modules `import common`


def load_page(page):
    path = GEN / f"{page}.py"
    if not path.exists():
        print(f"skip {page}: design/gen/{page}.py is not there yet")
        return None
    spec = importlib.util.spec_from_file_location(f"zal_page_{page}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    if not hasattr(mod, "boards"):
        raise SystemExit(f"design/gen/{page}.py has no boards() function")
    boards = mod.boards()
    for name, value in boards.items():
        if not re.fullmatch(r"[A-Z][A-Za-z0-9]*", name):
            raise SystemExit(f"{page}: board name {name!r} must be a CamelCase file stem")
        if not (isinstance(value, tuple) and len(value) == 4):
            raise SystemExit(f"{page}: board {name} must be (html, width, height, title)")
    return boards


def board_look(html):
    m = re.search(r'data-theme="(lab|pixel)"', html)
    if m:
        return m.group(1)
    return "pixel" if "Silkscreen" in html else "lab"


def accent_of(html):
    m = re.search(r"data-props='([^']*)'", html)
    if not m:
        raise SystemExit("board has no data-props script, so its accent is unknown")
    props = json.loads(m.group(1).replace("&#39;", "'").replace("&amp;", "&"))
    return props["accent"]["default"]


def preview_of(html, page):
    """The board as a standalone page: the accent filled in, the canvas scripts removed."""
    out = html.replace("{{accent}}", accent_of(html))
    out = re.sub(r'<script src="\./support\.js"></script>\n?', "", out)
    out = re.sub(r"<script type=\"text/x-dc\"[\s\S]*?</script>\n?", "", out)
    out = out.replace('<meta charset="utf-8">', f'<meta charset="utf-8">\n<meta name="zal-page" content="{page}">', 1)
    if "{{" in out:
        raise SystemExit(f"{page}: a template placeholder other than {{{{accent}}}} is left in the preview")
    return out


def write_page(page, boards):
    PREVIEW.mkdir(parents=True, exist_ok=True)
    built = []
    for name, (html, w, h, title) in boards.items():
        (PROJECT / f"{name}.dc.html").write_text(html, encoding="utf-8")
        (PREVIEW / f"{name}.html").write_text(preview_of(html, page), encoding="utf-8")
        built.append({"page": page, "name": name, "w": w, "h": h, "title": title,
                      "look": board_look(html), "phone": w <= 480})
        print(f"wrote design/project/{name}.dc.html and design/preview/{name}.html ({w} x {h}, {len(html) // 1024} KB)")
    return built


def update_canvas(built):
    canvas = json.loads(CANVAS.read_text(encoding="utf-8"))
    regen = {f"{b['name']}.dc.html" for b in built}
    boards = {k: v for k, v in canvas.get("boards", {}).items() if k not in regen}
    order = [k for k in canvas.get("order", []) if k not in regen]
    rows = {
        "lab_desktop": [b for b in built if b["look"] == "lab" and not b["phone"]],
        "pixel_desktop": [b for b in built if b["look"] == "pixel" and not b["phone"]],
        "phones": [b for b in built if b["look"] == "lab" and b["phone"]] + [b for b in built if b["look"] == "pixel" and b["phone"]],
    }
    widths = {}
    for row, y, step in (("lab_desktop", LAB_DESKTOP_Y, DESKTOP_STEP), ("pixel_desktop", PIXEL_DESKTOP_Y, DESKTOP_STEP), ("phones", PHONE_Y, PHONE_STEP)):
        x = 0
        for b in rows[row]:
            key = f"{b['name']}.dc.html"
            boards[key] = {"x": x, "y": y, "w": b["w"], "h": b["h"], "title": b["title"]}
            order.append(key)
            if row != "phones" and b["h"] > PIXEL_DESKTOP_Y - LAB_DESKTOP_Y - 400:
                print(f"note: {b['name']} is {b['h']} px tall and reaches into the next canvas row")
            x += step
        n = len(rows[row])
        widths[row] = max((n - 1) * step + rows[row][-1]["w"], 1280) if n else 1280
    placed = {f"{b['name']}.dc.html" for b in built}
    for key, v in boards.items():
        if key in placed:
            continue
        for other in placed:
            o = boards[other]
            if v["x"] < o["x"] + o["w"] and o["x"] < v["x"] + v["w"] and v["y"] < o["y"] + o["h"] and o["y"] < v["y"] + v["h"]:
                print(f"note: the kept board {key} overlaps {other}; it clears once {key} is regenerated or moved")
    canvas["boards"] = boards
    canvas["order"] = order
    notes = canvas.setdefault("notes", {})
    for key, row in (("loop5_lab", "lab_desktop"), ("loop5_pixel", "pixel_desktop"), ("loop5_phones", "phones")):
        y, text = NOTES[key]
        notes[key] = {"x": 0, "y": y - 300, "text": text, "kind": "title1", "maxW": widths[row]}
    CANVAS.write_text(json.dumps(canvas, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"rewrote design/project/canvas.json: {len(built)} boards placed, {len(boards) - len(built)} kept")


def full_build():
    built = []
    for page in PAGES:
        boards = load_page(page)
        if boards:
            built += write_page(page, boards)
    update_canvas(built)
    return built


def main(argv):
    if not argv:
        full_build()
        return
    if argv[0] == "--archive":
        if len(argv) != 2 or not re.fullmatch(r"r\d+", argv[1]):
            raise SystemExit("usage: python3 design/gen/build.py --archive r<N>")
        built = full_build()
        dest = ROUNDS / argv[1]
        dest.mkdir(parents=True, exist_ok=True)
        for b in built:
            shutil.copy2(PROJECT / f"{b['name']}.dc.html", dest / f"{b['name']}.dc.html")
        print(f"archived {len(built)} boards in design/rounds/{argv[1]}/")
        return
    page = argv[0]
    if page not in PAGES:
        raise SystemExit(f"unknown page {page!r}; the pages are {', '.join(PAGES)}")
    boards = load_page(page)
    if boards:
        write_page(page, boards)


if __name__ == "__main__":
    main(sys.argv[1:])
