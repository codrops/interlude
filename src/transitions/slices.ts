/**
 * Slices: once the next page is ready, the page breaks into columns, and in
 * each one the next page pushes the old one up and out, column after column,
 * from left to right (downwards, from right to left, on "back"). Nothing moves
 * while the next page loads (the loader,
 * `src/components/Loader.astro`, if the site has it, shows if that takes a
 * while).
 *
 * Both pages are still copies here, one per column: the old page's, kept in
 * the layer through the swap (`keepOldPage()`), and the new page's, made once
 * it's in (`copyPage()`). When the last column lands, the copies go, and the
 * real page is underneath, the same.
 *
 * Needs: `src/lib/interlude/old-page.ts`.
 */
import { gsap } from 'gsap';
import { defineTransition, panel, sign, type TransitionContext } from '../lib/interlude';
import { copyPage, keepOldPage, oldPage, pageColor } from '../lib/interlude/old-page';

// Settings
const COLUMNS = 5; // how many columns across the screen
const COLUMNS_SMALL = 3; // on screens narrower than 768px
const PUSH = { duration: 0.9, ease: 'power3.inOut' }; // each column's push
const STAGGER = 0.08; // seconds between one column and the next
const GAP = 0; // px of the transition colour between the old and new slice: 0 for none, try 16
const FADE = { duration: 0.4, ease: 'power1.out' }; // without an old page (`revealOnLoad`)

/** One column: its box, and the slices of the old and new pages in it. */
interface Column {
  box: HTMLElement;
  old: HTMLElement;
  next?: HTMLElement;
}

let columns: Column[] = [];

/**
 * A slice: a column-sized frame showing a copy's stretch of the page (the
 * column at 200px shows the page from 200px on). The frame is what moves, and
 * it clips to its column, so the browser only moves a column-sized picture,
 * not a whole page: ten of those would be heavy enough to flicker.
 */
function slice(copy: HTMLElement, left: number, width: number) {
  const frame = document.createElement('div');
  Object.assign(frame.style, {
    position: 'absolute',
    inset: '0',
    overflow: 'hidden',
    willChange: 'transform', // ready to move before it does: no repaint on the first frame
  });
  const page = document.createElement('div');
  Object.assign(page.style, {
    position: 'absolute',
    top: '0',
    left: `${-left}px`,
    width: `${width}px`,
    height: '100%',
    background: pageColor(), // the copy's own blocks don't cover everything: the body's colour isn't in it
  });
  page.append(copy);
  frame.append(page);
  return frame;
}

export default defineTransition({
  name: 'slices',
  solidCover: false, // the copies do the covering
  entrance: false, // the new page arrives as it is, in its slices

  // Nothing moves yet: the old page, cut into columns, stands in for itself
  // while the next one loads. Returning nothing, it's covered right away.
  leave(context) {
    const kept = keepOldPage(context); // the old page's styles, kept through the swap, and a first copy
    const firstCopy = kept.lastElementChild as HTMLElement;
    const { clientWidth: width } = context.root;
    const count = width < 768 ? COLUMNS_SMALL : COLUMNS;
    const columnWidth = width / count;

    columns = Array.from({ length: count }, (_, i) => {
      const left = i * columnWidth;
      const box = document.createElement('div');
      Object.assign(box.style, {
        position: 'absolute',
        top: '0',
        bottom: '0',
        left: `${left}px`,
        width: `${columnWidth + 1}px`, // a hair wider, so no seams show
        overflow: 'hidden',
        // Shows in the gap, if there's one. Without, the page's colour: where
        // the two slices meet at fractions of a pixel, no dark hairline blinks.
        background: GAP > 0 ? 'var(--interlude-color)' : pageColor(),
      });
      // The first column takes the copy `keepOldPage()` made; the others get their own.
      const old = slice(i === 0 ? firstCopy : copyPage(context), left, width);
      box.append(old);
      kept.append(box);
      return { box, old };
    });
  },

  enter(context: TransitionContext) {
    // No old page (a first load with `revealOnLoad`): just fade in.
    if (!oldPage(context) || !columns.length) {
      return gsap.fromTo(panel(context), { opacity: 1 }, { opacity: 0, ...FADE });
    }
    const { clientWidth: width, clientHeight: height } = context.root;
    const s = sign(context); // 1: up, left to right; -1: down, right to left
    const order = s > 0 ? columns : [...columns].reverse();

    const timeline = gsap.timeline();
    order.forEach((column, i) => {
      // The new page's slice for this column, waiting just below it (above, going back).
      const left = parseFloat(column.box.style.left);
      column.next = slice(copyPage(context), left, width);
      column.box.append(column.next);
      // The push: the old slice goes, the new one follows right behind it.
      timeline
        .to(column.old, { y: -(height + GAP) * s, ...PUSH }, i * STAGGER)
        .fromTo(column.next, { y: (height + GAP) * s }, { y: 0, ...PUSH }, i * STAGGER);
    });
    return timeline;
  },
});
