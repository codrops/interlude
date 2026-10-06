/**
 * Channel: changing channels on an old TV. The page jumps and breaks into
 * bands of static until the screen is all static, which keeps moving while the
 * next page loads. Then the next page tunes in: the bands thin out and the
 * jumps settle.
 *
 * A WebGL transition: the shader says how much of each pixel is covered, and
 * `shaderCover()` does the rest (see `src/lib/interlude/webgl.ts`), with
 * `live` so the static moves while the page is covered. A shader can't read
 * the page, so the jumps are CSS, on still copies of the pages under the
 * canvas (`keepOldPage()` and `copyPage()`, see `src/lib/interlude/old-page.ts`).
 *
 * Needs: `src/lib/interlude/webgl.ts` and three.js (`npm install three`), and
 * `src/lib/interlude/old-page.ts`.
 */
import { gsap } from 'gsap';
import type { Node } from 'three/webgpu';
import { dot, exp, float, floor, fract, mix, sin, smoothstep, step, vec2, vec3 } from 'three/tsl';
import { defineTransition, panel } from '../lib/interlude';
import { copyPage, keepOldPage, oldPage, pageColor } from '../lib/interlude/old-page';
import { rendererReady, shaderCover } from '../lib/interlude/webgl';

// Settings
const LEAVE = { duration: 0.45, ease: 'power1.in' }; // losing the signal
const ENTER = { duration: 0.5, ease: 'power2.out' }; // tuning in
const GRAIN = 260; // grains of static per screen height: more is finer
const FPS = 30; // new pictures of static per second
const FLICKER = 14; // how many times a second the bands are dealt again
const SNOW = [0.06, 0.92]; // the static's darkest and lightest grey, from 0 (black) to 1 (white)
const SCANLINES = 280; // dark lines per screen height, over the page as it loses the signal
const SCAN_DARK = 0.12; // how dark they are, from 0 (not at all) to 1 (black)
const ROLL = 1.2; // how fast the bright bar rolls down, in screens per second
const BAR = 0.18; // how bright it is, from 0 (not at all) to 1 (white)
const JUMP = 0.04; // how far the page jumps sideways at most, as a share of the screen's width
const JUMP_EVERY = 0.05; // seconds between two jumps

/** A random number from 0 to 1 for the point `p`, the same every time for the same point. */
const hash = (p: Node<'vec2'>) => fract(sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453));

const cover = shaderCover({
  leave: LEAVE,
  enter: ENTER,
  live: true, // the static moves while the next page loads
  // Runs for every pixel on screen, every frame. `progress` goes from 0 to 1
  // while covering, then back from 1 to 0 while revealing.
  shader: ({ position, progress, reveal, time }) => {
    // The static: a random grey for each grain, picked again `FPS` times a
    // second. Grains are a little wider than tall, like a TV's. (The picture
    // count goes round at 97, so the numbers stay small and the hash precise.)
    const picture = floor(time.mul(FPS)).mod(97);
    const grain = floor(position.mul(vec2(GRAIN * 0.6, GRAIN)));
    const snow = mix(SNOW[0], SNOW[1], hash(grain.add(picture.mul(vec2(13.7, 7.3)))));

    // The bands: rows of the screen, each with a random number, dealt again
    // `FLICKER` times a second (and differently while revealing). A row is
    // static when its number is under a level that rises with `progress`, so
    // more and more of them are, until all are. Two sizes of rows, mixed:
    // wide bands and thin ones.
    const deal = floor(time.mul(FLICKER)).mod(97).add(reveal.mul(50));
    const wide = hash(vec2(floor(position.y.mul(6)), deal));
    const thin = hash(vec2(floor(position.y.mul(40)), deal.add(3.1)));
    const row = mix(wide, thin, 0.5);
    const level = progress.mul(1.2).sub(0.1); // from below every row's number to above them all
    const snowy = step(row, level);

    // Over the page, the signal going: dark scanlines, a bright bar rolling
    // down, and now and then a thin white line, all fading in with `progress`.
    const signal = smoothstep(0, 0.2, progress);
    const scan = step(0.5, fract(position.y.mul(SCANLINES))).mul(SCAN_DARK);
    const roll = position.y.sub(fract(time.mul(ROLL))).div(0.08);
    const bar = exp(roll.mul(roll).negate()).mul(BAR);
    const line = step(0.985, hash(vec2(floor(position.y.mul(300)), deal.add(7))));
    const light = bar.max(line);

    const overlay = scan.max(light).mul(signal);
    const overlayColor = step(scan, light); // white where it's the light, black where it's a line
    return {
      alpha: mix(overlay, float(1), snowy),
      color: mix(vec3(overlayColor), vec3(snow.add(bar.mul(0.5))), snowy),
    };
  },
});

/**
 * The page jumping sideways (and now and then up or down a little), every
 * `JUMP_EVERY` seconds for `duration`: further and further if `worse`, less
 * and less if not, back in place at the end.
 */
function jumps(el: Element, duration: number, worse: boolean) {
  const timeline = gsap.timeline();
  for (let t = 0; t < duration; t += JUMP_EVERY) {
    const amount = worse ? t / duration : 1 - t / duration;
    const big = Math.random() < 0.3; // most jumps are small, a few are big
    timeline.set(
      el,
      {
        xPercent: (Math.random() * 2 - 1) * JUMP * 100 * amount * (big ? 1 : 0.3),
        yPercent: big ? (Math.random() * 2 - 1) * 2 * amount : 0,
      },
      t
    );
  }
  return timeline.set(el, { xPercent: 0, yPercent: 0 }, duration);
}

export default defineTransition({
  name: 'channel',
  solidCover: false, // the canvas does the covering
  entrance: false, // the page is simply there once the static has gone: its content doesn't come in on its own

  async leave(context) {
    // Without WebGL, `shaderCover()` fades instead: no page to shake under it.
    if (!(await rendererReady())) return cover.leave(context);
    // The old page's copy, under the canvas (the canvas is added on top of what's in the layer).
    const page = keepOldPage(context).lastElementChild; // the copy itself: `keepOldPage()` puts it last
    if (page) jumps(page, LEAVE.duration, true);
    return cover.leave(context);
  },

  enter(context) {
    const revealing = cover.enter(context);
    const old = oldPage(context);
    // No old page: a first load with `revealOnLoad`, or no WebGL (a fade).
    if (!old) return revealing;
    // Under the static, the old page's copy makes way for one of the next page,
    // which jumps as it tunes in. (The real page is under it, the same.)
    const view = panel(context, { style: { background: pageColor(), overflow: 'hidden' } });
    const next = copyPage(context);
    view.append(next);
    old.replaceWith(view); // in the old one's place: under the canvas
    jumps(next, ENTER.duration * 0.8, false);
    return revealing;
  },
});
