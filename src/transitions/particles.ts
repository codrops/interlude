/**
 * Particles: on a dark sheet, particles drift in from beyond the edges and form
 * the site's name, then burst away once the next page is ready.
 *
 * A WebGL scene of its own, rather than one full-screen shader: it borrows the
 * shared renderer with `layerRenderer()` (see `src/lib/interlude/webgl.ts`).
 * Every particle moves on the GPU: the shader works out its place from a few
 * numbers (where it starts, its place in the word, a random seed) and four
 * uniforms (gather, burst, time, pointer), so JavaScript only tweens those.
 *
 * Needs: `src/lib/interlude/webgl.ts` and three.js (`npm install three`).
 */
import { gsap } from 'gsap';
import {
  InstancedBufferAttribute,
  OrthographicCamera,
  PointsNodeMaterial,
  Scene,
  Sprite,
  Vector2,
  type WebGPURenderer,
} from 'three/webgpu';
import {
  cos,
  float,
  fract,
  instancedBufferAttribute,
  mix,
  sin,
  smoothstep,
  step,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
import { defineTransition, panel, type TransitionContext } from '../lib/interlude';
import { cssColor, currentRenderer, layerRenderer, rendererReady } from '../lib/interlude/webgl';

// Settings
const WORD = 'Interlude'; // what the particles spell
const MAX = { wide: 9000, narrow: 3500 }; // at most this many particles (screens under 640px: narrow)
const GAP = 4; // px between two sampled points of the word: smaller is denser
const SIZE = 2.2; // px, a particle's size (each varies around it)
const ACCENT = 0.08; // the share of particles in the accent colour
const LIGHT_COLOR = cssColor('--color-bg', '#fff'); // most particles: the site's background colour, or this
const ACCENT_COLOR = cssColor('--color-accent', '#ec4a2f'); // the others: the site's accent colour, or this
const SHEET_IN = { duration: 0.35, ease: 'power2.out' }; // the dark sheet behind them
const GATHER = 0.9; // seconds for the particles to fly in and settle (each takes its own share)
const BURST = 0.8; // seconds for them to burst out
const SHEET_OUT = { duration: 0.6, ease: 'power2.inOut', delay: 0.1 }; // the sheet going
const PUSH = { radius: 90, strength: 40 }; // px: how the pointer pushes particles aside

// What the shader reads. Positions are in px, from the middle of the screen, y up.
const gather = uniform(0); // 0 → 1 while the particles fly in
const burst = uniform(0); // 0 → 1 while they burst out
const time = uniform(0); // seconds, for the breathing
const pointer = uniform(new Vector2(1e5, 1e5)); // far away until the pointer moves
const reach = uniform(1000); // px from the middle to a corner: how far they fly out

// Per particle: where it starts and where it belongs in the word (x, y, x, y), and a random seed.
const places = new InstancedBufferAttribute(new Float32Array(MAX.wide * 4), 4);
const seeds = new InstancedBufferAttribute(new Float32Array(MAX.wide), 1);

const material = new PointsNodeMaterial({
  transparent: true,
  depthWrite: false,
  sizeAttenuation: false,
});

{
  const place = instancedBufferAttribute<'vec4'>(places, 'vec4');
  const seed = instancedBufferAttribute<'float'>(seeds, 'float');
  const start = place.xy;
  const target = place.zw;

  // Each particle arrives at its own moment: it waits a share of the time,
  // then flies in, slowing as it lands (an ease-out, cubed).
  const arrive = gather.sub(seed.mul(0.35)).div(0.65).clamp(0, 1);
  const settled = arrive.oneMinus().pow(3).oneMinus();
  let position = mix(start, target, settled);

  // Settled, it breathes: small loops around its place, each its own way.
  const breathe = vec2(sin(time.mul(1.7).add(seed.mul(61))), cos(time.mul(1.3).add(seed.mul(47))));
  position = position.add(breathe.mul(2.5).mul(settled));

  // The pointer pushes it aside, more the closer it is.
  const away = position.sub(pointer);
  const distance = away.length().max(0.001);
  const push = smoothstep(0, PUSH.radius, distance).oneMinus().mul(PUSH.strength);
  position = position.add(away.div(distance).mul(push));

  // The burst: out from the middle, each at its own moment and speed, speeding up.
  const leaves = burst.sub(seed.mul(0.25)).div(0.75).clamp(0, 1);
  const flung = leaves.pow(2);
  const jitter = vec2(seed.sub(0.5), fract(seed.mul(13.7)).sub(0.5)).mul(8); // never exactly the middle
  const outward = target.add(jitter).normalize();
  position = position.add(outward.mul(flung).mul(reach.mul(seed.mul(0.6).add(0.5))));

  material.positionNode = vec3(position, 0);
  material.sizeNode = float(SIZE).mul(fract(seed.mul(7.31)).mul(0.9).add(0.6));
  material.colorNode = mix(
    uniform(LIGHT_COLOR),
    uniform(ACCENT_COLOR),
    step(1 - ACCENT, fract(seed.mul(3.17)))
  );
  // Round dots, there once arrived, gone once flung.
  const round = smoothstep(0.35, 0.5, uv().sub(0.5).length()).oneMinus();
  material.opacityNode = round.mul(settled).mul(flung.oneMinus());
}

const scene = new Scene();
const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
camera.position.z = 1; // in front of the particles, which sit at z = 0
const sprite = new Sprite(material); // drawn once per particle (`count`)
sprite.frustumCulled = false;
scene.add(sprite);

// Compile the shader while nothing is waiting for it (the module loads on hover).
rendererReady()
  .then((gl) => gl?.compileAsync(scene, camera))
  .catch(() => {});

/** Points of the word, as drawn in the middle of the screen: px from the middle, y up. */
function sampleWord(width: number, height: number, max: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  const family = getComputedStyle(document.body).fontFamily;
  // As wide as 80% of the screen, but no taller than 35% of it.
  context.font = `600 100px ${family}`;
  const size = Math.min((100 * width * 0.8) / context.measureText(WORD).width, height * 0.35);
  context.font = `600 ${size}px ${family}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(WORD, width / 2, height / 2);

  const { data } = context.getImageData(0, 0, width, height);
  const points: number[] = [];
  for (let y = 0; y < height; y += GAP) {
    for (let x = 0; x < width; x += GAP) {
      if (data[(y * width + x) * 4 + 3] > 128) points.push(x - width / 2, height / 2 - y);
    }
  }
  // Too many: keep an even selection.
  const count = points.length / 2;
  if (count <= max) return points;
  const kept: number[] = [];
  for (let i = 0; i < max; i++) {
    const at = Math.floor((i * count) / max) * 2;
    kept.push(points[at], points[at + 1]);
  }
  return kept;
}

/** Lays the particles out for this screen: their places in the word, and where they start. */
function layOut(context: TransitionContext) {
  const { clientWidth: width, clientHeight: height } = context.root;
  const points = sampleWord(width, height, width < 640 ? MAX.narrow : MAX.wide);
  const count = points.length / 2;
  reach.value = Math.hypot(width, height) / 2;
  for (let i = 0; i < count; i++) {
    // From beyond the edges, all around.
    const angle = Math.random() * Math.PI * 2;
    const distance = reach.value * (1 + Math.random() * 0.5);
    places.setXYZW(
      i,
      Math.cos(angle) * distance,
      Math.sin(angle) * distance,
      points[i * 2],
      points[i * 2 + 1]
    );
    seeds.setX(i, Math.random());
  }
  places.needsUpdate = true;
  seeds.needsUpdate = true;
  sprite.count = count;
  Object.assign(camera, {
    left: -width / 2,
    right: width / 2,
    top: height / 2,
    bottom: -height / 2,
  });
  camera.updateProjectionMatrix();
}

// The render loop and the pointer, while this transition plays.
let gl: WebGPURenderer | null = null;
let started = 0;
const render = () => {
  time.value = (performance.now() - started) / 1000;
  gl?.render(scene, camera);
};
const follow = (event: PointerEvent) => {
  pointer.value.set(event.clientX - innerWidth / 2, innerHeight / 2 - event.clientY);
};
function stop() {
  gsap.ticker.remove(render);
  window.removeEventListener('pointermove', follow);
  pointer.value.set(1e5, 1e5);
}
// Any new navigation, or the end of this one: stop drawing.
document.addEventListener('interlude:leave', stop);
document.addEventListener('interlude:idle', stop);

export default defineTransition({
  name: 'particles',
  solidCover: false, // the sheet and the particles do the covering, and stay through the swap
  entrance: false, // the page is simply there once uncovered: its content doesn't come in on its own

  async leave(context) {
    const sheet = panel(context, { style: { opacity: '0' } }); // the dark sheet, under the canvas
    gl = await layerRenderer(context); // adds the canvas on top
    // Without WebGPU or WebGL: just the sheet.
    if (!gl) return gsap.to(sheet, { opacity: 1, ...SHEET_IN });

    layOut(context);
    gather.value = 0;
    burst.value = 0;
    started = performance.now();
    gsap.ticker.add(render);
    window.addEventListener('pointermove', follow, { passive: true });
    return gsap
      .timeline()
      .to(sheet, { opacity: 1, ...SHEET_IN }, 0)
      .to(gather, { value: 1, duration: GATHER, ease: 'none' }, 0);
  },

  enter(context) {
    const sheet = context.root.querySelector<HTMLElement>('.interlude__panel');
    // No particles (no WebGL, or a first load with `revealOnLoad`): the sheet just goes.
    if (!sheet || !currentRenderer()) {
      return gsap.to(sheet ?? panel(context), { opacity: 0, ...SHEET_OUT, delay: 0 });
    }
    return gsap
      .timeline({ onComplete: stop })
      .to(burst, { value: 1, duration: BURST, ease: 'none' }, 0)
      .to(sheet, { opacity: 0, ...SHEET_OUT }, 0);
  },
});
