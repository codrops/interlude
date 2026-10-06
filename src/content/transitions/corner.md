---
group: page
order: 9
summary: 'A red rectangle and a black one grow from the top left corner, then the next page grows over them.'
poster: ../../assets/transitions/corner.jpg
posterAlt: "The corner transition halfway: a red rectangle over the home page, a black one growing over it from the top left corner, and the next page's window just starting in that corner."
---

Nothing moves until the next page is ready; if that takes a while, a loader shows at the cursor. Then a red rectangle grows from the top left corner until it covers the screen, a black one a beat behind it, and the next page a beat after that, in a window growing from the same corner, the page inside sliding a little into place. Going back, the same movement plays backwards.

Each rectangle is a panel cut with `clip-path`. The next page in the window is a still copy at full size, which the window uncovers.

Inspired by [a post by Oli](https://x.com/olvhrs/status/1899756396897333632) on X.
