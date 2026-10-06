/**
 * Circle: grows from wherever the navigation started (the click, or the
 * focused link) until it covers the page. Then the next page opens from that
 * same spot, through a hole that grows until the cover is a ring off the
 * screen.
 */
import { gsap } from 'gsap';
import { defineTransition, farthestCorner, panel } from '../lib/interlude';

// Settings
const LEAVE = { duration: 0.7, ease: 'power3.inOut' }; // the circle growing
const ENTER = { duration: 0.7, ease: 'power3.out' }; // the hole growing

export default defineTransition({
  name: 'circle',
  entrance: false, // the page is simply there once uncovered: its content doesn't come in on its own

  leave(context) {
    const { x, y } = context.origin; // where the navigation started, in px
    // A panel clipped to a circle, from nothing to big enough to reach every corner.
    return gsap.fromTo(
      panel(context),
      { clipPath: `circle(0px at ${x}px ${y}px)` },
      { clipPath: `circle(${farthestCorner(x, y)}px at ${x}px ${y}px)`, ...LEAVE }
    );
  },

  enter(context) {
    const { x, y } = context.origin;
    const el = panel(context);
    // A transparent disc in the panel, as big as `--hole`: the page shows through it.
    const mask = `radial-gradient(circle at ${x}px ${y}px, transparent var(--hole), #000 calc(var(--hole) + 1px))`;
    el.style.setProperty('mask-image', mask);
    el.style.setProperty('-webkit-mask-image', mask);
    // GSAP animates the CSS variable, so the hole grows until the panel is gone.
    return gsap.fromTo(
      el,
      { '--hole': '0px' },
      { '--hole': `${farthestCorner(x, y)}px`, ...ENTER }
    );
  },
});
