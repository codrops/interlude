/**
 * Dissolve: blotches appear all over the screen and merge into the cover,
 * with a glowing rim in the accent colour, like paper burning. On the reveal,
 * smaller holes burn through it in other places, glowing at their edges.
 *
 * A WebGL transition: the shader says how much of each pixel is covered, and
 * `shaderCover()` does the rest (see `src/lib/interlude/webgl.ts`).
 *
 * Needs: `src/lib/interlude/webgl.ts` and three.js (`npm install three`).
 */
import { mix, mx_fractal_noise_float, smoothstep, uniform, vec3 } from 'three/tsl';
import { defineTransition } from '../lib/interlude';
import { below, cssColor, shaderCover } from '../lib/interlude/webgl';

// Settings
const LEAVE = { duration: 1.2, ease: 'power2.inOut' }; // covering
const ENTER = { duration: 1.2, ease: 'power2.out' }; // revealing
const RIM = 0.06; // width of the glowing rim, in noise units: 0 for none
const RIM_COLOR = cssColor('--color-accent', '#ec4a2f'); // the site's accent colour, or this
const SCALE = 3; // how many blotches cover the screen (more = smaller)…
const REVEAL_SCALE = 5.5; // …and how many holes reveal the next page

const rimColor = uniform(RIM_COLOR);

export default defineTransition({
  name: 'dissolve',
  entrance: false, // the page is simply there once uncovered: its content doesn't come in on its own
  ...shaderCover({
    leave: LEAVE,
    enter: ENTER,
    // Runs for every pixel on screen, every frame. `progress` goes from 0 to 1
    // while covering, then back from 1 to 0 while revealing.
    shader: ({ position, progress, reveal, color }) => {
      // A cloudy pattern (fractal noise), roughly 0 to 1 across the screen:
      // a "height" for each pixel. The reveal uses another, finer pattern, so
      // it doesn't play the cover backwards.
      const scale = mix(SCALE, REVEAL_SCALE, reveal);
      const field = mx_fractal_noise_float(vec3(position.mul(scale), reveal.mul(7)), 4, 2, 0.5)
        .mul(0.7)
        .add(0.5)
        .clamp(0, 1);
      // A level that rises with `progress`: every pixel below it is covered,
      // so the low spots go first. It ends above the highest point, rim
      // included, so the cover is whole before the end.
      const threshold = mix(-0.15, 1 + RIM + 0.02, progress);
      const covered = below(field, threshold);
      // The rim: a thin band just above the level, outside the covered part.
      const rim = smoothstep(threshold, threshold.add(RIM), field)
        .oneMinus()
        .mul(covered.oneMinus());
      return {
        alpha: covered.add(rim),
        color: mix(color, rimColor, rim),
      };
    },
  }),
});
