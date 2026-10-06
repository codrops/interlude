/**
 * Tear: a jagged tear runs down the page from above where you clicked, and
 * once the next page is ready the two halves pull apart. On "back" the tear
 * runs up from the bottom.
 *
 * The halves are two still copies of the old page (`keepOldPage()` and
 * `copyPage()`), each cut along the same line with `clip-path: polygon()`. The
 * torn edges are thin paper-coloured strips along that line, cut the same way,
 * a little wider here and there for the fibres. The real next page is under
 * them all.
 *
 * Needs: `src/lib/interlude/old-page.ts`.
 */
import { gsap } from 'gsap';
import { defineTransition, panel, type TransitionContext } from '../lib/interlude';
import { copyPage, keepOldPage, oldPage, pageColor } from '../lib/interlude/old-page';

// Settings
const LEAVE = { duration: 0.7, ease: 'power1.in' }; // the tear running down the page, on the click
const ENTER = { duration: 1.2, ease: 'power3.inOut' }; // the halves pulling apart, once the next page is ready
const TILT = 4; // how far each half turns as it goes, in degrees
const WANDER = 0.09; // how far the tear wanders from a straight line, as a share of the screen's width
const RIM = [3, 7]; // the torn edge's width, in px: between these, changing along it
const FIBRES = 0.12; // how often the edge has a longer fibre, from 0 (never) to 1
const PAPER = '#f6f3ec'; // the torn edge: the paper's inside, a little warmer than the page
const ROWS = 80; // points along the tear: more is finer
const FADE = { duration: 0.4, ease: 'power1.out' }; // without an old page (`revealOnLoad`)

/** The tear: its line (x at each row, from the top) and the torn edge's width there. */
interface Tear {
  xs: number[];
  rims: number[];
  width: number;
  height: number;
}

let tear: Tear | undefined;

/** A jagged line from top to bottom near `x`: a few slow waves, and a little roughness at every point. */
function tearLine(x: number, width: number, height: number): Tear {
  const waves = [1, 2.3, 5.1].map((frequency, i) => ({
    frequency,
    phase: Math.random() * Math.PI * 2,
    size: (width * WANDER) / (i + 1) / 1.6,
  }));
  const xs: number[] = [];
  const rims: number[] = [];
  for (let i = 0; i <= ROWS; i++) {
    const t = i / ROWS;
    const wave = waves.reduce(
      (sum, w) => sum + Math.sin(t * w.frequency * Math.PI + w.phase) * w.size,
      0
    );
    xs.push(x + wave + (Math.random() - 0.5) * 6);
    const fibre = Math.random() < FIBRES ? 6 + Math.random() * 6 : 0;
    rims.push(RIM[0] + Math.random() * (RIM[1] - RIM[0]) + fibre);
  }
  return { xs, rims, width, height };
}

const px = (x: number, y: number) => `${x.toFixed(1)}px ${y.toFixed(1)}px`;
const rowY = (i: number, height: number) => (i / ROWS) * height;

/** The polygon of one half: from the tear to its side of the screen. */
function half({ xs, width, height }: Tear, side: -1 | 1) {
  const edge = xs.map((x, i) => px(x, rowY(i, height)));
  const outer = side < 0 ? [px(0, height), px(0, 0)] : [px(width, height), px(width, 0)];
  return `polygon(${[...edge, ...outer].join(', ')})`;
}

/**
 * The polygon of one torn edge: a strip along the tear, on `side`'s half, as
 * wide as `rims` says where the tear has got to (`reach`, rows from the top or
 * the bottom), and nothing beyond.
 */
function rim({ xs, rims, height }: Tear, side: -1 | 1, reach: number, fromTop: boolean) {
  const along = xs.map((x, i) => {
    const torn = fromTop ? reach - i : i - (ROWS - reach);
    const open = Math.min(Math.max(torn / 3, 0), 1); // grows over 3 rows just behind the tip
    return px(x + side * rims[i] * open, rowY(i, height));
  });
  const line = xs.map((x, i) => px(x, rowY(i, height))).reverse();
  return `polygon(${[...along, ...line].join(', ')})`;
}

