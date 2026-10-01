<!-- Module: docs/ai-builder/prompts/04-design-prompt.md · Tested: n/a -->
# Prompt 04: the Claude Design prompt

From the coding session to Claude Design (the Artifact design canvas), 2026-09-30. Written before the
design session opened and given as typed. Follow-up turns are appended below it.

> Make one canvas, "Zora Agent Lab: Top deals", with two artboards: **TopDeals** 1280 × 1500 and
> **TopDealsPhone** 390 × 1700. Use these tokens exactly, from the app's stylesheet: ivory ground `#FBF8F3`,
> ink `#1E1F4B`, muted `#54567A`, line `#E3DDD2`, panel `#F3EEE5`, white `#FFFFFF`, indigo `#2B2D6E` for the
> active control and the button, coral `#FF6B4A` only as the nav underline and in the logo, never under white
> text. Type: Sora 700 for the h1 (38 px) and 600 for the h2 (20 px), IBM Plex Sans for text (15 to 16 px),
> IBM Plex Mono for every figure. Google Fonts link for the three families.
>
> Header, same as the other Zora boards: white bar, 14 px 56 px padding, 1 px line beneath; the logo mark
> (three coral bars over an indigo arch on a coral base) with "Zora Agent Lab" in Sora 700 18 px; a nav of
> four links, gap 28: "Find deals", "Top deals" (active: ink colour, 3 px coral underline), "Price truth",
> "Partner scorecard" (inactive: muted, transparent underline). Phone header: the mark and a burger button.
>
> Desktop board, main padded 40 px 56 px 56 px, gap 28, top to bottom:
> 1. Title row: h1 "Top deals"; the lead in muted 16 px: "The 20 Groupon deals that save the most in one city
>    and one category, by amount or by percent. Saving means the original price minus the price you pay at
>    Groupon checkout. A promo code, where one exists, is a footnote."; at the right a dashed mono pill
>    "Sample data".
> 2. A white picker card (padding 20, 1 px line, radius 16) with three 220 px selects side by side, each with
>    a 13 px muted label above and a chevron drawn at the right: "Category" showing "Things To Do (9,812)",
>    "Within the category" showing "All of Things To Do", "City" showing "New York, NY (1,603)"; then an
>    indigo button "Show" (white text, 48 px tall, radius 10).
> 3. A white results section (padding 24, 1 px line, radius 16). Its head row: h2 "Top 20 in New York, NY:
>    Things To Do" on the left, and on the right a segmented control of two links in one 1 px outlined pill,
>    "By amount saved" filled indigo with white text, "By percent saved" white with muted text.
>    Below, a table with seven columns: "#", "Deal", "City", "Original", "You pay", "You save", "Saved";
>    header cells 12 px muted uppercase with a line beneath; rows 15 px with a 1 px line; the rank muted mono;
>    the deal title an indigo link, with a tiny superscript "promo" after it on rows 1, 3 and 5, and the option
>    title in 12 px muted on a second line; City in text; Original in mono, struck through, muted; You pay in
>    mono, weight 600; You save and Saved in mono. Six sample rows, for example:
>    1 · Escape Room for Four at Lockdown NYC · Escape Room for Four · New York, NY · $140.00 · $79.00 · $61.00 · 43.6 %
>    2 · Helicopter Tour of Manhattan · 15 minutes · New York, NY · $349.00 · $199.00 · $150.00 · 43.0 %
>    3 · Comedy Club Night for Two · Two tickets · New York, NY · $60.00 · $24.00 · $36.00 · 60.0 %
>    4 · Kayak Rental on the Hudson · Two hours · New York, NY · $90.00 · $55.00 · $35.00 · 38.9 %
>    5 · Museum Pass for Two · Any day · New York, NY · $58.00 · $29.00 · $29.00 · 50.0 %
>    6 · Bowling for Four at Pin Palace · Two hours · New York, NY · $72.00 · $45.00 · $27.00 · 37.5 %
>    Under the table an h3 "Promo codes" (Sora 600, 16 px) and a numbered list in 13 px muted whose numbers
>    are the row numbers 1, 3 and 5: "Type code ESCAPE20 at Groupon checkout to pay $63.20. Without it you
>    pay $79.00.", "Type code LAUGH10 at Groupon checkout to pay $21.60. Without it you pay $24.00.",
>    "Groupon may offer $26.10 at checkout. Expect to pay $29.00."
>    Then a freshness line in 13 px muted: "Category tags and the city list refresh daily at 00:30 UTC (last
>    walk 2026-10-01T00:52:03Z). Prices refresh every 3 hours; the next delta sync runs at 12:00 UTC."
> 4. Under a muted caption "When a pair has no discounted deal": the calm empty panel (panel colour, dashed
>    line, radius 12, padding 24) with the text "No discounted deals in Miami, FL for Escape Games. Try the
>    whole of Things To Do." where the last sentence is an indigo link.
>
> Phone board (390 wide, nothing wider): h1 28 px; the three pickers stacked full width inside the white
> card, the Show button full width; the sort control full width with two equal halves; the results as a
> list, one item per deal: the rank in a 36 px mono column on the left, then the title link, the option title
> in 12 px muted, and four lines "Original: $140.00" (the amount struck), "You pay: $79.00", "You save:
> $61.00", "Saved: 43.6 %", labels muted, figures mono; no city line; a 1 px line between items. Then the
> "Promo codes" list and the freshness line. Four items are enough.
>
> Every number on both boards is sample data. Keep the HTML plain: inline styles, no scripts.

