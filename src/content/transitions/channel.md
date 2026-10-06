---
group: shaders
order: 7
summary: 'Changing channels on an old TV: the page breaks into static, then the next one tunes in.'
poster: ../../assets/transitions/channel.jpg
posterAlt: 'The channel transition halfway: bands of black-and-white static across the home page, which shows through between them.'
---

On the click, bands of static flicker in over the page, with scanlines and a bright bar rolling down, and the page jumps sideways more and more until the screen is all static. The static keeps moving while the next page loads. Then the next page tunes in: the bands thin out and flicker away, and the page jumps less and less until it holds still.

A shader draws the static, a random grey for each grain, thirty times a second, in bands of rows that turn on and off. A shader can't move the page, so the jumps are CSS, on still copies of the pages under it.
