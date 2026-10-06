/**
 * Carousel: the page zooms out into a row of the site's pages, the row slides
 * to the next one, and it zooms in to fill the screen.
 *
 * One strip of screen-sized cards, and a "camera" over it: the strip's scale
 * and position. Only the two ends are real pages, as still copies
 * (`keepOldPage()` for the old one, `copyPage()` for the next), so when the
 * camera ends on the next page the layer goes and the real page underneath is
 * the same. The cards on the way show only a name. The strip is read from the
 * links in the page (`LINKS`), in order.
 *
 * Needs: `src/lib/interlude/old-page.ts`.
 */
import { gsap } from 'gsap';
import { defineTransition, panel } from '../lib/interlude';
import { copyPage, keepOldPage, oldPage, pageColor } from '../lib/interlude/old-page';

// Settings
const ZOOM = 1.5; // how many times smaller the pages are in the overview
const GAP = 0.04; // space between two pages, as a share of the screen's width
const LEAVE = { duration: 0.9, ease: 'expo.inOut' }; // zooming out
const SLIDE = { base: 0.3, perPage: 0.07, max: 1.6, ease: 'power1.inOut' }; // sliding: seconds = base + perPage for each page crossed, at most max
const ENTER = { duration: 0.9, ease: 'expo.inOut' }; // zooming in
const OVERLAP = 0.6; // seconds the zoom in starts before the slide ends
// The links whose pages make up the strip, in order: the demo's header and its list of transitions.
const LINKS = '.header__name, .header__nav a, .index a';

/** A page in the strip: where it is, and the name its card shows. */
interface Page {
  path: string;
  label: string;
}

/** The strip, and the camera looking at it, from `leave` to `enter`. */
interface Scene {
  strip: HTMLElement;
  pages: Page[];
  camera: { scale: number; x: number }; // x: the point of the strip in the middle of the screen
  show: () => void; // puts the camera where `camera` says
  width: number;
  height: number;
  spacing: number; // from one page's left edge to the next one's
}

let scene: Scene | undefined;

/** A link's text, without what's hidden from screen readers (the list's numbers and punctuation). */
function labelOf(link: Element) {
  const copy = link.cloneNode(true) as Element;
  copy.querySelectorAll('[aria-hidden]').forEach((el) => el.remove());
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** The site's pages, from the links in this one: of this site, without a hash, once each. */
function pagesFromLinks() {
  const found = new Map<string, string>();
  for (const link of document.querySelectorAll<HTMLAnchorElement>(LINKS)) {
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.hash || found.has(url.pathname)) continue;
    found.set(url.pathname, labelOf(link));
  }
  return [...found].map(([path, label]): Page => ({ path, label }));
}

/** Sizes a card and puts it in the strip at position `index`. */
function place(card: HTMLElement, index: number, { width, height, spacing }: Scene) {
  Object.assign(card.style, {
    position: 'absolute',
    inset: 'auto',
    left: `${index * spacing}px`,
    top: '0',
    width: `${width}px`,
    height: `${height}px`,
  });
}

/** A card that only shows a page's name, in the site's own look. */
function nameCard(label: string) {
  const card = document.createElement('div');
  const { color, fontFamily } = getComputedStyle(document.body);
  card.textContent = label;
  Object.assign(card.style, {
    display: 'grid',
    placeItems: 'center',
    background: pageColor(),
    color,
    fontFamily,
    fontSize: '11vw',
    fontWeight: '600',
    letterSpacing: '-0.045em',
    lineHeight: '1',
    textAlign: 'center',
    overflow: 'hidden',
  });
  return card;
}

export default defineTransition({
  name: 'carousel',
  solidCover: false, // the strip does the covering
  // The next page arrives whole, in its card: its content doesn't come in on its own.
  entrance: false,

  // On the click: the old page's copy joins the strip, and the camera zooms out from it.
  leave(context) {
    const { clientWidth: width, clientHeight: height } = context.root;
    const spacing = width * (1 + GAP);
    const pages = pagesFromLinks();
    // Both ends are in the strip, even if no link in this page leads there.
    for (const path of [context.from.pathname, context.to.pathname]) {
      if (!pages.some((page) => page.path === path)) pages.push({ path, label: path });
    }

    // Back to front: the dark space the pages float in, with the strip in it…
    const space = panel(context, { style: { overflow: 'hidden' } });
    const strip = document.createElement('div');
    Object.assign(strip.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: `${pages.length * spacing}px`,
      height: `${height}px`,
      transformOrigin: '0 0',
    });
    space.append(strip);

    const here = pages.findIndex((page) => page.path === context.from.pathname);
    const current = {
      strip,
      pages,
      camera: { scale: 1, x: here * spacing + width / 2 },
      width,
      height,
      spacing,
      show() {
        // Scaled from the strip's corner, then moved so `x` is in the middle of the screen.
        const { scale, x } = this.camera;
        strip.style.transform = `translate(${width / 2 - scale * x}px, ${(height / 2) * (1 - scale)}px) scale(${scale})`;
      },
    } satisfies Scene;

    // …a card for each page: the old page's copy for this one, its name for the others.
    pages.forEach((page, i) => {
      const card = i === here ? keepOldPage(context) : nameCard(page.label);
      place(card, i, current);
      strip.append(card);
    });

    scene = current;
    current.show();
    return gsap.to(current.camera, {
      scale: 1 / ZOOM,
      ...LEAVE,
      onUpdate: () => current.show(),
    });
  },

  // The next page is ready: the camera slides to its card and zooms in on it.
  enter(context) {
    const old = oldPage(context);
    const current = scene;
    // No old page (a first load with `revealOnLoad`): the dark just fades.
    if (!old || !current) {
      const fade = panel(context);
      return gsap.fromTo(fade, { opacity: 1 }, { opacity: 0, duration: 0.5, ease: 'power1.out' });
    }
    scene = undefined;

    const { strip, pages, camera, width, spacing } = current;
    const target = pages.findIndex((page) => page.path === context.to.pathname);

    // The next page's card: a still copy of it, over its name card.
    const card = document.createElement('div');
    card.style.overflow = 'hidden';
    card.style.background = pageColor();
    card.append(copyPage(context));
    place(card, target, current);
    strip.append(card);

    const distance = Math.abs(
      target - pages.findIndex((page) => page.path === context.from.pathname)
    );
    const slide = Math.min(SLIDE.max, SLIDE.base + SLIDE.perPage * distance);
    return (
      gsap
        .timeline()
        // Its name gives way to the page itself.
        .fromTo(card, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0)
        .to(
          camera,
          {
            x: target * spacing + width / 2,
            duration: slide,
            ease: SLIDE.ease,
            onUpdate: () => current.show(),
          },
          0
        )
        // The zoom in starts a little before the slide ends: one movement.
        .to(
          camera,
          { scale: 1, ...ENTER, onUpdate: () => current.show() },
          Math.max(0, slide - OVERLAP)
        )
        // Exactly in place, so the real page underneath matches.
        .add(() => {
          Object.assign(camera, { scale: 1, x: target * spacing + width / 2 });
          current.show();
        })
    );
  },
});
