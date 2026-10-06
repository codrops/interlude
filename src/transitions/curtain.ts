/**
 * Curtain: a panel rises from the bottom to cover the page, and keeps rising
 * off the top to reveal the next one. The content drifts up with it.
 * On "back" it runs top to bottom.
 */
import { gsap } from 'gsap';
import { defineTransition, panel, sign } from '../lib/interlude';

// Settings
const LEAVE = { duration: 1, ease: 'power2.inOut' }; // covering
const ENTER = { duration: 1, ease: 'power2.out' }; // revealing
const DRIFT = 100; // px the content moves as it goes and comes

export default defineTransition({
  name: 'curtain',
  entrance: 0.2, // the page's content starts coming in 0.2 s into enter()

  leave(context) {
    const up = sign(context) > 0; // going back, everything runs the other way
    // The panel grows from the bottom edge (the top, going back)…
    const el = panel(context, { style: { transformOrigin: up ? '50% 100%' : '50% 0%' } });
    return (
      gsap
        // `defaults`: every step of this timeline uses LEAVE's duration and ease.
        .timeline({ defaults: LEAVE })
        .fromTo(el, { scaleY: 0 }, { scaleY: 1 })
        // …while the page drifts away and fades. `0`: at the same time as the panel.
        .to(context.content, { y: up ? -DRIFT : DRIFT, opacity: 0 }, 0)
    );
  },

  enter(context) {
    const up = sign(context) > 0;
    // The panel shrinks towards the top edge (the bottom, going back)…
    const el = panel(context, { style: { transformOrigin: up ? '50% 0%' : '50% 100%' } });
    return (
      gsap
        .timeline({ defaults: ENTER })
        .fromTo(el, { scaleY: 1 }, { scaleY: 0 })
        // …while the new page drifts in after it. `clearProps` removes the
        // inline styles once it's done, so the page's own CSS takes over again.
        .fromTo(
          context.content,
          { y: up ? DRIFT : -DRIFT, opacity: 0 },
          { y: 0, opacity: 1, clearProps: 'transform,opacity' },
          0
        )
    );
  },
});
