/**
 * Interlude's author API: what transitions and page scripts import.
 *
 *   import { defineTransition, panel } from '../lib/interlude';
 *   import { onPage } from '../../lib/interlude';
 *
 * The controller isn't exported here: the layout starts it once (see
 * `src/components/Interlude.astro`).
 */
export { onPage, currentPage } from './lifecycle';
export { defineTransition, panel, farthestCorner, sign, prefersReducedMotion } from './helpers';
export type {
  Awaitable,
  Direction,
  InterludePhase,
  PageHooks,
  PageMatcher,
  Transition,
  TransitionContext,
} from './types';
