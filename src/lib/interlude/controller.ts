/**
 * The controller: plugs Interlude into Astro's client router (`<ClientRouter />`).
 *
 *   click
 *     astro:before-preparation  ->  cover the page (transition.leave)    } at the
 *                                   fetch the next page                  } same time
 *     astro:before-swap         ->  clean up the old page
 *     (Astro swaps the page under the cover and sets the scroll position)
 *     astro:after-swap          ->  set the new page's starting state (transition.prepare)
 *     astro:page-load           ->  set up the new page, wait for fonts and images
 *                                   (and `minCoverTime`), then reveal it (transition.enter)
 *
 * The router's replaceable `loader` is the hook: it's awaited before the swap,
 * so wrapping it lets the cover finish first. The fetch runs alongside it, so a
 * navigation costs max(cover, network) rather than cover + network.
 *
 * Navigations without a transition (`'none'`) aren't intercepted: Astro swaps
 * the page as soon as it's fetched, and only the page hooks and events run.
 * Each step in detail: docs/how-it-works.md, section 2.
 */
import { gsap } from 'gsap';
import type {
  TransitionBeforePreparationEvent,
  TransitionBeforeSwapEvent,
} from 'astro:transitions/client';
import { interlude as config } from '../../interlude.config';
import { NONE, hasTransition, loadTransition } from './registry';
import { animatePage, destroyPage, initPage } from './lifecycle';
import { mediaReady } from './media';
import type { InterludePhase, Transition, TransitionContext } from './types';

type State = 'idle' | 'leaving' | 'covered' | 'entering';

/**
 * What each history entry remembers, so "back" and "forward" replay the right
 * transition. Kept in `history.state`, so it survives reloads.
 */
interface Memory {
  /** The transition that left this entry's page. */
  leave?: string;
  /** The transition that arrived on it. */
  arrive?: string;
}

const memory = (): Memory => history.state?.interlude ?? {};

function remember(key: keyof Memory, name: string) {
  if (!history.state) return; // the router gives every entry a state; don't invent one
  history.replaceState({ ...history.state, interlude: { ...memory(), [key]: name } }, '');
}

/** `revealOnLoad`'s settings: the transition the first page is revealed with, and its minimum cover time. */
const onLoad: { transition?: string; minCoverTime?: number } =
  typeof config.revealOnLoad === 'object' ? config.revealOnLoad : {};
const firstLoad = {
  transition: onLoad.transition ?? config.defaultTransition,
  minCoverTime: onLoad.minCoverTime ?? 0,
};

