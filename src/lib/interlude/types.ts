/**
 * Interlude: types shared by the engine, transitions and page scripts.
 * (`gsap.core.Animation` is a global type, declared by GSAP's own types.)
 */

export type Direction = 'forward' | 'back';

/** Everything a transition gets to work with. */
export interface TransitionContext {
  /**
   * The persistent layer above the page. Build the transition's visuals inside
   * it (see `panel()` in helpers), never on the root element itself: the engine
   * owns the root's state and clears it between transitions.
   */
  root: HTMLElement;
  /** The page content (`<main>`). The old page during `leave`, the new one during `enter`. */
  content: HTMLElement;
  /**
   * The name of the transition in use, or `'none'` when the page is swapped
   * without one (reduced motion set to `'none'`, `data-transition="none"`, the
   * first load without `revealOnLoad`…).
   */
  transition: string;
  from: URL;
  to: URL;
  /** `back` for history navigation backwards, so a transition can play mirrored. */
  direction: Direction;
  /** The link or button that started the navigation, if any. */
  trigger: Element | undefined;
  /** Where the navigation "came from" on screen, in px: the pointer, or the trigger's centre. */
  origin: { x: number; y: number };
  /**
   * The visitor prefers reduced motion (an OS setting), as of the navigation's
   * start. The engine then plays nothing, or `fade` if there's one and
   * `reducedMotion` asks for it (`interlude.config.ts`); page hooks check it to
   * skip their own animations.
   */
  reducedMotion: boolean;
  /** True on the very first page load (there was no `leave`). */
  initial: boolean;
  /**
   * When the page's own content may start coming in, in seconds from the start
   * of the reveal: the transition's `entrance` (0 without a transition).
   * `false` when there's nothing to bring in: the transition moves the content
   * itself, or the page is already on screen (a first load nothing covered).
   * Set as the page is revealed, for the page hooks' `enter`.
   */
  entrance: number | false;
}

/** What `leave` and `enter` may return: nothing, a promise, or a GSAP tween or timeline. */
export type Awaitable = void | PromiseLike<unknown> | gsap.core.Animation;

/** A page transition: how the current page gets covered, and how the next one is revealed. */
export interface Transition {
  /** Unique name, used as `data-transition="name"` on links. Same as the file name. */
  name: string;
  /** Cover the current page. Resolve once it's completely hidden. */
  leave(context: TransitionContext): Awaitable;
  /**
   * Reveal the new page. Build what you need synchronously (before the first
   * `await`): the layer drops its solid fill in the same frame.
   */
  enter(context: TransitionContext): Awaitable;
  /**
   * Right after the new page is swapped in, before it paints: set its starting
   * state, e.g. hide content that `enter` will bring in.
   */
  prepare?(context: TransitionContext): void;
  /**
   * Resolves once the transition can play, for one that sets something up
   * asynchronously (`shaderCover()`: the WebGL renderer). `leave` can wait for
   * it itself, but `enter` can't: the engine waits for it, up to
   * `mediaTimeout`, before revealing the first page with `revealOnLoad`, where
   * `enter` runs without a `leave` before it.
   */
  ready?(): PromiseLike<unknown>;
  /**
   * The cover of a first page load (`revealOnLoad`), drawn while the page waits
   * to be revealed: what `leave` ends with, built synchronously in
   * `context.root`. Write it as a function that `leave` also calls, so the two
   * can't drift apart. `enter` then finds what `cover` built in `context.root`
   * (and removes it, or reuses it). It only draws: the page's content is for
   * `prepare` and `enter` to move. Without it, the first page's cover is the
   * layer's own colour, as for any transition.
   */
  cover?(context: TransitionContext): void;
  /**
   * By default the layer is painted solid while the page is covered, and
   * `enter` starts from that. Set to `false` when the transition hides the
   * page some other way (by moving the content itself, with its own canvas…):
   * the layer then stays see-through, and whatever `leave` built stays in
   * place until `enter` takes over.
   */
  solidCover?: boolean;
  /**
   * When the page's own content starts coming in (the site's entrance
   * animations, run by page scripts), in seconds after `enter` starts: early
   * for a cover that's quickly gone, later for one that lingers. `false` when
   * the transition brings the content in itself. Defaults to 0.
   */
  entrance?: number | false;
}

/** Matches the page id set on `<html data-page="…">` by the layout. */
export type PageMatcher = string | RegExp | ((page: string) => boolean);

/** Hooks a page script can register with `onPage()`. */
export interface PageHooks {
  /**
   * The page is in the DOM, before it's revealed. Set things up here (carousels,
   * observers…). May return a cleanup function, called before the page leaves.
   *
   * `main` is the page's `<main>`. Look for the page's elements inside it, not in
   * the whole document: during a transition, the layer can still hold a copy of
   * the old page, with the same classes and data attributes, before `<main>` in
   * the document.
   */
  init?: (main: HTMLElement) => void | (() => void);
  /**
   * The page is being revealed: animate its content in. Also runs when a page
   * is shown without a transition, including the first load (`context.initial`),
   * where the page is usually on screen already (`context.entrance` is `false`).
   */
  enter?: (context: TransitionContext) => void;
  /** The page is being covered: animate its content out. */
  leave?: (context: TransitionContext) => void;
  /** The page is about to be swapped out. */
  destroy?: () => void;
}

/**
 * Events dispatched on `document` at each step of a navigation, for code that
 * isn't tied to one page (analytics, a menu, a player, a cursor…):
 *
 *   interlude:leave    a navigation starts: the page is about to be covered
 *   interlude:covered  the old page is hidden (the swap happens next)
 *   interlude:enter    the new page is about to be revealed (also on the first load)
 *   interlude:idle     the reveal is over: the page is interactive again
 */
export type InterludePhase = 'leave' | 'covered' | 'enter' | 'idle';

declare global {
  interface DocumentEventMap {
    'interlude:leave': CustomEvent<TransitionContext>;
    'interlude:covered': CustomEvent<TransitionContext>;
    'interlude:enter': CustomEvent<TransitionContext>;
    'interlude:idle': CustomEvent<TransitionContext>;
  }
}
