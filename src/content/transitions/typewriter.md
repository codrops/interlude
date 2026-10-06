---
group: overlays
order: 6
summary: "A black sheet types the site's tagline in a grid, then erases it."
poster: ../../assets/transitions/typewriter.jpg
posterAlt: 'The typewriter transition halfway: a black sheet with a grid of the tagline in white, typed in to different lengths.'
---

On the click, a black sheet comes in, and a grid of cells types the tagline, character by character, in a wave from left to right. While the next page loads, the cursors of the finished cells blink. Then the cells erase in the same wave, and the sheet fades away. Neither page's content moves.

The characters aren't split into elements, which would mean thousands of them. Each cell is one element, and GSAP tweens two numbers per cell, how many characters are typed and how many erased; the cell shows that slice of the phrase.

Inspired by the type animation of The Manifest, by Studio Freight, shared by [Lídia Santos](https://www.linkedin.com/posts/inventorylidia_too-often-in-the-creative-world-we-see-the-activity-7431778963980443648-jglF).
