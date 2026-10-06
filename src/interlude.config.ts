/**
 * Interlude settings. The transitions themselves live in `src/transitions/`.
 */
export const interlude = {
  /** Used when a link doesn't name one with `data-transition`. */
  defaultTransition: 'peel',

  /**
   * Cover the very first page load and reveal it with the default transition,
   * like a preloader. Off by default: it delays the first paint.
   */
  revealOnLoad: false,

  /**
   * With `prefers-reduced-motion`: `'none'` swaps pages instantly; `'fade'`
   * plays a transition named `fade` instead, if you add one to `src/transitions/`.
   */
  reducedMotion: 'none' as 'fade' | 'none',

  /**
   * Before revealing a page, wait for the images near the top to be decoded and
   * the fonts to be ready, but never longer than this (ms).
   */
  mediaTimeout: 1500,
};
