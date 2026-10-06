/**
 * Wipe: a panel slides in from the right and carries on out to the left,
 * pushing the page along, which comes back in behind it as a whole. Mirrored
 * on "back".
 */
import { gsap } from 'gsap';
import { defineTransition, panel, sign } from '../lib/interlude';

// Settings
const LEAVE = { duration: 0.9, ease: 'power2.inOut' }; // covering
const ENTER = { duration: 0.9, ease: 'power2.out' }; // revealing
const PUSH = 80; // px the content is pushed along

export default defineTransition({
  name: 'wipe',
  entrance: false, // the page itself moves in behind the panel: its content doesn't come in on its own

  leave(context) {
    const s = sign(context); // 1 forward, -1 back: flips the direction
    const el = panel(context);
    return (
      gsap
        // `defaults`: every step of this timeline uses LEAVE's duration and ease.
        .timeline({ defaults: LEAVE })
        // The panel slides in from off the right edge…
        .fromTo(el, { xPercent: 100 * s }, { xPercent: 0 })
        // …pushing the page to the left as it fades. `0`: at the same time.
        .to(context.content, { x: -PUSH * s, opacity: 0 }, 0)
    );
  },

  enter(context) {
    const s = sign(context);
    const el = panel(context);
    return (
      gsap
        .timeline({ defaults: ENTER })
        // The panel carries on out to the left…
        .fromTo(el, { xPercent: 0 }, { xPercent: -100 * s })
        // …and the new page follows it in from the right. `clearProps` removes
        // the inline styles once it's done, so the page's own CSS takes over again.
        .fromTo(
          context.content,
          { x: PUSH * s, opacity: 0 },
          { x: 0, opacity: 1, clearProps: 'transform,opacity' },
          0
        )
    );
  },
});
