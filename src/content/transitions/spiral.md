---
group: shaders
order: 4
summary: 'A dark spiral spreads from where you clicked, with a red glow along its edge.'
poster: ../../assets/transitions/spiral.jpg
posterAlt: 'The spiral transition halfway: a dark spiral arm sweeping over the home page from the bottom left, with a soft red glow along its edge.'
---

On the click, a dark spiral spreads from the pointer until it covers the page, its arms turning faster towards the centre, with a red glow and a thin pale line along its edge. Once the next page is ready, a hole opens from the same spot, with the same glow, and pushes the dark out past the edges.

A shader turns each point's angle around the click by an amount that grows towards the centre, so the edge spirals. Smoky noise, turned the same way, roughens it and makes the glow flicker.
