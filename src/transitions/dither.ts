/**
 * Dither: squares fill the screen from big to small, each coming in as a
 * pattern of dots that fills in to solid. The reveal runs the other way, the
 * smallest squares first.
 *
 * A WebGL transition: the shader says how much of each pixel is covered, and
 * `shaderCover()` does the rest (see `src/lib/interlude/webgl.ts`). Three
 * sizes of squares nest on the same grid, each square with its own moment to
 * come in, and the dots are ordered (Bayer) dithering of how filled it is.
 *
 * Needs: `src/lib/interlude/webgl.ts` and three.js (`npm install three`).
 */
import { clamp, float, floor, hash, max, mod, step } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { defineTransition } from '../lib/interlude';
import { shaderCover } from '../lib/interlude/webgl';

// Settings
const LEAVE = { duration: 1.1, ease: 'power1.inOut' }; // covering
const ENTER = { duration: 1.1, ease: 'power1.inOut' }; // revealing
// The sizes of squares, biggest first, each half the one before so they nest
// in the same grid: `size` as a share of the screen's height, and `share`, how
// many of the squares that size come in (the gaps are left for the smaller
// ones). The smallest all do, so the screen ends up covered.
const LEVELS = [
  { size: 1 / 8, share: 0.4 },
  { size: 1 / 16, share: 0.5 },
  { size: 1 / 32, share: 1 },
];
const STAGGER = 0.16; // how much later each size starts than the one before, as a share of the cover
const FILL = 0.2; // how long a square takes to go from its first dots to solid, as a share of the cover
const DOTS = 32 * 8; // dots per screen height: 8 across the smallest square, so the patterns line up with the squares

/**
 * The 4×4 Bayer matrix, as a threshold from 0 to 1 for the dot at `x`, `y`:
 * a dot shows when the square's density is above it. Thresholds are spread so
 * that any density lights an even pattern of dots, as in 1-bit images. Built
 * from the 2×2 one (0 2 / 3 1), which is `(2x + 3y) mod 4`.
 */
function bayer(x: Node<'float'>, y: Node<'float'>) {
  const two = (a: Node<'float'>, b: Node<'float'>) => mod(a.mul(2).add(b.mul(3)), 4);
  const fine = two(mod(x, 2), mod(y, 2));
  const coarse = two(mod(floor(x.div(2)), 2), mod(floor(y.div(2)), 2));
  return fine.mul(4).add(coarse).add(0.5).div(16);
}

export default defineTransition({
  name: 'dither',
  entrance: false, // the page is simply there once uncovered: its content doesn't come in on its own
  ...shaderCover({
    leave: LEAVE,
    enter: ENTER,
    // Runs for every pixel on screen, every frame. `progress` goes from 0 to 1
    // while covering, then back from 1 to 0 while revealing.
    shader: ({ position, progress, reveal }) => {
      // Each size has its own stretch of the cover, staggered: the biggest from
      // the start, the smallest up to the end, less the time to fill in, so
      // every square is solid when the cover is. Revealing, `progress` runs
      // back, so the smallest go first.
      const span = 1 - STAGGER * (LEVELS.length - 1) - FILL;
      let density: Node<'float'> = float(0); // how filled in this spot is, from 0 to 1

      LEVELS.forEach(({ size, share }, level) => {
        // Which square of this size the pixel is in, as one number. The reveal
        // gets other numbers, so it doesn't play the cover backwards.
        const cell = floor(position.div(size));
        const id = cell.x
          .add(cell.y.mul(997))
          .add(level * 7919)
          .add(reveal.mul(104729));
        // Whether this square comes in at all, and when, in its size's stretch.
        const takesPart = step(hash(id), share);
        const moment = hash(id.add(50021))
          .mul(span)
          .add(level * STAGGER);
        // How filled in it is: 0 until its moment, 1 once `FILL` has passed.
        const filled = clamp(progress.sub(moment).div(FILL), 0, 1);
        density = max(density, takesPart.mul(filled));
      });

      // The dot this pixel is in, and whether the density is enough to show it.
      const dot = floor(position.mul(DOTS));
      return step(bayer(dot.x, dot.y), density);
    },
  }),
});
