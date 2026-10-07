/**
 * Interlude settings. The transitions themselves live in `src/transitions/`.
 */

/** `revealOnLoad`: on or off, or on with settings of its own. */
type RevealOnLoad = boolean | { transition?: string; minCoverTime?: number };

export const interlude = {
  /** Used when a link doesn't name one with `data-transition`. */
  defaultTransition: 'peel',

  /**
   * On each navigation, keep the page covered at least this long (ms) before
   * the next one is revealed, even if it's ready sooner: for a cover that's
   * meant to be seen. Counted from the end of `leave`: with `curtain`, the
   * cover holds; with `peel`, which keeps the old page still until `enter`, the
   * page holds as it was clicked (the demo's loader shows then). 0 reveals it
   * as soon as it's ready. The first page load has its own, in `revealOnLoad`.
   */
  minCoverTime: 0,

  /**
   * Cover the very first page load and reveal it, like a preloader. Off by
   * default: it delays the first paint. `true` reveals it with the default
   * transition. Or set:
   * - `transition`: another one for this first reveal. Choose one that starts
   *   from a plain cover (`curtain`, `wipe`, `columns`, `circle`, or a WebGL one
   *   but `particles`): the others need the old page, and fade instead.
   * - `minCoverTime`: keep it covered at least this long (ms), counted from when
   *   Interlude starts: for an intro, or a preloader of the site's own.
   */
  revealOnLoad: false as RevealOnLoad,

  /**
   * With `prefers-reduced-motion`: `'none'` swaps pages instantly; `'fade'`
   * plays a transition named `fade` instead, if you add one to `src/transitions/`.
   */
  reducedMotion: 'none' as 'fade' | 'none',

  /**
   * Before revealing a page, wait for the images near the top to be decoded and
   * the fonts to be ready, but never longer than this (ms). On a first load
   * with `revealOnLoad`, the same goes for the transition to be ready.
   */
  mediaTimeout: 1500,
};
