/**
 * Corner: once the next page is ready, a red rectangle, then a black one, then
 * a window onto the next page grow from the top left corner. On "back" the
 * same plays in reverse.
 *
 * The rectangles and the window are panels cut with `clip-path`, a beat apart.
 * Both pages are on screen at once: `keepOldPage()` keeps a still copy of the
 * old page and `copyPage()` makes one of the next, shown in the window. When
 * the window fills the screen, the layer goes and the real page underneath is
 * the same.
 *
 * Needs: `src/lib/interlude/old-page.ts`.
 * Inspired by a post by Oli on X: https://x.com/olvhrs/status/1899756396897333632
 */
import { gsap } from 'gsap';
import { defineTransition, panel, type TransitionContext } from '../lib/interlude';
import { copyPage, keepOldPage, oldPage, pageColor } from '../lib/interlude/old-page';

// Settings
const GROW = { duration: 0.9, ease: 'expo.inOut' }; // each rectangle growing from the corner (going back, shrinking into it)
const SHIFT = 0.1; // how far up and to the left the page inside the window starts, as a share of the screen's size: it slides to its place as the window grows (0 for none)
const STAGGER = 0.12; // seconds between the three starting: the red rectangle, the black one, then the window
const DARK = '#0c0c0c'; // the black rectangle
// The red of the site (`--red`), or this: a transition copied into another site still has a colour.
const RED =
  getComputedStyle(document.documentElement).getPropertyValue('--red').trim() || '#ff4d1c';

// A rectangle is a full-screen panel cut with `clip-path: inset(top right bottom left)`.
// Both ends are given to each tween (`fromTo`): the browser shortens the values it
// reports, which GSAP couldn't match with four.
const CORNER = 'inset(0% 100% 100% 0%)'; // nothing: a point at the top left
const FULL = 'inset(0% 0% 0% 0%)'; // the whole screen

/** Forward: the red and the black rectangles grow over the old page, then the window onto the next page. */
function open(context: TransitionContext) {
  const red = panel(context, { style: { background: RED, clipPath: CORNER } });
  const black = panel(context, { style: { background: DARK, clipPath: CORNER } });
  const view = panel(context, {
    style: { background: pageColor(), overflow: 'hidden', clipPath: CORNER },
  });
  const next = copyPage(context); // the next page, still, at full size
  view.append(next);
  const { clientWidth: width, clientHeight: height } = context.root;
  return (
    gsap
      .timeline()
      .fromTo(red, { clipPath: CORNER }, { clipPath: FULL, ...GROW }, 0)
      .fromTo(black, { clipPath: CORNER }, { clipPath: FULL, ...GROW }, STAGGER)
      .fromTo(view, { clipPath: CORNER }, { clipPath: FULL, ...GROW }, STAGGER * 2)
      // The page slides inside the window, so the two don't move as one: the
      // same time and ease, from up and to the left to exactly in place.
      .fromTo(next, { x: -width * SHIFT, y: -height * SHIFT }, { x: 0, y: 0, ...GROW }, STAGGER * 2)
  );
}

/** Back, the same film in reverse: the page you're leaving shrinks first, then the black, then the red. */
function close(context: TransitionContext, old: HTMLElement) {
  // The red and the black go under the old page's copy, which is the window now.
  const red = panel(context, { style: { background: RED, clipPath: FULL } });
  const black = panel(context, { style: { background: DARK, clipPath: FULL } });
  context.root.insertBefore(red, old);
  context.root.insertBefore(black, old);
  // The page copy is the last thing `keepOldPage()` puts in the window.
  const page = old.lastElementChild;
  const { clientWidth: width, clientHeight: height } = context.root;
  return gsap
    .timeline()
    .fromTo(old, { clipPath: FULL }, { clipPath: CORNER, ...GROW }, 0)
    .fromTo(page, { x: 0, y: 0 }, { x: -width * SHIFT, y: -height * SHIFT, ...GROW }, 0)
    .fromTo(black, { clipPath: FULL }, { clipPath: CORNER, ...GROW }, STAGGER)
    .fromTo(red, { clipPath: FULL }, { clipPath: CORNER, ...GROW }, STAGGER * 2);
}

export default defineTransition({
  name: 'corner',
  solidCover: false, // the old page's copy does the covering
  // The next page arrives whole, in its window: its content doesn't come in on its own.
  entrance: false,

  // Nothing moves yet: the copy stands in for the page, exactly as it was,
  // while the next one loads. Returning nothing, it's covered right away.
  leave(context) {
    keepOldPage(context);
  },

  enter(context) {
    const old = oldPage(context);
    // No old page (a first load with `revealOnLoad`): the dark cover just fades.
    if (!old) {
      const fade = panel(context);
      return gsap.fromTo(fade, { opacity: 1 }, { opacity: 0, duration: 0.5, ease: 'power1.out' });
    }
    old.style.clipPath = FULL; // so it can be cut away on the way back
    return context.direction === 'back' ? close(context, old) : open(context);
  },
});
