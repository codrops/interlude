/**
 * Peel: once the next page is ready, the page turns over like a sheet of
 * paper, a fold sweeping from the bottom-right corner to the top-left one. On
 * "back" the previous page turns back over this one. Nothing moves while the
 * next page loads: the demo's loader shows if that takes a while
 * (`src/components/Loader.astro`).
 *
 * It's all flat: the old page is a still copy kept in the layer
 * (`keepOldPage()`), over the real new page. The copy, the flap (the back of
 * the sheet: the turned part mirrored across the fold) and the dark films that
 * shade the sheet and the page under it are `clip-path` polygons, recomputed
 * as the fold moves.
 *
 * Needs: `src/lib/interlude/old-page.ts`.
 * Inspired by the page turn on eminente.art.
 */
import { gsap } from 'gsap';
import { defineTransition, panel, type TransitionContext } from '../lib/interlude';
import { keepOldPage, oldPage, pageColor } from '../lib/interlude/old-page';

// Settings
const FLAP_SHADE = 10; // the back of the sheet: the colour of its page, with this % of black
const DIM = 0.05; // how dark the sheet gets as it turns away, from 0 (not at all) to 1 (black)
const UNDER = 0.5; // how dark the page under the sheet is while the sheet hangs over it, from 0 to 1: it lightens as the sheet goes
const TURN = { duration: 1.2, ease: 'power2.inOut' }; // the fold sweeping across
const FADE = { duration: 0.4, ease: 'power1.out' }; // without an old page (`revealOnLoad`)

type Point = [number, number];

/** Keeps the part of a polygon on one side of a line, where `a·u + b·v + c ≥ 0`. */
function cut(polygon: Point[], a: number, b: number, c: number) {
  const side = ([u, v]: Point) => a * u + b * v + c;
  const kept: Point[] = [];
  polygon.forEach((point, i) => {
    const next = polygon[(i + 1) % polygon.length];
    const [here, there] = [side(point), side(next)];
    if (here >= 0) kept.push(point);
    // The edge crosses the line: keep the crossing too.
    if (here >= 0 !== there >= 0) {
      const t = here / (here - there);
      kept.push([point[0] + (next[0] - point[0]) * t, point[1] + (next[1] - point[1]) * t]);
    }
  });
  return kept;
}

/**
 * The sheet's parts for a fold at distance `s` from the bottom-right corner.
 * Measured from that corner (`u` leftwards, `v` upwards), the fold is the line
 * `u + v = s`: what's beyond it, on the corner's side, has turned over. The
 * flat part is what hasn't; the flap is the turned part mirrored across the
 * fold, `(u, v) → (s − v, s − u)`, cut to the page; and `turned` is the place
 * the turned part has left, where the page under the sheet shows.
 */
function shapes(s: number, width: number, height: number) {
  const page: Point[] = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ];
  const flat = cut(page, 1, 1, -s); // u + v ≥ s
  const turned = cut(page, -1, -1, s); // u + v ≤ s
  let flap = cut(flat, -1, 0, s); // u ≤ s
  flap = cut(flap, 0, -1, s); // v ≤ s
  flap = cut(flap, 1, 0, height - s); // u ≥ s − height
  flap = cut(flap, 0, 1, width - s); // v ≥ s − width
  return { flat, flap, turned };
}

/** A polygon in the corner's coordinates as a CSS `clip-path`, on the screen. */
function clipPath(polygon: Point[], width: number, height: number) {
  if (polygon.length < 3) return 'polygon(0px 0px, 0px 0px, 0px 0px)'; // nothing to show
  const points = polygon.map(([u, v]) => `${width - u}px ${height - v}px`);
  return `polygon(${points.join(', ')})`;
}

export default defineTransition({
  name: 'peel',
  solidCover: false, // the old page's copy does the covering
  entrance: false, // like a printed page, the next one is simply there

  // Nothing moves yet: the copy stands in for the page, exactly as it was,
  // while the next one loads. Returning nothing, it's covered right away.
  leave(context) {
    keepOldPage(context);
  },

  enter(context: TransitionContext) {
    const old = oldPage(context);
    // No old page (a first load with `revealOnLoad`): just fade in.
    if (!old) return gsap.fromTo(panel(context), { opacity: 1 }, { opacity: 0, ...FADE });

    const back = context.direction === 'back';
    // The back of the sheet: the old page's colour going forward (its copy
    // kept it), the new page's going back, as that's the sheet that turns.
    const color = back ? pageColor() : old.style.backgroundColor;
    const flap = panel(context, {
      style: { background: `color-mix(in srgb, ${color}, #000 ${FLAP_SHADE}%)` },
    });

    // Dark films over the sheet's flat part and over the flap, cut like them.
    // (Going back, the sheet is the real new page, under the layer: the film
    // over its flat part is what darkens it.)
    const flatFilm = panel(context, { style: { opacity: '0' } });
    const flapFilm = panel(context, { style: { opacity: '0' } });
    // And one over the page under the sheet, where it shows: under the flap,
    // which lies on it.
    const underFilm = panel(context, { style: { opacity: '0' } });
    context.root.insertBefore(underFilm, flap);

    const { clientWidth: width, clientHeight: height } = context.root;
    const fold = { s: back ? width + height : 0 };
    /** Cuts the copy, the flap and their films along the fold where it is now. */
    const draw = () => {
      const { flat, flap: folded, turned } = shapes(fold.s, width, height);
      // Forward, the copy is the sheet: its flat part shows. Back, the sheet
      // is the new page, under the copy: the copy shows where it hasn't landed.
      old.style.clipPath = clipPath(back ? turned : flat, width, height);
      flap.style.clipPath = clipPath(folded, width, height);
      flatFilm.style.clipPath = clipPath(flat, width, height);
      flapFilm.style.clipPath = clipPath(folded, width, height);
      underFilm.style.clipPath = clipPath(turned, width, height);
      // The further the fold has travelled, the darker (it ends at 1, off the
      // far corner). The square root makes it darken early, not only at the end.
      const travelled = fold.s / (width + height);
      const dark = String(DIM * Math.sqrt(travelled));
      flatFilm.style.opacity = dark;
      flapFilm.style.opacity = dark;
      // The page under: dark while the sheet hangs over most of it, light once
      // it's gone. The same both ways: going back, the fold runs the other way.
      underFilm.style.opacity = String(UNDER * (1 - travelled));
    };
    draw();
    // Forward, the fold sweeps from the corner until the sheet is gone; back,
    // from beyond the far corner back to the near one, until the sheet lies flat.
    return gsap.to(fold, { s: back ? 0 : width + height, ...TURN, onUpdate: draw });
  },
});
