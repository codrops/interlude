/**
 * Keeping the old page on screen, for transitions that show the old and new
 * pages together, like Barba's `sync` mode (see `stack.ts`, `slide-over.ts`).
 * Astro swaps the whole page in one go, so `keepOldPage()` puts a still copy of
 * the old one in the layer, where it lasts through the swap, and `enter`
 * animates it over the real new page. The transition sets `solidCover: false`:
 * the copy does the covering. Step by step: docs/how-it-works.md, section 9.
 *
 * Nothing in the copy runs, loads, plays, or answers to the page's ids, so it's
 * built node by node: with `cloneNode(true)`, a copied Astro island (or any
 * custom element) would start up again and hydrate a second component, an
 * iframe would load again, a video would restart, and a canvas would be blank.
 *
 * It carries `<body>`'s classes and data attributes, so per-page styles (the
 * demo's `data-ground`) still reach it after the swap. Write those as
 * `[data-…]` or `.class` selectors, not `body…`: the copy is a `<div>`.
 *
 * Limits: it's a still picture (a video stops on its frame), a web component's
 * shadow DOM isn't copied (its children are), and CSS that targets ids or
 * `<html>`'s attributes doesn't reach the copy. A page-wide rule only the old page had
 * (`<style is:global>`) also applies to the new one until the transition is
 * over.
 *
 * Not exported from `index.ts`, so it's only downloaded with the transitions
 * that import it.
 */
import { panel } from './helpers';
import type { TransitionContext } from './types';

/** Marks the copy in the layer, so `enter` can find it again. */
const MARK = 'data-old-page';

/** CSS properties a hovered element keeps in the copy: the copy can't be hovered. */
const HOVER = [
  'transform',
  'translate',
  'scale',
  'rotate',
  'opacity',
  'color',
  'background-color',
  'text-decoration-color',
];

/** Computed styles a stand-in takes over, so it sits where the original did. */
const PLACE = [
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'z-index',
  'float',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'grid-row-start',
  'grid-row-end',
  'grid-column-start',
  'grid-column-end',
  'align-self',
  'justify-self',
  'vertical-align',
  'border-radius',
  'transform',
];

/**
 * `<body>`'s layout, given to the copy: a body that's a flex column (to keep
 * the footer at the bottom, say) would otherwise lay its copy out differently.
 */
const LAYOUT = [
  'display',
  'flex-direction',
  'flex-wrap',
  'justify-content',
  'align-items',
  'align-content',
  'row-gap',
  'column-gap',
  'grid-template-columns',
  'grid-template-rows',
  'min-height',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
];

/**
 * Puts a still copy of the page in the layer, on a full-screen panel in the
 * page's colour, and returns that panel. Call it in `leave`, before anything
 * moves; animate the panel (or what's in it) as you like.
 */
export function keepOldPage(context: TransitionContext) {
  const kept = panel(context, { style: { background: pageColor(), overflow: 'hidden' } });
  kept.setAttribute(MARK, '');
  // The old page's styles too: Astro swaps the <head> with the page, and those
  // only the old page had would go, leaving the copy unstyled. Shared ones are
  // the same rules twice, until the transition is over and the layer emptied.
  for (const style of document.head.querySelectorAll('style, link[rel="stylesheet"]')) {
    kept.append(style.cloneNode(true));
  }
  kept.append(copyPage(context));
  return kept;
}

/**
 * The panel `keepOldPage()` made, in `enter`. `null` when there's none: the
 * first page with `revealOnLoad` has no old page, so have a fallback.
 */
export const oldPage = (context: TransitionContext) =>
  context.root.querySelector<HTMLElement>(`[${MARK}]`);

/**
 * The page's blocks: the children of `<body>` (header, main, footer…), not the
 * layer, nor `fixed` ones like a skip link or a loader, which stay put on screen.
 * `absolute` ones are blocks too (a header laid over a hero): in the copy, they
 * land where they were. What's copied, and what a transition moves to move the
 * whole real page.
 */
export function pageBlocks(context: TransitionContext) {
  return [...document.body.children].filter((el): el is HTMLElement => {
    if (!(el instanceof HTMLElement) || el.contains(context.root)) return false;
    return getComputedStyle(el).position !== 'fixed';
  });
}

/** The page's background colour: `<body>`'s, or `<html>`'s if the body has none. */
export function pageColor() {
  const transparent = (color: string) => color === 'transparent' || color === 'rgba(0, 0, 0, 0)';
  for (const el of [document.body, document.documentElement]) {
    const color = getComputedStyle(el).backgroundColor;
    if (!transparent(color)) return color;
  }
  return '#fff';
}

/**
 * A still copy of the page's blocks as they are now, placed where the page is
 * scrolled to, without the styles `keepOldPage()` keeps. For more copies: of
 * the old page in several pieces (in `leave`), or of the new page (in `enter`,
 * when its styles are in place). Put it in a positioned, page-sized box. See
 * `slices.ts`.
 */
