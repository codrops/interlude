---
group: shaders
order: 2
summary: 'Blotches spread and merge like burning paper, then holes burn through to the next page.'
poster: ../../assets/transitions/dissolve.jpg
posterAlt: 'The dissolve transition halfway: dark blotches with glowing red rims spreading over the home page.'
---

On the click, blotches appear all over the page and merge into a dark cover, with a glowing rim in the accent colour. Once the next page is ready, smaller holes burn through in other places, glowing at their edges, until the page is uncovered.

A shader compares a noise pattern with a level that rises as the cover goes on, and colours a thin band along the edge. The reveal uses a finer pattern, so new holes open rather than the blotches shrinking back.
