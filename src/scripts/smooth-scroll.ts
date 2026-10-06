/**
 * Smooth scrolling with Lenis: one of the demo's design choices, not part of
 * Interlude. To scroll natively, remove its `<script>` from
 * `src/layouts/BaseLayout.astro`.
 *
 * Interlude's events keep it in step with the transitions (at the end of the
 * file). One instance lasts the whole visit: Lenis drives the window's own
 * scroll, which survives page swaps.
 */
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const layer = document.querySelector<HTMLElement>('[data-interlude]');
let lenis: Lenis | null = null;

/** On, unless the visitor prefers reduced motion (an OS setting, which can change during a visit). */
function update() {
  if (motion.matches) {
    lenis?.destroy();
    lenis = null;
  } else if (!lenis) {
    lenis = new Lenis({ autoRaf: true, anchors: true });
    // Started during a transition, or on a first page rendered covered
    // (Interlude's `revealOnLoad`): still until the page is shown.
    if (layer && layer.dataset.state !== 'idle') lenis.stop();
  }
}

/** Matches Lenis to the page's current height and scroll position. */
function sync() {
  lenis?.resize();
  lenis?.scrollTo(window.scrollY, { immediate: true, force: true });
}

update();
motion.addEventListener('change', update);

// A navigation starts: no scrolling under the cover.
document.addEventListener('interlude:leave', () => lenis?.stop());
// The new page is in, scrolled where the router put it (the top, or where you
// were when going back): catch up.
document.addEventListener('astro:after-swap', sync);
// The page is shown: scroll again.
document.addEventListener('interlude:idle', () => {
  sync();
  lenis?.start();
});
