/**
 * Columns: bars rise one after another to cover the page, then carry on up,
 * in the same order, to reveal the next one. On "back" they run from the right.
 */
import { gsap } from 'gsap';
import { defineTransition, panel, sign, type TransitionContext } from '../lib/interlude';

// Settings
const LEAVE = { duration: 0.7, ease: 'power2.inOut' }; // each bar, covering
const ENTER = { duration: 0.7, ease: 'power2.out' }; // each bar, revealing
const STAGGER = 0.06; // seconds between one bar and the next
const BARS = 5; // how many bars across the screen
const BARS_SMALL = 3; // on screens narrower than 768px

/** Builds the bars side by side, each a panel of its own. */
function bars(context: TransitionContext) {
  const count = window.innerWidth < 768 ? BARS_SMALL : BARS;
  return Array.from({ length: count }, (_, i) =>
    panel(context, {
      style: {
        left: `${(i / count) * 100}%`,
        // A hair wider than their share, so no seams show between them.
        width: `calc(${100 / count}% + 1px)`,
      },
    })
  );
}

/** One bar after another: from the left, or from the right going back. */
const stagger = (context: TransitionContext) => ({
  each: STAGGER,
  from: sign(context) > 0 ? ('start' as const) : ('end' as const),
});

export default defineTransition({
  name: 'columns',
  entrance: 0.2, // the page's content starts coming in 0.2 s into enter()

  // The bars rise from below the screen until they meet the top.
  leave(context) {
    return gsap.fromTo(
      bars(context),
      { yPercent: 100 },
      { yPercent: 0, ...LEAVE, stagger: stagger(context) }
    );
  },

  // New bars, covering at first, carry on up and off the top.
  enter(context) {
    return gsap.fromTo(
      bars(context),
      { yPercent: 0 },
      { yPercent: -100, ...ENTER, stagger: stagger(context) }
    );
  },
});