/** A transparent, full-screen box in the layer, holding a half and its edge so they move together. */
const group = (context: TransitionContext) =>
  panel(context, { style: { background: 'transparent' } });

/** A paper-coloured strip, with a hairline shadow so it shows on a white page too. */
function edgeStrip(holder: HTMLElement) {
  const shade = document.createElement('div');
  Object.assign(shade.style, {
    position: 'absolute',
    inset: '0',
    filter: 'drop-shadow(0 0 1px rgba(0, 0, 0, 0.35))',
  });
  const strip = document.createElement('div');
  Object.assign(strip.style, { position: 'absolute', inset: '0', background: PAPER });
  shade.append(strip);
  holder.append(shade);
  return strip;
}

export default defineTransition({
  name: 'tear',
  solidCover: false, // the old page's copies do the covering
  // The next page is simply there under the halves: its content doesn't come in on its own.
  entrance: false,

  // On the click: the page's two halves, together, and the tear running along the line between them.
  leave(context) {
    const { clientWidth: width, clientHeight: height } = context.root;
    const fromTop = context.direction !== 'back';
    // Above where the navigation started, but not too near the sides.
    const x = Math.min(Math.max(context.origin.x, width * 0.25), width * 0.75);
    const current = tearLine(x, width, height);
    tear = current;

    // Left: `keepOldPage()`, which keeps the old page's styles through the swap
    // for both copies. Right: another copy, above it, so its torn edge shows
    // over the left half while they're together.
    const left = group(context);
    const leftPage = keepOldPage(context);
    left.append(leftPage);
    const leftRim = edgeStrip(left);
    const right = group(context);
    const rightPage = panel(context, { style: { background: pageColor(), overflow: 'hidden' } });
    rightPage.append(copyPage(context));
    right.append(rightPage);
    const rightRim = edgeStrip(right);

    leftPage.style.clipPath = half(current, -1);
    rightPage.style.clipPath = half(current, 1);
    const tip = { rows: 0 };
    const draw = () => {
      leftRim.style.clipPath = rim(current, 1, tip.rows, fromTop);
      rightRim.style.clipPath = rim(current, -1, tip.rows, fromTop);
    };
    draw();
    return gsap.to(tip, { rows: ROWS + 3, ...LEAVE, onUpdate: draw });
  },

  // The next page is ready: the halves pull apart.
  enter(context) {
    const current = tear;
    const old = oldPage(context);
    const [left, right] = [...context.root.children] as HTMLElement[];
    // No old page (a first load with `revealOnLoad`): the dark just fades.
    if (!current || !old || !left || !right) {
      const fade = panel(context);
      return gsap.fromTo(fade, { opacity: 1 }, { opacity: 0, ...FADE });
    }
    tear = undefined;

    // Each half pivots on the end of the tear that let go last: the bottom
    // going forward, the top going back.
    const fromTop = context.direction !== 'back';
    const end = fromTop ? ROWS : 0;
    const origin = px(current.xs[end], rowY(end, current.height));
    const tilt = fromTop ? TILT : -TILT;
    // How far they go: enough for the wider half to leave the screen, its
    // torn edge and shadow too. Both go as far, so at the same speed.
    const outside = 80; // px past the half's furthest point: the edge's fibres, and the shadow
    const apart = Math.max(
      Math.max(...current.xs) + outside,
      current.width - Math.min(...current.xs) + outside
    );
    const timeline = gsap.timeline();
    for (const [holder, side] of [
      [left, -1],
      [right, 1],
    ] as const) {
      // A soft shadow under each half, as they lift off the next page.
      holder.style.transformOrigin = origin;
      timeline
        .fromTo(
          holder,
          { filter: 'drop-shadow(0 0 0 rgba(0, 0, 0, 0))' },
          { filter: 'drop-shadow(0 18px 30px rgba(0, 0, 0, 0.3))', duration: ENTER.duration * 0.3 },
          0
        )
        .to(holder, { x: side * apart, rotation: side * tilt, ...ENTER }, 0);
    }
    return timeline;
  },
});
