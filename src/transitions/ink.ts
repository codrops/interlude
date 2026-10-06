/**
 * Ink: a red blot spreads from where the navigation started, with a ragged
 * edge, until it fills the screen. On the reveal, the next page opens from that
 * same spot, a ragged hole pushing the ink out past the edges.
 *
 * A WebGL transition: the shader says how much of each pixel is covered, and
 * `shaderCover()` does the rest (see `src/lib/interlude/webgl.ts`).
 *
 * Needs: `src/lib/interlude/webgl.ts` and three.js (`npm install three`).
 */
import { mix, mx_fractal_noise_float, uniform, vec3 } from 'three/tsl';
import { defineTransition } from '../lib/interlude';
import { below, cssColor, reach, shaderCover } from '../lib/interlude/webgl';

// Settings
const LEAVE = { duration: 1.1, ease: 'power2.inOut' }; // the blot spreading
const ENTER = { duration: 1.1, ease: 'power2.out' }; // the hole opening
const SOFTNESS = 0.02; // width of the edge's gradient, as a share of the screen: 0 for a crisp edge
const RAGGED = 0.25; // how ragged the edge is
const INK_COLOR = cssColor('--red', '#ff4d1c'); // the site's red (`--red`), or this: not the usual dark cover

const ink = uniform(INK_COLOR);

export default defineTransition({
  name: 'ink',
  entrance: false, // the page is simply there once uncovered: its content doesn't come in on its own
  ...shaderCover({
    leave: LEAVE,
    enter: ENTER,
    // Runs for every pixel on screen, every frame. `progress` goes from 0 to 1
    // while covering, then back from 1 to 0 while revealing.
    shader: ({ position, origin, progress, reveal, aspect }) => {
      // How far this pixel is from the origin: 0 there, 1 at the farthest
      // corner, roughened by noise so the edge is ragged. The hole gets its
      // own noise, so its edge isn't the blot's.
      const distance = position.distance(origin).div(reach(origin, aspect));
      const noise = mx_fractal_noise_float(vec3(position.mul(2.5), reveal.mul(5)), 3, 2, 0.5);
      // Kept within the thresholds' range, so the cover always closes.
      const field = distance.add(noise.mul(RAGGED)).clamp(-0.08, 1.15);
      // Covering, the blot grows: covered within a distance that grows with
      // `progress`. Revealing, a hole grows from the same spot (`progress`
      // runs back from 1 to 0, so the hole is closed at first).
      const blot = below(field, mix(-0.1, 1.2, progress), SOFTNESS);
      const hole = below(field, mix(1.2, -0.1, progress), SOFTNESS);
      // The blot while covering (`reveal` is 0), the outside of the hole while revealing (1).
      return { alpha: mix(blot, hole.oneMinus(), reveal), color: ink };
    },
  }),
});
