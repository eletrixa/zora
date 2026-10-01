<!-- Module: docs/ai-builder/prompts/12-ceo-review-prompt.md · Tested: n/a -->
# Prompt 12: the CEO review, by a second model

From the coding session to a second model (GPT through the codex CLI, read-only sandbox), run inside
the public snapshot directory with the two screenshots attached. Nothing else is sent: no notes, no
transcripts, no private files. The answer is saved verbatim in `docs/ops/loop4/ceo-review-N.txt`.

> You are the CEO who asked for this today. Your ask, in your own words: "So that we can show this
> somewhere, could you build a category picker (fine to limit it to Things To Do), a city picker (the top
> 50 cities is enough), and have it as a page listing the top 20 deals on Groupon in the chosen city and
> category, sortable by the absolute amount saved and by the percentage? For the price, show only the
> original one and then the fully final one after the discount is applied. We can then present this as an
> example of an AI Builder project: export the prompts that show how it was made, and put the source on git."
>
> Your working directory is the public repository of what was built. Start with `README.md`,
> `docs/ai-builder/README.md`, `docs/ai-builder/prompts/README.md` and `docs/ops/loop4.md`; open
> anything else you need. The folder `review/` holds the rendered page as served (`top-deals.html`), the
> acceptance run (`walkthrough.txt`) and the two screenshots you were given (desktop and phone).
>
> Review it as that CEO would, for showing it to people as an example of an AI Builder project. Score each
> lens 1 to 5 as a whole number, with a short quote from the repository as the citation:
> - Impact obsessed: does it do exactly what was asked, and is it worth showing?
> - Simplify to scale: does one authoritative page say who it is for, what it does, where it lives and how
>   success is measured; could a builder reproduce it from the prompts?
> - Disciplined: does every number and claim have a source; are there tests, acceptance criteria and run
>   records?
> - Speed over comfort: is it shipped and live, is the time from ask to live stated, is anything half-built?
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
