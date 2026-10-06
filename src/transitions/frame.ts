/**
 * Frame: once the next page is ready, a red rectangle grows from the middle of
 * the screen over the old page, and a beat behind it a window onto the next
 * page, so the next page grows inside a red frame. On "back" it plays in
 * reverse. Nothing moves while the next page loads: the loader
 * (`src/components/Loader.astro`), if the site has it, shows if that takes a
 * while.
 *
 * Both pages are on screen at once, like in `slide-over`: `keepOldPage()` keeps
 * a still copy of the old page in the layer, and `copyPage()` makes one of the
 * next page for the window, which uncovers it at full size rather than scaling
 * it. When the window fills the screen, the layer goes and the real page is
 * underneath, the same.
 *
 * Needs: `src/lib/interlude/old-page.ts`.
 * Inspired by the page transition on Benoît Marzouvanlian's site, benmarzouvanlian.com.
 */
import { gsap } from 'gsap';
import { defineTransition, panel, type TransitionContext } from '../lib/interlude';
import { copyPage, keepOldPage, oldPage, pageColor } from '../lib/interlude/old-page';

// Settings
// Each rectangle growing to fill the screen. It starts fast (`expo.out`): from a height of
// 0, a slow start would flicker.
const GROW = { duration: 1.2, ease: 'expo.out' };
const SHRINK = { duration: GROW.duration * 0.7, ease: 'power3.inOut' }; // each rectangle shrinking, going back
const STAGGER = 0.15; // seconds the window starts after the red rectangle
const START_WIDTH = 0.3; // how wide they start, as a share of the screen's width (their height starts at 0)
// The red of the site (`--red`), or this: a transition copied into another site still has a colour.
const RED =
  getComputedStyle(document.documentElement).getPropertyValue('--red').trim() || '#ff4d1c';

// A rectangle is a full-screen panel cut with `clip-path: inset(top right bottom left)`.
// Both ends are given to each tween (`fromTo`): the browser shortens the values it
// reports (`inset(50% 32.5%)`), which GSAP couldn't match with four.
const SIDE = ((1 - START_WIDTH) / 2) * 100; // % cut from the left and the right at the start
const SMALL = `inset(50% ${SIDE}% 50% ${SIDE}%)`; // a flat strip in the middle
const FULL = 'inset(0% 0% 0% 0%)'; // the whole screen

/** Forward: the red rectangle grows over the old page, then the window onto the next page. */
function open(context: TransitionContext) {
  const red = panel(context, { style: { background: RED, clipPath: SMALL } });
  const view = panel(context, {
    style: { background: pageColor(), overflow: 'hidden', clipPath: SMALL },
  });
  view.append(copyPage(context)); // the next page, still, at full size
  return gsap
    .timeline()
    .fromTo(red, { clipPath: SMALL }, { clipPath: FULL, ...GROW }, 0)
    .fromTo(view, { clipPath: SMALL }, { clipPath: FULL, ...GROW }, STAGGER);
}

/** Back, the same film in reverse: the page you're leaving shrinks first, then the red. */
function close(context: TransitionContext, old: HTMLElement) {
  // The red goes under the old page's copy, which is the window now.
  const red = panel(context, { style: { background: RED, clipPath: FULL } });
  context.root.insertBefore(red, old);
  return gsap
    .timeline()
    .fromTo(old, { clipPath: FULL }, { clipPath: SMALL, ...SHRINK }, 0)
    .fromTo(red, { clipPath: FULL }, { clipPath: SMALL, ...SHRINK }, STAGGER);
}

export default defineTransition({
  name: 'frame',
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
    // No old page (a first load with `revealOnLoad`): the red just fades.
    if (!old) {
      const fade = panel(context, { style: { background: RED } });
      return gsap.fromTo(fade, { opacity: 1 }, { opacity: 0, duration: 0.5, ease: 'power1.out' });
    }
    old.style.clipPath = FULL; // so it can be cut away on the way back
    return context.direction === 'back' ? close(context, old) : open(context);
  },
});