export function copyPage(context: TransitionContext) {
  const copy = document.createElement('div');
  // <body>'s classes and data attributes: after the swap, <body> is the new
  // page's, and styles hung on the old one's would no longer reach the copy…
  for (const { name, value } of document.body.attributes) {
    if (name === 'class' || name.startsWith('data-')) copy.setAttribute(name, value);
  }
  // …and its layout, so the blocks sit where they do on the page.
  const body = getComputedStyle(document.body);
  for (const property of LAYOUT) copy.style.setProperty(property, body.getPropertyValue(property));
  const scrolled: Scrolled[] = [];
  for (const el of pageBlocks(context)) {
    const still = copyNode(el, scrolled);
    if (still) copy.append(still);
  }
  // A copied element starts scrolled to its start (a row of pictures, a code
  // block), and a scroll position only takes once it's laid out: put them back
  // on the next frame, by when the transition has added the copy to the page,
  // before anything is painted. And again after the swap: Astro moves the layer
  // into the new page's <body>, and moving an element resets the scrolling
  // inside it.
  if (scrolled.length) {
    const restore = () => {
      for (const [el, left, top] of scrolled) el.scrollTo(left, top);
    };
    requestAnimationFrame(restore);
    document.addEventListener('astro:after-swap', restore, { once: true });
  }
  copy.inert = true; // nothing in it can be clicked, focused or read out
  // Moved up by the scroll position, so it lines up with the page underneath.
  Object.assign(copy.style, { position: 'absolute', inset: `${-window.scrollY}px 0 auto` });
  return copy;
}

/** A copied element, and the scroll position its original had. */
type Scrolled = [Element, number, number];

/**
 * A still copy of a node and everything in it, or `null` for what isn't seen
 * (scripts, templates). Copies of scrolled elements are added to `scrolled`.
 */
function copyNode(node: Node, scrolled: Scrolled[]): Node | null {
  if (!(node instanceof Element)) return node.cloneNode(); // text and comments
  if (node instanceof HTMLScriptElement || node instanceof HTMLTemplateElement) return null;
  // A video or a canvas: the frame on screen now, painted once.
  if (node instanceof HTMLVideoElement || node instanceof HTMLCanvasElement) return frameOf(node);
  // Would load or play again: an empty box of the same size instead.
  if (node instanceof HTMLElement && node.matches('iframe, audio, embed, object')) {
    return standIn(node, 'div');
  }

  // A custom element the page has defined (an Astro island, a web component)
  // would start up again: a plain one in its place. The rest: the element alone,
  // without its children, which are copied the same way below.
  const copy = customElements.get(node.localName) ? plain(node) : (node.cloneNode() as Element);
  copy.removeAttribute('id'); // the page's ids stay unique
  copy.removeAttribute('data-entrance'); // the entrance would animate it
  if (copy instanceof HTMLImageElement) {
    copy.loading = 'eager'; // a lazy one would stay blank
    copy.decoding = 'sync'; // decoded before it's shown: no blank frame as the copy appears
  }
  // Hovered (the link just clicked, say): keep its hover look, or it would jump back.
  if (node.matches(':hover') && copy instanceof HTMLElement) {
    const computed = getComputedStyle(node);
    for (const property of HOVER) {
      copy.style.setProperty(property, computed.getPropertyValue(property));
    }
  }
  if (node.scrollLeft || node.scrollTop) scrolled.push([copy, node.scrollLeft, node.scrollTop]);
  for (const child of node.childNodes) {
    const childCopy = copyNode(child, scrolled);
    if (childCopy) copy.append(childCopy);
  }
  return copy;
}

/** A div in place of a custom element: its attributes, and the same display. */
function plain(el: Element) {
  const div = document.createElement('div');
  for (const { name, value } of el.attributes) div.setAttribute(name, value);
  div.style.display = getComputedStyle(el).display; // an Astro island's is `contents`
  return div;
}

/** An element of another kind in `el`'s place: its classes, its place in the layout, its size. */
function standIn<K extends 'div' | 'canvas'>(el: HTMLElement, tag: K) {
  const stand = document.createElement(tag);
  stand.className = el.className;
  const computed = getComputedStyle(el);
  for (const property of PLACE) {
    stand.style.setProperty(property, computed.getPropertyValue(property));
  }
  Object.assign(stand.style, {
    // An inline div would ignore its size.
    display: computed.display === 'inline' ? 'inline-block' : computed.display,
    width: `${el.offsetWidth}px`,
    height: `${el.offsetHeight}px`,
    flex: 'none',
    boxSizing: 'border-box',
  });
  return stand;
}

/** A canvas in a video's or a canvas's place, painted with what it shows now. */
function frameOf(el: HTMLVideoElement | HTMLCanvasElement) {
  const frame = standIn(el, 'canvas');
  const scale = Math.min(window.devicePixelRatio, 2); // sharp on high-density screens
  frame.width = Math.round(el.offsetWidth * scale);
  frame.height = Math.round(el.offsetHeight * scale);
  const [w, h] =
    el instanceof HTMLVideoElement ? [el.videoWidth, el.videoHeight] : [el.width, el.height];
  if (!w || !h || !frame.width || !frame.height) return frame; // nothing to paint yet

  // Fitted the way the CSS fits it: `cover` fills and crops, `contain` fits it
  // whole, anything else stretches it.
  const fit = getComputedStyle(el).objectFit;
  const fill = Math.max(frame.width / w, frame.height / h);
  const whole = Math.min(frame.width / w, frame.height / h);
  const [dw, dh] =
    fit === 'cover'
      ? [w * fill, h * fill]
      : fit === 'contain'
        ? [w * whole, h * whole]
        : [frame.width, frame.height];
  try {
    frame.getContext('2d')?.drawImage(el, (frame.width - dw) / 2, (frame.height - dh) / 2, dw, dh);
  } catch {
    // Not drawable (a lost WebGL context, say): left blank.
  }
  return frame;
}
