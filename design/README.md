<!-- Module: design/README.md · Tested: n/a -->
# Design source

The screens live on a Claude Design canvas: (private Claude Design canvas, link not published) (private to the owner).
The Top deals boards come from a second canvas made for that page (two concepts were drawn; the lab look won and was
sharpened by a three-lens critique panel; the prompts are in `docs/ai-builder/prompts/04-design-prompt.md`). That
second canvas holds loop 5's rounds 1 and 2 as rows R1 and R2. Round 3 could not be added there: the session that ran
it was signed in to another Claude account, which cannot open that canvas. A third canvas in that account holds all
three rounds, round 3 on top, and is the master for every loop 5 board:
(private Claude Design canvas, link not published) (private to the owner). `project/` is a copy of the canvas
files: `gen.py` wrote the first pass and still draws the loop 3 boards, and the loop 5 boards come from
`design/gen/`, built from `design/LANGUAGE.md`. After Robert edits either canvas, the copy here is refreshed
before the UI lanes start.

Look: warm ivory ground `#FBF8F3`, indigo ink `#1E1F4B`, indigo `#2B2D6E` for actions, coral `#FF6B4A` as the one
accent (never under white text), blue and orange for pass and fail. Type: Sora for headings, IBM Plex Sans for
text, IBM Plex Mono for figures. Every number on the canvas is sample data and is tagged so.

| Page | Lab | Pixel | Phone | Pixel phone | Page in the app |
|---|---|---|---|---|---|
| Top deals | `TopDeals.dc.html` | `TopDealsPixel.dc.html` | `TopDealsPhone.dc.html` | `TopDealsPixelPhone.dc.html` | `src/ui/pages/top-deals.tsx` |
| Find a deal | `Finder.dc.html` | `FinderPixel.dc.html` | `FinderPhone.dc.html` | `FinderPixelPhone.dc.html` | `src/ui/pages/finder.tsx` |
| Price truth | `PriceTruth.dc.html` | `PriceTruthPixel.dc.html` | `PriceTruthPhone.dc.html` | `PriceTruthPixelPhone.dc.html` | `src/ui/pages/price-truth.tsx` |
| Partner scorecard | `Scorecard.dc.html` | `ScorecardPixel.dc.html` | `ScorecardPhone.dc.html` | `ScorecardPixelPhone.dc.html` | `src/ui/pages/scorecard.tsx` |
| Deal page | `Deal.dc.html` | `DealPixel.dc.html` | `DealPhone.dc.html` | `DealPixelPhone.dc.html` | `src/ui/pages/deal.tsx` |

The board generator lives in `design/gen/`, its spec is `design/LANGUAGE.md`, and each of the three design
rounds is archived under `design/rounds/` (`r1/`, `r2/`, `r3/`).
