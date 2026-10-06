/**
 * Spiral: a dark spiral spreads from where the navigation started until it
 * covers the page, with a red glow along its edge. On the reveal a hole opens
 * from the same spot, with the same glow.
 *
 * A WebGL transition: the shader says how much of each pixel is covered, and
 * `shaderCover()` does the rest (see `src/lib/interlude/webgl.ts`).
 *
 * Needs: `src/lib/interlude/webgl.ts` and three.js (`npm install three`).
 */
import { Color } from 'three/webgpu';
import {
  atan,
  cos,
  exp,
  float,
  mix,
  mx_fractal_noise_float,
  sin,
  smoothstep,
  uniform,
  vec3,
} from 'three/tsl';
import { defineTransition } from '../lib/interlude';
import { below, cssColor, reach, shaderCover } from '../lib/interlude/webgl';

// Settings
const LEAVE = { duration: 1.4, ease: 'power3.inOut' }; // the spiral growing
const ENTER = { duration: 1.2, ease: 'power3.out' }; // the hole opening
const ARMS = 3; // spiral arms on the edge
const TWIST = 0.9; // how much faster the centre turns than the outside
const SPIN = 0.15; // how fast the whole thing turns, in turns per second, roughly
const RAGGED = 0.2; // how rough the edge is (smoky, not smooth)
const GLOW = 0.1; // how far the bright ring reaches past the edge (a fainter haze goes further)
const GLOW_STRENGTH = 0.5; // how bright it is, from 0 (none) to 1
const RING_COLOR = cssColor('--red', '#ff4d1c'); // the site's red (`--red`), or this
const HOT_COLOR = new Color('#ffe2c4'); // the thin line at the edge itself

const ringColor = uniform(RING_COLOR);
const hot = uniform(HOT_COLOR);

export default defineTransition({
  name: 'spiral',
  entrance: false, // the page is simply there once uncovered: its content doesn't come in on its own
  ...shaderCover({
    leave: LEAVE,
    enter: ENTER,
    // Runs for every pixel on screen, every frame. `progress` goes from 0 to 1
    // while covering, then back from 1 to 0 while revealing.
    shader: ({ position, origin, progress, reveal, aspect, time, color }) => {
      // Where this pixel is around the origin: how far (0 there, 1 at the
      // farthest corner) and which way (an angle).
      const away = position.sub(origin);
      const distance = away.length().div(reach(origin, aspect));
      const angle = atan(away.y, away.x);

      // A whirlpool: the angle is turned by an amount that grows towards the
      // centre (the centre turns faster) and with time.
      const turned = angle.add(time.mul(SPIN)).add(float(TWIST).div(distance.add(0.2)));
      // Smoky noise in that turning frame, so the roughness spirals too.
      const smoke = mx_fractal_noise_float(
        vec3(
          cos(turned).mul(distance).mul(3),
          sin(turned).mul(distance).mul(3),
          time.mul(0.1).add(reveal.mul(7))
        ),
        3,
        2,
        0.5
      );
      // The edge's shape: the distance, roughened by the smoke, and pulled
      // into spiral arms.
      const field = distance.add(smoke.mul(RAGGED)).add(sin(turned.mul(ARMS)).mul(0.07));

      // Where the edge is. Covering, everything below it is covered; revealing,
      // a hole grows from the same spot (everything above it is covered). It
      // runs well past the field's range at both ends, so the cover is whole.
      const level = mix(mix(-0.3, 1.3, progress), mix(1.3, -0.3, progress), reveal);
      const dark = below(field, level, 0.01);
      const covered = mix(dark, dark.oneMinus(), reveal);

      // How far this pixel is from the edge, on the open side (0 at the edge).
      const outside = mix(field.sub(level), level.sub(field), reveal).max(0);
      // The light: a soft red glow past the edge, a thin hot line right at it.
      // Brighter on one side, and flickering with the smoke. It fades in and
      // out with the progress, so there is none before the spiral exists.
      const side = cos(angle.sub(0.6).add(time.mul(0.2)))
        .mul(0.3)
        .add(0.7);
      const flicker = smoke.mul(0.6).add(0.9);
      const envelope = smoothstep(0, 0.1, progress).mul(smoothstep(0, 0.1, progress.oneMinus()));
      // Spiral streaks in the light, turning with the whirlpool.
      const streaks = sin(turned.mul(ARMS * 2).sub(outside.mul(30)))
        .mul(0.25)
        .add(0.75);
      // A ring, and a fainter haze around it.
      const ring = exp(outside.negate().div(GLOW)).add(
        exp(outside.negate().div(GLOW * 4)).mul(0.2)
      );
      const light = ring
        .mul(side)
        .mul(streaks)
        .mul(flicker)
        .mul(envelope)
        .mul(GLOW_STRENGTH)
        .clamp(0, 1);
      const line = exp(outside.negate().div(0.006));
      const glow = mix(ringColor, hot, line);

      // Covered: the cover colour. Open: the glow, as much as there is of it.
      const open = covered.oneMinus();
      return {
        alpha: covered.add(light.mul(open)).clamp(0, 1),
        color: mix(color, glow, open),
      };
    },
  }),
});