/** Loads a transition, or the default if it can't. `undefined` means none: swap instantly. */
async function resolve(name: string) {
  if (name === NONE) return undefined;
  return (await loadTransition(name)) ?? (await loadTransition(config.defaultTransition));
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Waits until the transition is `ready()` to play, but never longer than `timeout` (ms). */
function waitReady(transition: Transition, timeout: number) {
  const ready = Promise.resolve(transition.ready?.()).catch((error) => {
    console.error(`[interlude] "${transition.name}" failed in ready().`, error);
  });
  return Promise.race([ready, sleep(timeout)]);
}

/** Resolves once `ms` have passed since `since` (a `performance.now()` time): at once if they have. */
function until(since: number, ms: number) {
  const left = since + ms - performance.now();
  return left > 0 ? sleep(left) : Promise.resolve();
}

/** Stands in for `<main>` if a page has none, so transitions never get null. */
const detached = document.createElement('main');
/** The page's `<main>`: not one in the layer, where a transition may keep a copy of the page. */
const content = () =>
  document.querySelector<HTMLElement>('main:not([data-interlude] *)') ?? detached;

/** What scrolls the page: held while it's locked. */
const SCROLL_EVENTS = ['wheel', 'touchmove', 'keydown'] as const;
const SCROLL_KEYS = new Set([
  ' ',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

/**
 * Cancels a wheel turn, a touch drag or a scroll key, so the page doesn't move
 * under the cover. Shortcuts with a modifier (Alt+← for "back"…) still work.
 * Dragging the scrollbar can't be cancelled this way: only `overflow: hidden`
 * would stop it, and that hides classic scrollbars, shifting the page sideways.
 */
function holdScroll(event: Event) {
  if (event instanceof KeyboardEvent) {
    if (!SCROLL_KEYS.has(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
  }
  event.preventDefault();
}

type ContextOptions = Pick<
  TransitionContext,
  'from' | 'to' | 'direction' | 'trigger' | 'transition' | 'initial'
>;

class Controller {
  readonly root: HTMLElement;

  #state: State = 'idle';
  /** The transition of the current (or last) navigation. `null`: it has none, the page swaps instantly. */
  #transition: Transition | null = null;
  #context: TransitionContext;
  /** The transition the navigation in progress asked for (before reduced motion): what history remembers. */
  #requested = config.defaultTransition;
  #traverse = false;
  /** The animation a transition returned, so a new navigation can stop it. */
  #playing: gsap.core.Animation | null = null;
  /** The cover animation, while it plays: navigations that overlap share it. */
  #covering: Promise<void> | null = null;
  /** When the page was last fully covered (`performance.now()`), for the minimum cover times. */
  #coveredAt = 0;
  /** Increments with every navigation, so steps of an outdated one can bail out. */
  #run = 0;
  #booted = false;
  /** A page was swapped in and its `astro:page-load` hasn't been handled yet. */
  #swapped = false;
  /** The browser already animated this history navigation (a swipe back on touch devices). */
  #nativeSwipe = false;
  #reducedMotion: boolean;
  /** Where and when the pointer last went down: where a navigation starts on screen. */
  #pointer = { x: 0, y: 0, time: Number.NEGATIVE_INFINITY };
  /** What `#lock()` made inert, so only that is released (not what was inert already). */
  #locked = new Set<Element>();
  #listeners = new AbortController();
  /** Dev only (`?latency=2000`): how much longer every page takes to arrive, in ms. */
  #latency = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    root.dataset.ready = ''; // disarms the CSS failsafe that uncovers the page if scripts fail

    // Dev only, while authoring: ?slowmo=4 plays every animation four times
    // slower; ?latency=2000 shows what a transition does on a slow network.
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(location.search);
      const slowmo = Number(params.get('slowmo'));
      if (slowmo > 0) gsap.globalTimeline.timeScale(1 / slowmo);
      this.#latency = Math.max(0, Number(params.get('latency')) || 0);
    }

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.#reducedMotion = motion.matches;

    // The first page: covered if it's rendered that way (`revealOnLoad`).
    const here = new URL(location.href);
    this.#state = root.dataset.state === 'covered' ? 'covered' : 'idle';
    this.#context = this.#createContext({
      from: here,
      to: here,
      direction: 'forward',
      trigger: undefined,
      transition: NONE,
      initial: true,
    });
    if (this.#state === 'covered') {
      this.#coveredAt = performance.now(); // its minimum cover time counts from here
      this.#lock();
      loadTransition(this.#pick(firstLoad.transition)); // the one that will reveal it
    }

    // The transitions most likely to be needed first.
    loadTransition(config.defaultTransition);
    loadTransition(this.#pick(config.defaultTransition));

    const signal = this.#listeners.signal;
    motion.addEventListener('change', this.#onMotionChange, { signal });
    // Capture phase: runs before the router handles the same events.
    window.addEventListener('pointerdown', this.#onPointerDown, {
      signal,
      capture: true,
      passive: true,
    });
    window.addEventListener('click', this.#onClick, { signal, capture: true });
    window.addEventListener('popstate', this.#onPopState, { signal, capture: true });
    document.addEventListener('pointerover', this.#onIntent, { signal, passive: true });
    document.addEventListener('focusin', this.#onIntent, { signal });
    document.addEventListener('astro:before-preparation', this.#onBeforePreparation, { signal });
    document.addEventListener('astro:before-swap', this.#onBeforeSwap, { signal });
    document.addEventListener('astro:after-swap', this.#onAfterSwap, { signal });
    document.addEventListener('astro:page-load', this.#onPageLoad, { signal });

    // Set up the first page once every module script has run, page scripts
    // included: sooner than the router's first `astro:page-load`, which it
    // fires on `load`, after every image:
    // https://github.com/withastro/astro/blob/astro@7.3.5/packages/astro/src/transitions/router.ts#L646
    if (document.readyState === 'complete') this.#boot();
    else document.addEventListener('DOMContentLoaded', this.#boot, { signal, once: true });
  }

  /** Stops Interlude: removes its listeners, clears the layer and gives the page back. */
  destroy() {
    this.#run++;
    this.#listeners.abort();
    this.#stop();
    this.#clear();
    this.#unlock();
    controller = undefined;
  }

  #onBeforePreparation = (event: TransitionBeforePreparationEvent) => {
    const run = ++this.#run;
    this.#requested = this.#request(event);
    this.#traverse = event.navigationType === 'traverse';
    const name = this.#nativeSwipe ? NONE : this.#pick(this.#requested);
    this.#nativeSwipe = false;

    const context = this.#createContext({
      from: event.from,
      to: event.to,
      direction: event.direction === 'back' ? 'back' : 'forward',
      trigger: event.sourceElement,
      transition: name,
      initial: false,
    });
    this.#context = context;
    this.#emit('leave');

    if (name === NONE) {
      this.#transition = null;
      return;
    }

    this.#lock();
    const load = event.loader;
    event.loader = async () => {
      await Promise.all([
        load(),
        this.#cover(run, name, context),
        this.#latency && new Promise((resolve) => setTimeout(resolve, this.#latency)),
      ]);
    };
  };

  #onBeforeSwap = (event: TransitionBeforeSwapEvent) => {
    // Interlude does the animating: skip the browser's view transition, so
    // nothing (a `transition:name` morph…) plays over the layer. Skipping
    // rejects its `ready` promise, which nothing else waits for:
    // https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition/skipTransition
    event.viewTransition?.ready.catch(() => {});
    event.viewTransition?.skipTransition();
    if (!this.#traverse) remember('leave', this.#requested);
    destroyPage();
    // Without a cover, the old page is gone from here on.
    if (!this.#transition) this.#emit('covered');
  };

  #onAfterSwap = () => {
    this.#swapped = true;
    if (!this.#traverse) remember('arrive', this.#requested);
    // The new page stays locked until it's revealed.
    if (this.#state !== 'idle') this.#lock();
    this.#context.content = content();
    this.#prepare();
  };

  #onPageLoad = async () => {
    if (!this.#booted) return this.#boot();
    // Only after a swap: the first page's own `load` can come late, mid-navigation.
    if (!this.#swapped) return;
    this.#swapped = false;

    const run = this.#run;
    const transition = this.#transition;
    initPage(content());
    if (!transition) return this.#appear();
    await Promise.all([
      mediaReady(content(), { timeout: config.mediaTimeout }),
      until(this.#coveredAt, config.minCoverTime),
    ]);
    if (run === this.#run) await this.#reveal(run, transition);
  };

  /** The first page: set it up, and reveal it if it was rendered covered. */
  #boot = async () => {
    if (this.#booted) return;
    this.#booted = true;
    const run = this.#run;
    initPage(content());
    if (this.#state !== 'covered') return this.#appear();

    const transition = await resolve(this.#pick(firstLoad.transition));
    if (run !== this.#run) return;
    this.#transition = transition ?? null;
    this.#context.transition = transition?.name ?? NONE;
    // The transition's own cover, drawn now, so the wait shows it.
    if (transition?.cover) this.#drawFirstCover(transition);

    // The transition has to be ready to play: here, `enter` runs without a
    // `leave` before it, which would have waited for it.
    await Promise.all([
      transition ? waitReady(transition, config.mediaTimeout) : undefined,
      mediaReady(content(), { timeout: config.mediaTimeout }),
    ]);
    if (run !== this.#run) return;
    if (!transition) return this.#appear();
    await until(this.#coveredAt, firstLoad.minCoverTime);
    if (run !== this.#run) return;
    this.#prepare();
    await this.#reveal(run, transition);
  };

  /**
   * The first page's cover, from the transition's `cover()`: what its `leave`
   * ends with, built in the layer. The layer's own colour is only under it for
   * a solid transition, and off for one that hides the page another way.
   */
  #drawFirstCover(transition: Transition) {
    try {
      transition.cover?.(this.#context);
    } catch (error) {
      console.error(`[interlude] "${transition.name}" failed in cover().`, error);
    }
    this.root.dataset.cover = transition.solidCover === false ? 'custom' : 'solid';
  }

  /** What a navigation asks for: its link's transition, or the one history remembers. */
  #request(event: TransitionBeforePreparationEvent) {
    if (event.navigationType === 'traverse') {
      // History already points at the destination. Going back replays how we
      // left it (mirrored), going forward how we arrived there.
      const { leave, arrive } = memory();
      return (event.direction === 'back' ? leave : arrive) ?? config.defaultTransition;
    }
    // `data-transition` on the link, or on any ancestor (a whole nav, a list of cards…).
    return (
      event.sourceElement?.closest('[data-transition]')?.getAttribute('data-transition') ??
      config.defaultTransition
    );
  }

  /** What actually plays: reduced motion overrides what was asked for. */
  #pick(name: string) {
    if (!this.#reducedMotion) return name;
    return config.reducedMotion === 'fade' && hasTransition('fade') ? 'fade' : NONE;
  }

  /** Hovering, focusing or touching a link: load the transition it will play before it's needed. */
  #onIntent = (event: Event) => {
    const target = event.target as Element | null;
    const name = target?.closest?.('[data-transition]')?.getAttribute('data-transition');
    // With reduced motion that's `fade` (or none): don't download one that won't play.
    if (name) loadTransition(this.#pick(name));
  };

  /**
   * A plain click on a link to the page you're on: nothing to show, so nothing
   * happens (the router would fetch and swap the same page, with a transition).
   * Cancelled here, in the capture phase, because the router skips clicks that
   * were already cancelled. Links with a hash, to other sites or new tabs, with
   * a modifier key, and `data-astro-reload` links are left to the browser or
   * the router, as before.
   */
  #onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element | null)?.closest?.('a[href]');
    if (!(link instanceof HTMLAnchorElement)) return;
    if ((link.target && link.target !== '_self') || link.hasAttribute('download')) return;
    if (link.closest('[data-astro-reload]')) return;
    const to = new URL(link.href);
    if (to.href !== location.href || to.hash) return;
    event.preventDefault();
  };

  #onPointerDown = (event: PointerEvent) => {
    Object.assign(this.#pointer, { x: event.clientX, y: event.clientY, time: performance.now() });
    this.#onIntent(event);
  };

  #onPopState = (event: PopStateEvent) => {
    // `undefined` in browsers that don't support it:
    // https://developer.mozilla.org/en-US/docs/Web/API/PopStateEvent/hasUAVisualTransition
    this.#nativeSwipe = Boolean(event.hasUAVisualTransition);
  };

  /** The OS setting can change during a visit: follow it. */
  #onMotionChange = (event: MediaQueryListEvent) => {
    this.#reducedMotion = event.matches;
    loadTransition(this.#pick(config.defaultTransition));
  };

  /** Loads the transition, then covers the page with it, unless a newer navigation took over. */
  async #cover(run: number, name: string, context: TransitionContext) {
    const transition = await resolve(name);
    if (run !== this.#run) return;
    this.#transition = transition ?? null;
    context.transition = transition?.name ?? NONE;
    if (transition) await this.#leave(transition, context);
  }

  /** Covers the page. Idempotent: navigations that overlap share one cover. */
  #leave(transition: Transition, context: TransitionContext): Promise<void> {
    if (this.#state === 'covered') return Promise.resolve();
    if (this.#covering) return this.#covering;
    // Mid-reveal: stop it where it is, and cover from there.
    if (this.#state === 'entering') this.#stop();

    this.#state = 'leaving';
    this.#label(transition, context);
    this.root.dataset.state = 'leaving';
    animatePage('leave', context);
    const solid = transition.solidCover !== false;
    this.#covering = this.#play(transition, 'leave', context).then(() => {
      if (this.#state === 'leaving') this.#setCovered(solid);
    });
    return this.#covering;
  }

  #setCovered(solid: boolean) {
    // A solid cover is painted by the layer itself: the transition's panels can go.
    // Otherwise whatever `leave` left stays in place for `enter`.
    if (solid) this.root.replaceChildren();
    this.root.dataset.cover = solid ? 'solid' : 'custom';
    this.root.dataset.state = 'covered';
    this.#state = 'covered';
    this.#coveredAt = performance.now();
    this.#covering = null;
    this.#playing = null;
    this.#emit('covered');
  }

  /** The new page is in the DOM but not painted yet: let the transition set its starting state. */
  #prepare() {
    try {
      this.#transition?.prepare?.(this.#context);
    } catch (error) {
      console.error(`[interlude] "${this.#transition?.name}" failed in prepare().`, error);
    }
  }

  /** Plays `enter` over the swapped-in page, then gives the page back, unless a newer navigation took over. */
  async #reveal(run: number, transition: Transition) {
    const context = this.#context;
    context.content = content();
    context.entrance = transition.entrance ?? 0;
    this.#state = 'entering';
    this.#label(transition, context);
    this.#emit('enter');
    // `enter` builds its visuals synchronously; the layer drops its fill in the same frame.
    const done = this.#play(transition, 'enter', context);
    this.root.dataset.state = 'entering';
    animatePage('enter', context);
    await done;
    if (run === this.#run) this.#finish();
  }

  /** Shows a page without a transition: no animation, but the same hooks and events. */
  #appear() {
    this.#stop(); // an instant navigation can cut a transition short
    this.#context.content = content();
    // A first page nothing covered is on screen already: there's nothing to bring in.
    this.#context.entrance = this.#context.initial ? false : 0;
    this.#emit('enter');
    animatePage('enter', this.#context);
    this.#finish();
  }

  /** Runs `leave` or `enter`. Errors are logged, not thrown: a broken transition mustn't break navigation. */
  async #play(transition: Transition, step: 'leave' | 'enter', context: TransitionContext) {
    try {
      const result = transition[step](context);
      this.#playing = result instanceof gsap.core.Animation ? result : null;
      await result;
    } catch (error) {
      console.error(`[interlude] "${transition.name}" failed in ${step}().`, error);
    }
  }

  /** Stops what's animating on the layer and the content, and clears the layer. */
  #stop() {
    this.#playing?.kill();
    this.#playing = null;
    gsap.killTweensOf([...this.root.querySelectorAll('*'), this.#context.content]);
    this.root.replaceChildren();
  }

  /** Back to normal: clear the layer, give input, scrolling and focus back. */
  #finish() {
    this.#clear();
    this.#unlock();
    // Keyboard and screen reader users continue from the new content (Astro announces the title).
    if (!this.#context.initial) {
      const main = this.#context.content;
      // A plain <main> can't take focus: give it `tabindex="-1"` (focusable from code, not by Tab).
      if (!main.hasAttribute('tabindex')) main.tabIndex = -1;
      main.focus({ preventScroll: true });
    }
    this.#emit('idle');
  }

  #clear() {
    this.root.replaceChildren();
    this.root.dataset.state = 'idle';
    delete this.root.dataset.cover;
    delete this.root.dataset.transition;
    delete this.root.dataset.direction;
    this.#state = 'idle';
    this.#covering = null;
    this.#playing = null;
  }

  /**
   * Freezes the page while a transition runs: it can't be scrolled, and
   * nothing but the layer is reachable by pointer, keyboard or screen reader.
   */
  #lock() {
    // Not passive, so they can cancel. Adding the same listener again is a no-op.
    for (const type of SCROLL_EVENTS) window.addEventListener(type, holdScroll, { passive: false });
    for (const el of document.body.children) {
      if (el.contains(this.root) || el.hasAttribute('inert')) continue;
      el.setAttribute('inert', '');
      this.#locked.add(el);
    }
  }

  #unlock() {
    for (const type of SCROLL_EVENTS) window.removeEventListener(type, holdScroll);
    for (const el of this.#locked) el.removeAttribute('inert');
    this.#locked.clear();
  }

  /** Exposes the running transition on the layer, for CSS: `.interlude[data-transition='columns']`. */
  #label(transition: Transition, context: TransitionContext) {
    this.root.dataset.transition = transition.name;
    this.root.dataset.direction = context.direction;
  }

  #emit(phase: InterludePhase) {
    document.dispatchEvent(new CustomEvent(`interlude:${phase}`, { detail: this.#context }));
  }

  #createContext(options: ContextOptions): TransitionContext {
    return {
      ...options,
      root: this.root,
      content: content(),
      origin: this.#originOf(options.trigger),
      reducedMotion: this.#reducedMotion,
      entrance: false, // set once the page is revealed (#reveal, #appear)
    };
  }

  /** Where on screen the navigation started: the pointer if it was just used, else the trigger. */
  #originOf(trigger: Element | undefined) {
    if (performance.now() - this.#pointer.time < 1000) {
      return { x: this.#pointer.x, y: this.#pointer.y };
    }
    if (trigger) {
      const r = trigger.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }
}

export type { Controller };

let controller: Controller | undefined;

/**
 * Starts Interlude, once: later calls return the same instance. The layout
 * calls it (see `src/components/Interlude.astro`).
 */
export function startInterlude() {
  if (controller) return controller;
  const root = document.querySelector<HTMLElement>('[data-interlude]');
  if (!root) {
    console.warn('[interlude] No [data-interlude] element found: page transitions are off.');
    return;
  }
  controller = new Controller(root);
  return controller;
}
