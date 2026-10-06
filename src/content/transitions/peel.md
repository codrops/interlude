---
group: page
order: 4
summary: 'The page turns over from its corner, like a sheet of paper.'
poster: ../../assets/transitions/peel.jpg
posterAlt: 'The peel transition halfway: the home page turning over along a diagonal fold from the bottom right corner, the back of the sheet light grey and the next page in its shadow.'
---

Nothing moves until the next page is ready; if that takes a while, a loader shows at the cursor. Then a fold sweeps from the bottom-right corner to the top-left one, and the page turns over in one go. The back of the sheet is a little darker, and the new page under it is in its shadow until the sheet has gone. Going back, the previous page turns back over this one, like a page in a book.

It's all flat: the old page is a still copy cut along the fold with `clip-path`, over the real new page. The back of the sheet is the turned part mirrored across the fold, worked out again as the fold moves.

Inspired by the page turn on [eminente.art](https://eminente.art/).
