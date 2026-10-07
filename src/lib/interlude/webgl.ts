/**
 * WebGL transitions: a full-screen shader covers the page, then reveals the
 * next one. A transition only describes its shader, how much of each pixel is
 * covered for a given progress; this module does the rest:
 *
 * - one renderer and one canvas, shared by every WebGL transition and created
 *   once per visit, when the first of them loads;
 * - the canvas in the layer, sized to the screen (`solidCover: false` keeps it
 *   there while the page is covered);
 * - a `progress` uniform tweened with GSAP, a frame rendered on each update and
 *   none the rest of the time, unless the shader is `live`;
 * - interruptions: a cover that starts mid-reveal turns the reveal around;
 * - a fade instead, if neither WebGPU nor WebGL is available.
 *
 * three.js's WebGPURenderer runs the shaders, written in TSL, with WebGPU, or
 * WebGL 2 where WebGPU isn't available. This module isn't exported from
 * `index.ts`, so three.js is only downloaded with the transitions that import
 * it. Writing `leave` and `enter` yourself: docs/how-it-works.md, section 8.
 */
import { gsap } from 'gsap';
import { Color, MeshBasicNodeMaterial, QuadMesh, Vector2, WebGPURenderer } from 'three/webgpu';
import type { Node } from 'three/webgpu';
import { float, fwidth, max, screenUV, select, smoothstep, step, uniform, vec2 } from 'three/tsl';
import { panel, sign } from './helpers';
import type { Transition, TransitionContext } from './types';

/** What a transition's shader works with. Positions are in screen heights: y from 0 (top) to 1 (bottom), x from 0 to `aspect`. */
export interface ShaderInput {
  /** This pixel's position. */
  position: Node<'vec2'>;
  /** Where the navigation started (the click, or the link's centre). */
  origin: Node<'vec2'>;
  /** From 0 (the page is visible) to 1 (it's covered). */
  progress: Node<'float'>;
  /** 0 while covering, 1 while revealing, so the reveal can differ from the cover. */
  reveal: Node<'float'>;
  /** 1 going forward, -1 going back, to mirror the effect. */
  direction: Node<'float'>;
  /** The screen's width / height. */
  aspect: Node<'float'>;
  /** Seconds, for movement. */
  time: Node<'float'>;
  /** The cover colour (`--interlude-color`). */
  color: Node<'color'>;
}

/** How much of the pixel is covered (0 to 1), or that and its colour. */
export type ShaderOutput =
  Node<'float'> | { alpha: Node<'float'>; color: Node<'color'> | Node<'vec3'> };

/** How long one half of the transition takes (seconds), and its GSAP ease. */
export interface Timing {
  duration?: number;
  ease?: string | gsap.EaseFunction;
}

export interface ShaderCoverOptions {
  /** Covering: `progress` runs from 0 to 1. Defaults to 1 second, `'power2.inOut'`. */
  leave?: Timing;
  /** Revealing: `progress` runs back from 1 to 0. Defaults to 1 second, `'power2.out'`. */
  enter?: Timing;
  shader: (input: ShaderInput) => ShaderOutput;
  /**
   * Keeps rendering frames while the page is covered, until `enter`: for a
   * shader that moves on its own, with `time` (static, say), so it doesn't
   * freeze while the next page loads. Off by default: a still cover costs nothing.
   */
  live?: boolean;
}

/**
 * 1 where `field` is below `threshold`, 0 above: the covered side of an edge.
 * `softness` widens the edge into a gradient (in `field` units); at 0 it's a
 * crisp line, anti-aliased.
 */
export const below = (field: Node<'float'>, threshold: Node<'float'>, softness = 0) => {
  const half = max(fwidth(field), float(softness)).mul(0.5);
  return float(1).sub(smoothstep(threshold.sub(half), threshold.add(half), field));
};

/** Distance from `origin` to the farthest corner of the screen: a circle this big covers it. */
export const reach = (origin: Node<'vec2'>, aspect: Node<'float'>) =>
  max(origin, vec2(aspect, 1).sub(origin)).length();

/**
 * A CSS colour custom property (`--color-accent`), as a three.js colour, or
 * `fallback` if the site doesn't define it: a transition copied into another
 * site still has a colour.
 */
export const cssColor = (
  property: string,
  fallback = '#000',
  element: Element = document.documentElement
) => new Color(getComputedStyle(element).getPropertyValue(property).trim() || fallback);

const aspect = uniform(1);
const origin = uniform(new Vector2());
const direction = uniform(1);
const time = uniform(0);
const start = performance.now();
const color = uniform(new Color());
const position = screenUV.mul(vec2(aspect, 1));

/** Set once ready: `null` if neither WebGPU nor WebGL is available (or the GPU was lost). */
let renderer: WebGPURenderer | null | undefined;

const ready = (async () => {
  try {
    // Pick the backend up front: three.js warns when it has to fall back itself:
    // https://github.com/mrdoob/three.js/blob/r186/src/renderers/webgpu/WebGPURenderer.js#L67
    const adapter = await navigator.gpu?.requestAdapter().catch(() => null);
    const created = new WebGPURenderer({ alpha: true, forceWebGL: !adapter });
    await created.init();
    created.setClearColor(0x000000, 0);
    created.onDeviceLost = () => (renderer = null);
    Object.assign(created.domElement.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
    });
    renderer = created;
  } catch (error) {
    console.info('[interlude] WebGL is unavailable: WebGL transitions fade instead.', error);
    renderer = null;
  }
  return renderer;
})();

