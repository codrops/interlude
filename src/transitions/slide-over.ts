/**
 * Slide over: once the next page is ready, it slides up over this one, which
 * steps back into the dark. On "back" the same movement plays backwards.
 * Nothing moves while the next page loads: the demo's loader shows if that
 * takes a while (`src/components/Loader.astro`).
 *
 * An example of the old and new pages on screen together, like Barba's `sync`
 * mode: `keepOldPage()` keeps a still copy of the old page in the layer, in
 * front of the page. Going forward, the real new page slides in under the
 * copy, and the copy is clipped away just ahead of the new page's edge; going
 * back, the new page comes forward as a copy too (`copyPage()`), under the old
 * one sliding away.
 *
 * Needs: `src/lib/interlude/old-page.ts`.
 */
import { gsap } from 'gsap';
import { defineTransition, panel, type TransitionContext } from '../lib/interlude';
import { copyPage, keepOldPage, oldPage, pageBlocks, pageColor } from '../lib/interlude/old-page';

// Settings
const SLIDE = { duration: 1.1, ease: 'expo.inOut' }; // the new page sliding over, the old one stepping back
const BACK = { scale: 0.9, dim: 0.6 }; // how far the old page steps back (dim: 0 not at all, 1 black)

/** Forward: the real new page slides up over the copy of the old one, which steps back. */
function slideOver(context: TransitionContext, stage: HTMLElement, old: HTMLElement) {
  const height = window.innerHeight;
  return (
    gsap
      .timeline({ defaults: SLIDE })
      // The real new page (header, main, footer) slides in from below. `clearProps` hands it back to its CSS at the end.
      .fromTo(pageBlocks(context), { y: height }, { y: 0, clearProps: 'transform' }, 0)
      // The stage is clipped away from the bottom, with the same timing, so
      // the new page shows wherever it has arrived: it seems to slide over.
      .fromTo(
        stage,
        { clipPath: 'inset(0px 0px 0px 0px)' },
        { clipPath: `inset(0px 0px ${height}px 0px)` },
        0
      )
      // The old page steps back into the dark, as one movement with the slide.
      .to(old, { scale: BACK.scale }, 0)
      .to(old.lastElementChild, { opacity: BACK.dim }, 0)
  );
}

/** Back: the copy of the old page slides down and away, and a copy of the new one comes forward from where it had stepped back. */
function slideAway(context: TransitionContext, stage: HTMLElement, old: HTMLElement) {
  // The old page leaves the stage, to slide away on top of everything…
  context.root.append(old);
  // …and the new page takes its place on it, as a still copy (the real one is
  // under the layer), stepped back and in the dark.
  const next = panel(context, { style: { background: pageColor(), overflow: 'hidden' } });
  next.append(copyPage(context));
  const dim = panel(context);
  next.append(dim);
  stage.append(next);

  return (
    gsap
      .timeline({ defaults: SLIDE })
      // The last number of each step is when it starts: all together.
      .fromTo(old, { y: 0 }, { y: window.innerHeight }, 0)
      .fromTo(next, { scale: BACK.scale }, { scale: 1 }, 0)
      .fromTo(dim, { opacity: BACK.dim }, { opacity: 0 }, 0)
  );
}

export default defineTransition({
  name: 'slide-over',
  solidCover: false, // the old page's copy does the covering
  // The new page arrives whole, like a sheet: its content doesn't come in on its own.
  entrance: false,

  // Nothing moves yet: the copy stands in for the page, exactly as it was,
  // while the next one loads. Returning nothing, it's covered right away.
  leave(context) {
    // Back to front: a dark stage the page will step back onto…
    const stage = panel(context);
    // …the old page, a still copy…
    const old = keepOldPage(context);
    stage.append(old);
    // …and a dark film over it, that will fade in to darken it.
    const dim = panel(context, { style: { opacity: '0' } });
    old.append(dim);
  },

  enter(context) {
    const old = oldPage(context);
    // No old page (a first load with `revealOnLoad`): just fade in.
    if (!old) return gsap.fromTo(panel(context), { opacity: 1 }, { opacity: 0, ...SLIDE });
    const stage = old.parentElement!;
    return context.direction === 'back'
      ? slideAway(context, stage, old)
      : slideOver(context, stage, old);
  },
});
