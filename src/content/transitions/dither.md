---
group: shaders
order: 1
summary: 'Squares fill the screen from big to small, each one coming in as a pattern of dots.'
poster: ../../assets/transitions/dither.jpg
posterAlt: 'The dither transition halfway: big dark blocks and smaller squares in dot patterns of different densities over the home page.'
---

On the click, big blocks come in first, then smaller and smaller squares fill the gaps between them until the screen is covered. Each square starts as a sparse pattern of dots, like the greys of a 1-bit image, and fills in to solid. Once the next page is ready, it runs the other way: the smallest squares thin out and go first, the big blocks last.

A shader draws three sizes of squares on the same grid, each with its own moment to come in. The dots are ordered dithering: a fixed pattern of thresholds, so any shade becomes an even pattern of dots.
