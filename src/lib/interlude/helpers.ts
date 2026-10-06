/**
 * Small helpers for writing transitions.
 */
import type { Transition, TransitionContext } from './types';

/** Wraps a transition's definition: gives transition files type checking and autocompletion. */
export const defineTransition = (transition: Transition): Transition => transition;

interface PanelOptions {
  /** Extra class names, e.g. for a transition's own CSS. */
  className?: string;
  /** Inline styles to start from. */
  style?: Partial<CSSStyleDeclaration>;
}

/**
 * Adds a full-screen panel (a filled layer) to the transition root and returns
 * it. Panels are cleared by the engine once a transition is over.
 */
export function panel(context: TransitionContext, { className, style }: PanelOptions = {}) {
  const el = document.createElement('div');
  el.className = className ? `interlude__panel ${className}` : 'interlude__panel';
  if (style) Object.assign(el.style, style);
  context.root.append(el);
  return el;
}

/** Distance from a point to the farthest corner of the viewport: a circle this big covers it. */
export function farthestCorner(x: number, y: number) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
}

/** The visitor asked for less motion (OS setting). */
export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** +1 going forward, -1 going back: multiply a movement by it to mirror it on "back". */
export const sign = (context: TransitionContext) => (context.direction === 'back' ? -1 : 1);