## Turn 2, about 19:30 UTC, after the builder saw both concepts

The builder, on the canvas with a Zora pixel concept next to the lab-look concept: "Let's stay with the
lab design but make it better; it is boring, it needs to get better."

What changed on the lab-look boards (second pass): the three labelled selects became one sentence,
"Top 20 deals in [New York, NY] for [Things To Do] [any label] Show", set in Sora with a coral
underline under each choice; four stat tiles under it (biggest saving, typical saving, saved across
the top 20, promo codes); the top three deals as cards with a photo, a rank badge, the price to pay
large, the original struck and a coral-tinted "You save" pill; ranks 4 to 20 as the table, the Saved
column drawn as a small indigo bar with the percent; an eyebrow line "Product 4 · an AI Builder
showcase" over the title. Phone: the same, stacked.

## Turn 3, 19:40 UTC, the critique panel

Three review agents, one lens each, read the two second-pass artboards and answered the prompt below;
a fourth merged their findings into a ranked list. The prompt, verbatim:

> You review two HTML artboards of a web page called "Top deals" (desktop 1280 px and phone 390 px). The page
> lists the 20 Groupon deals with the largest discount in one city and one category, sortable by amount saved
> and by percent saved; each deal shows the original price struck through and the price the shopper pays; a
> promo code, where one exists, is a footnote sentence, never a price column. The page belongs to Zora Agent
> Lab and must keep its look: ivory ground #FBF8F3, ink #1E1F4B, muted #54567A, line #E3DDD2, panel #F3EEE5,
> indigo #2B2D6E for actions, coral #FF6B4A only as an accent line or in the logo, never under white text;
> Sora for headings, IBM Plex Sans for text, IBM Plex Mono for figures. It will be shown by a CEO to people
> as an example of what one builder and a coding agent shipped in a day. The builder's verdict on the first
> pass was "boring". Your lens: LENS. Read both files. Answer with at most eight findings, each with: title
> (under 10 words), why (two sentences, from the lens), change (the concrete markup or style change, specific
> enough to apply without asking), impact 1 to 5 (how much it lifts the page), effort 1 to 5 (1 = a style
> tweak, 5 = a new section). Do not propose emoji, gradients, animation, stock photos, a dark theme, a new
> palette or a new typeface. Do not propose removing the price rule or the footnotes. Every number on the
> boards is sample data; do not review the numbers.

Lenses: "the CEO who will show this page to people and wants it to look like a product, not an admin
table"; "a shopper on a phone who wants to find the best deal in ten seconds"; "a design craft reviewer
checking hierarchy, rhythm, contrast, touch targets and whether every element earns its place".

The merge prompt: "You receive the findings of three reviewers. Merge duplicates, drop anything that
breaks the constraints above, rank by impact divided by effort, and answer with the top eight changes,
each with the concrete change to apply and which reviewer lenses asked for it."

## Turn 4, 19:46 UTC, the third pass

Applied from the panel (the merged list is in the run record): rank 1 drawn as the winner (a coral
top rule, a taller photo panel, a wider card, an indigo "Best deal" pill); the stat tiles on the panel
colour with the biggest saving spanning two columns under a coral rule and the figures in indigo; the
heading with a coral rule; the sort control labelled "Sort" and set heavier; ranks 4 to 20 as ranked
rows instead of a spreadsheet table (no city column, the saving in coral ink, the percent as a bar);
the photo placeholder a monogram panel (the live page shows the deal's photo); the freshness line as
a footer; on the phone the deals come right after the picker and the tiles follow the top three, so the
first deal sits inside the first screen.
