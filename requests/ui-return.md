# Requests from ui-return

## app.css: return-page heading icon (nice to have, not blocking)
Return.dc.html and ReturnWaitingPhone.dc.html put a 48px circular blue check icon (confirmed) or a
spinner icon (waiting) to the left of the "Thank you" heading, in a row with the h1 and lead paragraph
stacked to its right. I did not add classes for this layout because src/ui/components/** and
public/static/app.css are not mine to change. If you want the pixel match, a small `.return-head`
(flex row, gap 16px, align-items center) plus `.return-head-copy` (flex column, gap 4px) in app.css
would let ui-return wrap the existing h1/.lead pair without changing their own styles. Optional: I
built the page with plain h1/.lead only, which already reads correctly without it.
