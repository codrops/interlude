/**
 * Velvet: a red stage curtain is drawn in from the right over the page, its
 * hem trailing behind its top, and drawn back on the next page. The page
 * beside it dims as it closes and brightens as it opens.
 *
 * A WebGL transition: the shader says how much of each pixel is covered, and
 * its colour, and `shaderCover()` does the rest (see
 * `src/lib/interlude/webgl.ts`), with `live` so the folds move while the page
 * is covered.
 *
 * Needs: `src/lib/interlude/webgl.ts` and three.js (`npm install three`).
 */
import {
  clamp,
  dot,
  float,
  fwidth,
  max,
  mix,
  mx_noise_float,
  pow,
  sin,
  smoothstep,
  sqrt,
  uniform,
  vec2,
  vec3,
} from 'three/tsl';
import { defineTransition } from '../lib/interlude';
import { cssColor, shaderCover } from '../lib/interlude/webgl';

// Settings
const LEAVE = { duration: 1.2, ease: 'power2.inOut' }; // drawing the curtain in
const ENTER = { duration: 1.2, ease: 'power2.inOut' }; // drawing it back
const FOLDS = 10; // folds across the cloth: closer together while it's gathered, further apart when it's drawn
const DEPTH = 0.5; // how deep the folds are: steeper sides, darker shadows
const TRAIL = 0.3; // how far the hem trails behind the top while moving, in screen heights
const SWAY = 0.35; // how much the folds sway, in folds
const SWAY_SPEED = 0.25; // how fast
const SHEEN = 0.35; // the velvet's soft light on the sides of its folds, from 0 (none) to 1
const SHADOW = 0.05; // the shadow the curtain casts on the page beside it, in screen heights
const DIM = 0.55; // how dark the page gets as the curtain closes, like house lights going down, from 0 (not at all) to 1 (black)
const RED = cssColor('--red', '#ff4d1c'); // the site's red (`--red`), or this

const red = uniform(RED);
const PAD = SHADOW + 0.03; // how far past the screen's edges the curtain starts and stops, shadow included

export default defineTransition({
  name: 'velvet',
  entrance: false, // the page is simply there behind the curtain, like a stage set: its content doesn't come in on its own
  ...shaderCover({
    leave: LEAVE,
    enter: ENTER,
    live: true, // the folds sway while the next page loads
    // Runs for every pixel on screen, every frame. `progress` goes from 0 to 1
    // while covering, then back from 1 to 0 while revealing.
    shader: ({ position, progress, reveal, aspect, time }) => {
      const x = position.x;
      const y = position.y; // 0 at the top, 1 at the bottom

      // The curtain's leading edge, from past the right of the screen to past
      // its left. While it moves the hem trails: further behind the lower it
      // is, and most in the middle of the move, when it's fastest (0 at both
      // ends). Covering, it moves left, so the hem is to the right of the top;
      // revealing, it moves right, so the other way.
      const travel = mix(aspect.add(PAD), float(-PAD), progress);
      const moving = sin(progress.mul(Math.PI));
      const way = mix(float(1), float(-1), reveal);
      const trail = pow(y, 1.5).mul(TRAIL).mul(moving).mul(way);
      // And a slight, slow ripple along it.
      const ripple = mx_noise_float(vec3(y.mul(2.5), time.mul(0.4), 0)).mul(0.008);
      const edge = travel.add(trail).add(ripple);
      const inside = x.sub(edge); // how far into the curtain this pixel is (negative: beside it)

      // The folds. `across` goes from 0 at the edge to 1 at the right of the
      // screen, where the curtain hangs from: the same folds always fit in the
      // cloth that shows, so they're tight while it's gathered and wide when
      // it's drawn. Noise makes them uneven and flare a little towards the hem,
      // and moves them slowly with `time`: the sway.
      const across = inside.div(max(aspect.sub(edge), 0.05));
      const uneven = mx_noise_float(vec3(across.mul(4), y.mul(0.8), time.mul(SWAY_SPEED))).mul(
        SWAY
      );
      const phase = across.add(uneven.div(FOLDS)).mul(FOLDS * Math.PI * 2);
      // Where folds are tighter than the pixels can show, they flatten out
      // rather than flicker.
      const sharp = float(1).sub(smoothstep(0.6, 1.6, fwidth(phase)));

      // Light on the cloth: the folds' slope tilts the surface left and right
      // (a second, smaller wave makes them rounder on one side, creased on the
      // other); light from the upper left lights the sides facing it, and the
      // others fall into deep red, not grey. Velvet also glows softly where its
      // surface turns away from you, more on the lit sides: the sheen.
      const slope = sin(phase)
        .add(sin(phase.mul(2).add(1)).mul(0.35))
        .mul(DEPTH)
        .mul(sharp);
      const normal = vec3(slope, 0, 1).div(sqrt(slope.mul(slope).add(1)));
      const lit = clamp(dot(normal, vec3(-0.5, -0.3, 0.81)), 0, 1);
      const sheen = pow(float(1).sub(normal.z), 1.2).mul(SHEEN).mul(lit.mul(0.6).add(0.4));
      // A stage light from above: brighter at the top, darker at the hem.
      const stage = mix(float(1.1), float(0.7), y);
      // The edge rolls under: a darker hem along it.
      const hem = mix(float(0.55), float(1), smoothstep(0, 0.014, inside));
      const body = mix(red.mul(0.2), red.mul(1.05), lit).mul(stage).mul(hem);
      const glow = mix(red, vec3(1, 0.85, 0.8), 0.35).mul(sheen);
      const cloth = body.add(glow);

      // The curtain, with an anti-aliased edge, and its shadow on the page
      // beside it.
      const covered = smoothstep(fwidth(inside).negate(), fwidth(inside), inside);
      const shadow = float(1)
        .sub(smoothstep(0, SHADOW, inside.negate()))
        .mul(0.35);
      // The page beside it dims as the curtain closes, and brightens as it
      // opens: `progress` runs the other way while revealing, so the next
      // page starts dark. A little darker towards the edges of the screen,
      // as if a light stayed on the middle.
      const edges = position
        .sub(vec2(aspect.mul(0.5), 0.5))
        .length()
        .div(aspect.mul(0.6));
      const dim = smoothstep(0, 1, progress)
        .mul(DIM)
        .mul(mix(float(0.9), float(1.1), clamp(edges, 0, 1)));
      // The shadow and the dimming together: what light gets through both.
      const dark = float(1).sub(shadow.oneMinus().mul(dim.oneMinus()));
      return {
        alpha: covered.add(dark.mul(covered.oneMinus())),
        color: mix(vec3(0), cloth, covered),
      };
    },
  }),
});
