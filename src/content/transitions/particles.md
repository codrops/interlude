---
group: shaders
order: 6
summary: "Particles drift in and form the site's name, then burst away."
poster: ../../assets/transitions/particles.jpg
posterAlt: 'The particles transition halfway: light and red dots forming the word Interlude on a dark sheet.'
---

On the click, a dark sheet comes in and thousands of particles drift in from beyond the edges, settling into the site's name. While the next page loads, they keep breathing, and the pointer pushes them aside. Once the page is ready, they burst outwards and the sheet goes.

A WebGL scene of its own rather than a single shader. Every particle moves on the GPU, working out its place from where it starts, its place in the word and a random number, so the JavaScript only animates four values.
