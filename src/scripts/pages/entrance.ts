/**
 * The entrance: how each page's content comes in, on every page.
 *
 * Mark elements in a page's HTML, and they come in as the page is revealed
 * (the ones on screen) or as they scroll into view (the ones further down):
 *
 *   <p data-entrance>…</p>                   fades in, moving a little (rising, by default)
 *   <h1 data-entrance="lines">…</h1>         each line comes in from behind a mask
 *   <div data-entrance="image"><img></div>   the frame opens (upwards, by default), the image zooms out
 *
 * When it starts is up to each transition (its `entrance`, in
 * `src/transitions/`); how it moves is set here, including which way after
 * each transition (`BY_TRANSITION`). The settings below are the demo's design
 * choices, made to be changed.
 *
 * It's also an example of a page script: `init` and `enter` are hooks the
 * engine calls for each page (see `onPage()` in the README).
 */
import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { onPage, prefersReducedMotion, type TransitionContext } from '../../lib/interlude';

gsap.registerPlugin(SplitText);

/** Where something comes in from. */
type Side = 'below' | 'above' | 'left' | 'right';

/** Which way the content comes in. */
interface Style {
  /** Where text and blocks come in from, and images open from. `here`: they only fade in, where they are. */
  from: Side | 'here';
  /** Where they come in from going back, when it isn't where they come from going forward. */
  back?: Side | 'here';
}

// Settings
const EASE = 'expo.out'; // every kind starts fast and slows into place
const STAGGER = 0.03; // seconds between one element and the next, in page order
const MOVE = { distance: 40, duration: 1.2 }; // data-entrance: px it moves in, seconds
const LINES = { duration: 1.2, stagger: 0.1, travel: 150 }; // data-entrance="lines": each line, between two, and % of its height it moves
const MASK_BLEED = 0.25; // em the lines' masks show above and below them, so tall and hanging letters (a "g") aren't cut
const IMAGE = { duration: 1.4, zoom: 1.25, zoomDuration: 1.8 }; // data-entrance="image": the frame, then the image
const FADE = { duration: 1, ease: 'power1.out' }; // any kind, with `from: 'here'`: fading in where it is
const SCROLL_OFFSET = 10; // further down, an element comes in once it's this % of the screen above the bottom
const DEFAULT: Style = { from: 'below' }; // after most transitions, and on scroll

// After these transitions, the content comes in its own way, to match them.
const BY_TRANSITION: Record<string, Style> = {
  curtain: { from: 'below', back: 'above' }, // rising with the curtain, and sinking when it runs top to bottom going back
  stack: { from: 'here' }, // only fading in: the sheet was the page's colour, and nothing else moves
};

/** An image frame clipped away entirely, ready to open from each side. */
const CLOSED: Record<Side, string> = {
  below: 'inset(100% 0% 0% 0%)',
  above: 'inset(0% 0% 100% 0%)',
  left: 'inset(0% 100% 0% 0%)',
  right: 'inset(0% 0% 0% 100%)',
};

/** The page's marked elements, in page order. */
const targets = () => [...document.querySelectorAll<HTMLElement>('[data-entrance]')];

/** On screen, or above it: the elements the reveal brings in (the rest wait for the scroll). */
const onScreen = (el: Element) => el.getBoundingClientRect().top < window.innerHeight;

/** The style after this navigation's transition: going back, its `back` if it has one. */
function styleAfter({ transition, direction }: TransitionContext): Style {
  const { from, back } = BY_TRANSITION[transition] ?? DEFAULT;
  if (direction !== 'back') return { from };
  return { from: back ?? from };
}

/** GSAP's starting offset for coming in from `side`: `amount` px, or % of the element's own size. */
function away(side: Side, amount: number, unit: 'px' | '%') {
  const axis = side === 'below' || side === 'above' ? 'y' : 'x';
  const sign = side === 'below' || side === 'right' ? 1 : -1;
  return { [unit === '%' ? `${axis}Percent` : axis]: amount * sign };
}

/** An image frame's clip-path, closed (clipped away towards `from`) or open. */
const clip = (from: Side, open: boolean) => (open ? 'inset(0% 0% 0% 0%)' : CLOSED[from]);

