---
group: overlays
order: 5
summary: 'A circle grows from where you clicked, then the next page opens from the same spot.'
poster: ../../assets/transitions/circle.jpg
posterAlt: 'The circle transition halfway: a large dark circle growing over the home page from the link that was clicked.'
---

On the click, a circle grows from the pointer (or from the middle of the link, when it's chosen with the keyboard) until it covers the page. It stays while the next page loads, then a hole opens from the same spot and grows until the cover is a ring off the screen.

The circle is a `clip-path` growing to the distance of the farthest corner, so it always covers the screen. The hole is a CSS mask on the same panel.
