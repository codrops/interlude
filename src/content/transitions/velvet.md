---
group: shaders
order: 5
summary: 'A red stage curtain is drawn across the page, and drawn back on the next one.'
poster: ../../assets/transitions/velvet.jpg
posterAlt: 'The velvet transition halfway: a red curtain with deep folds drawn over the right of the home page, the rest of the page dimmed.'
---

On the click, a red curtain is drawn in from the right, its top leading and its hem trailing a little behind, while the page beside it dims, like a theatre's lights. While the next page loads, its folds sway. Then it's drawn back to the right, and the next page appears from the left, brightening. Going back looks the same.

A shader draws the curtain: its edge, the hem trailing most when it moves fastest, and folds that bunch up as the cloth gathers, lit from the upper left with a soft sheen. It keeps drawing while the page is covered, so the folds keep moving during the wait.
