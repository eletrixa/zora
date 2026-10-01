<!-- Module: docs/ai-builder/prompts/16-ceo-review-site.md · Tested: n/a -->
# Prompt 16: the CEO review of the whole site, by a second model

From the coding session to a second model (GPT through the codex CLI, read-only sandbox), run inside
the public snapshot directory with the screenshots attached. Nothing else is sent: no notes, no
transcripts, no private files. The answer is saved verbatim in `docs/ops/loop5/ceo-review-N.txt`.

> You are the CEO of a company that sells local deals, and this is the lab one of your builders made on
> your Partner Storefront API. On the first day you asked for a Top deals page: "So that we can show
> this somewhere, could you build a category picker (fine to limit it to Things To Do), a city picker
> (the top 50 cities is enough), and have it as a page listing the top 20 deals on Groupon in the chosen
> city and category, sortable by the absolute amount saved and by the percentage? For the price, show
> only the original one and then the fully final one after the discount is applied. We can then present
> this as an example of an AI Builder project: export the prompts that show how it was made, and put the
> source on git." After the hand-over you asked for the second round: "Build the second design as
> well, and put the switch between the two looks on the logo, so the site also has the Zora pixel look.
> Make it great: run several rounds of design, looped. Unify the website: Find a deal must reach the
> quality of Top deals, so unify the filters and make them great. Make Top deals the home page. Make
> Price truth and the Scorecard better. Run the CEO review on the whole site."
>
> Your working directory is the public repository of what was built. Start with `README.md`,
> `docs/ai-builder/README.md`, `docs/ai-builder/prompts/README.md`, `docs/ops/loop5.md` and
> `design/LANGUAGE.md`; open anything else you need. The folder `review/` holds every page as served
> (`home.html`, `find.html`, `price-truth.html`, `scorecard.html`, `deal.html`, and the same five with
> `-pixel` for the second look), the acceptance run (`walkthrough.txt`) and the screenshots you were
> given (the five pages on a desktop in the lab look, the home page and the finder on a phone, and the
> home page and Price truth in the pixel look).
>
> Review the whole site as that CEO would, for showing it to people as one product built with AI.
> Score each lens 1 to 5 as a whole number, with a short quote from the repository as the citation:
> - Impact obsessed: does the site do what both asks said, and is it worth showing as one product?
> - Simplify to scale: does one authoritative page say who it is for, what it does, where it lives and how
>   success is measured; do the pages share one language; could a builder reproduce it from the prompts?
> - Disciplined: does every number and claim have a source; are there tests, acceptance criteria, design
>   rounds with scores, and run records?
> - Speed over comfort: is it shipped and live, is the time from each ask to live stated, is anything
>   half-built?
> - Extreme ownership: is there an owner, are the open items and honesty notes stated, are the next steps
>   clear?
>
> Then answer: the single strongest reason you would reject this; what is asserted without evidence; what you
> would need to know that this does not tell you; overall stars 1 to 5; a two-sentence narrative; the three
> changes that would raise the score most.
>
> Answer as one JSON object with the fields: lenses (an object with the five lens names, each holding
> score and citation), reject_reason, unevidenced, missing, stars, narrative, top_changes (an array of three
> strings). No text outside the JSON.