/** Sizes the canvas to the layer, adds it there, and sets what this navigation's shaders read. */
function mount(context: TransitionContext, gl: WebGPURenderer) {
  const { clientWidth: width, clientHeight: height } = context.root;
  gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  gl.setSize(width, height, false);
  if (gl.domElement.parentNode !== context.root) context.root.append(gl.domElement);
  aspect.value = width / height;
  origin.value.set(context.origin.x / height, context.origin.y / height);
  direction.value = sign(context);
  color.value.copy(cssColor('--interlude-color', '#111', context.root));
}

/**
 * For a transition that draws a scene of its own (particles, meshes…) rather
 * than one full-screen shader: the shared renderer, with its canvas added to
 * the layer (on top of what's there) and sized to the screen. Await it in
 * `leave`. `null` without WebGPU or WebGL: draw a fallback instead (a fade).
 * See `src/transitions/particles.ts`.
 */
export async function layerRenderer(context: TransitionContext) {
  const gl = await ready;
  if (!gl || !renderer) return null;
  mount(context, gl);
  return gl;
}

/** The shared renderer, once it's set up (`null` without WebGPU or WebGL): to compile a scene ahead of the click. */
export const rendererReady = () => ready;

/** The shared renderer in `enter`, synchronously: `null` if there's none (or no `leave` set it up). */
export const currentRenderer = () => (renderer?.domElement.isConnected ? renderer : null);

/** Without WebGL: a plain fade. */
const fallback = {
  leave: (context: TransitionContext) =>
    gsap.fromTo(panel(context), { opacity: 0 }, { opacity: 1, duration: 0.45 }),
  enter: (context: TransitionContext) =>
    gsap.to(context.root.querySelector('.interlude__panel') ?? panel(context), {
      opacity: 0,
      duration: 0.45,
    }),
};

/**
 * Makes a transition's `leave` and `enter` out of a shader:
 *
 *   export default defineTransition({
 *     name: 'ink',
 *     ...shaderCover({
 *       leave: { duration: 1.1 },
 *       enter: { duration: 1.1 },
 *       shader: ({ position, progress }) => …,
 *     }),
 *   });
 */
export function shaderCover({
  leave: leaveTiming,
  enter: enterTiming,
  shader,
  live = false,
}: ShaderCoverOptions): Pick<Transition, 'leave' | 'enter' | 'ready' | 'solidCover'> {
  const covering = { duration: 1, ease: 'power2.inOut', ...leaveTiming };
  const revealing = { duration: 1, ease: 'power2.out', ...enterTiming };
  const progress = uniform(0);
  const reveal = uniform(0);

  const output = shader({ position, origin, progress, reveal, direction, aspect, time, color });
  const alpha = 'alpha' in output ? output.alpha : output;
  const material = new MeshBasicNodeMaterial({ transparent: true });
  material.colorNode = 'alpha' in output ? output.color : color;
  // Never a pixel of the page at 1, never a pixel of cover at 0, whatever the shader does.
  material.opacityNode = select(
    progress.greaterThanEqual(0.999),
    float(1),
    alpha.clamp(0, 1).mul(step(0.001, progress))
  );
  const quad = new QuadMesh(material);

  // Compile the shader while nothing is waiting for it.
  const compiled = ready.then((gl) => gl?.compileAsync(quad, quad.camera)).catch(() => {});

  const draw = () => {
    if (!renderer) return;
    time.value = (performance.now() - start) / 1000; // small numbers keep shaders precise
    quad.render(renderer);
  };

  // `live`: a frame on every tick of GSAP's clock while covered, from the end
  // of `leave` to the start of `enter`.
  const stopLive = () => gsap.ticker.remove(draw);
  const startLive = () => {
    stopLive(); // never twice
    gsap.ticker.add(draw);
  };

  // A finished navigation, whatever its transition: start the next cover from scratch.
  document.addEventListener('interlude:idle', () => {
    stopLive();
    progress.value = 0;
    reveal.value = 0;
  });

  return {
    solidCover: false, // the canvas does the covering
    // Set up and compiled: on a first load with `revealOnLoad`, the engine waits for it.
    ready: () => compiled,

    async leave(context) {
      const gl = await ready;
      if (!gl || !renderer) return fallback.leave(context);
      mount(context, gl);
      draw();
      // From wherever it is: mid-reveal, that turns the reveal around.
      return gsap.to(progress, {
        value: 1,
        ...covering,
        onUpdate: draw,
        onComplete: live ? startLive : undefined,
      });
    },

    enter(context) {
      // Synchronous: the canvas from `leave` is still on screen, fully covering.
      stopLive();
      if (!renderer) return fallback.enter(context);
      // The first page with `revealOnLoad` has had no `leave`.
      if (!renderer.domElement.isConnected) mount(context, renderer);
      progress.value = 1;
      reveal.value = 1;
      draw();
      return gsap.to(progress, { value: 0, ...revealing, onUpdate: draw });
    },
  };
}
