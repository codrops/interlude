---
group: shaders
order: 3
summary: 'A red blot spreads from where you clicked, then the next page opens from the same spot.'
poster: ../../assets/transitions/ink.jpg
posterAlt: 'The ink transition halfway: a red blot with a ragged edge covering most of the home page.'
---

On the click, a red blot spreads from the pointer with a ragged edge until it fills the screen. Once the next page is ready, a ragged hole opens from the same spot and pushes the ink out past the edges.

A shader measures each point's distance from the click, roughened with noise, against a level that grows as the cover goes on. The red is the site's (`--red`).