/** Hides an element further down the page until it scrolls into view, the way `show()` starts it. */
function hide(el: HTMLElement) {
  if (el.dataset.entrance === 'image') gsap.set(el, { clipPath: clip('below', false) });
  // Titles too: `show()` makes them visible again as it splits them into lines.
  else gsap.set(el, { opacity: 0 });
}

/**
 * Brings an element in, `delay` seconds from now, the `style` way. Each
 * animation starts from its hidden state straight away, so the element doesn't show
 * while it waits. `clearProps` removes the inline styles at the end, so the
 * page's own CSS (a hover effect, say) takes over again.
 */
function show(el: HTMLElement, delay: number, { from }: Style) {
  const kind = el.dataset.entrance;

  if (from === 'here') {
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, ...FADE, delay, clearProps: 'opacity' });
  } else if (kind === 'lines') {
    gsap.set(el, { opacity: 1 });
    // SplitText wraps each line in a mask (a box that hides what overflows it)…
    const split = SplitText.create(el, { type: 'lines', mask: 'lines' });
    // …the height of the line. With tight leading, letters reach past it, so
    // the masks clip a little further out instead, above and below: a clip-path
    // with negative insets shows more without changing the layout.
    gsap.set(split.masks, {
      overflow: 'visible',
      clipPath: `inset(-${MASK_BLEED}em -0.1em)`,
    });
    // Each line comes in from outside its mask.
    gsap.from(split.lines, {
      ...away(from, LINES.travel, '%'),
      duration: LINES.duration,
      stagger: LINES.stagger,
      ease: EASE,
      delay,
      // Back to the plain text: split lines wouldn't rewrap if the window is resized.
      onComplete: () => split.revert(),
    });
  } else if (kind === 'image') {
    // The frame is clipped away, and opens…
    gsap.fromTo(
      el,
      { clipPath: clip(from, false) },
      {
        clipPath: clip(from, true),
        duration: IMAGE.duration,
        ease: EASE,
        delay,
        clearProps: 'clipPath',
      }
    );
    // …while the image inside settles from a slight zoom.
    gsap.fromTo(
      el.querySelector('img'),
      { scale: IMAGE.zoom },
      { scale: 1, duration: IMAGE.zoomDuration, ease: EASE, delay, clearProps: 'transform' }
    );
  } else {
    // Anything else fades in, moving into place.
    gsap.fromTo(
      el,
      { opacity: 0, ...away(from, MOVE.distance, 'px') },
      {
        opacity: 1,
        x: 0,
        y: 0,
        duration: MOVE.duration,
        ease: EASE,
        delay,
        clearProps: 'opacity,transform',
      }
    );
  }
}

// `() => true`: every page.
onPage(() => true, {
  // The page is in the DOM, not yet revealed: hide what's further down, and
  // bring each element in when it scrolls into view.
  init() {
    if (prefersReducedMotion()) return; // nothing hidden, nothing animated
    const later = targets().filter((el) => !onScreen(el));
    if (!later.length) return;
    later.forEach(hide);

    // Tells us when a watched element enters the screen (minus SCROLL_OFFSET at the bottom).
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target); // once is enough
          show(entry.target as HTMLElement, 0, DEFAULT);
        }
      },
      { rootMargin: `0px 0px -${SCROLL_OFFSET}% 0px` }
    );
    later.forEach((el) => observer.observe(el));
    // A cleanup: the engine calls it before the page leaves.
    return () => observer.disconnect();
  },

  // The page is being revealed: bring in what's on screen.
  enter(context) {
    const { entrance, reducedMotion } = context;
    // `false`: nothing to bring in. The transition shows the page as it is
    // (the page itself moves, or the cover is the show), or nothing covered
    // the page (a first load).
    if (entrance === false || reducedMotion) return;
    // From the moment the transition asks for, the way that suits it, one element after another.
    const style = styleAfter(context);
    const elements = targets().filter(onScreen);
    elements.forEach((el, i) => {
      // Coming from above, the last one leads: the mirror image of rising, where the first does.
      const place = style.from === 'above' ? elements.length - 1 - i : i;
      show(el, entrance + place * STAGGER, style);
    });
  },
});
