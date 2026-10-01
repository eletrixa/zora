<!-- Module: design/gen/README.md · Tested: n/a · How the loop 5 board generator works -->
# Board generator (loop 5)

1. `design/LANGUAGE.md` is the spec. `common.py` draws each of its parts for both looks; every helper takes `"lab"` or `"pixel"` first and `phone=True` for the 390 wide form.
2. One module per page (`top_deals`, `finder`, `price_truth`, `scorecard`, `deal`, `lockup`) defines `boards()`, a dict of name to `(html, width, height, title)`; names are `Finder`, `FinderPixel`, `FinderPhone`, `FinderPixelPhone`.
3. `python3 design/gen/build.py <page>` writes `design/project/<Name>.dc.html` and `design/preview/<Name>.html` (the accent filled in, the canvas scripts removed) and touches nothing else.
4. `python3 design/gen/build.py` builds every page module present, skips a missing one with a note, then rewrites `design/project/canvas.json` (loop 5 rows at y 5000 lab, 7800 pixel, 10600 phones).
5. `python3 design/gen/build.py --archive r<N>` does the full build and copies every board it wrote into `design/rounds/r<N>/`.
6. `node design/gen/shots.js [page]` screenshots the previews into `design/preview/shots/<Name>.png`; `ZAL_CHROME` names a Chromium binary and `NODE_PATH` a node_modules that holds playwright.
7. Each shot prints one JSON line: scroll width and height, where the content really ends against the stated height (`clippedBottom`), elements past the right edge (`overflowX`, `offenders`), the fonts that loaded.
8. Text arguments are escaped; wrap trusted markup in `raw(...)`. The accent is `{{accent}}` on every board, so never write its hex into a page module.
9. A designer never edits `common.py` in a round: a missing part lives in the page module and gets one line in `design/gen/requests/<page>.md`; the language step folds it in between rounds.
10. `design/gen.py` is the first generator and still owns the loop 3 boards (`Main`, `Checkout`, `Return`, `Login`).
