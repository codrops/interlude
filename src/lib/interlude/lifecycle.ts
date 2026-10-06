/**
 * Per-page lifecycle: page scripts register hooks with `onPage()`, and the
 * controller runs them for whichever page is current.
 *
 * Pages are identified by `<html data-page="…">`, set by the layout.
 */
import type { PageHooks, PageMatcher, TransitionContext } from './types';

interface Registration {
  matches: (page: string) => boolean;
  hooks: PageHooks;
  cleanup?: () => void;
}

const registrations: Registration[] = [];

const toTest = (matcher: PageMatcher) => {
  if (typeof matcher === 'string') return (page: string) => page === matcher;
  if (matcher instanceof RegExp) return (page: string) => matcher.test(page);
  return matcher;
};

/** The current page's id, from `<html data-page>`. `''` if the layout didn't set one. */
export const currentPage = () => document.documentElement.dataset.page ?? '';

/**
 * Registers hooks for the pages that `matcher` matches: an id (`'home'`), a
 * pattern (`/^work\//`) or a function.
 */
export function onPage(matcher: PageMatcher, hooks: PageHooks) {
  registrations.push({ matches: toTest(matcher), hooks });
}

const forCurrentPage = () => {
  const page = currentPage();
  return registrations.filter((registration) => registration.matches(page));
};

/** The page is in the DOM: run `init` with its `<main>`, keeping any cleanup it returns. */
export function initPage(main: HTMLElement) {
  for (const registration of forCurrentPage()) {
    const cleanup = registration.hooks.init?.(main);
    if (typeof cleanup === 'function') registration.cleanup = cleanup;
  }
}

/** The page is leaving the DOM: run its cleanups and `destroy`. */
export function destroyPage() {
  for (const registration of forCurrentPage()) {
    registration.cleanup?.();
    registration.cleanup = undefined;
    registration.hooks.destroy?.();
  }
}

/** Runs the current page's `enter` or `leave` hooks alongside a transition. */
export function animatePage(phase: 'enter' | 'leave', context: TransitionContext) {
  for (const registration of forCurrentPage()) registration.hooks[phase]?.(context);
}
