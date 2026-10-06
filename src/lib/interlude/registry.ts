/**
 * The transition registry. Every module in `src/transitions/` is picked up
 * automatically, under its file name, which must also be its `name`.
 *
 * Transitions are loaded on demand: when a link that uses one is hovered,
 * focused or touched, or at the latest when the navigation starts (while the
 * next page is being fetched anyway). A heavy transition then only costs the
 * visitors who trigger it.
 *
 * Only the controller imports this module. Transitions import the author API
 * (`src/lib/interlude/index.ts`) instead, which avoids a circular import.
 */
import type { Transition } from './types';

type Module = { default: Transition };

/** Reserved name: swap the page with no transition (`data-transition="none"`). */
export const NONE = 'none';

/**
 * Each transition's name (its file name), and a function that imports it.
 * `import.meta.glob` lists the files when the site is built, without importing
 * them: each import becomes a chunk of its own, downloaded when it's called.
 */
const loaders = new Map<string, () => Promise<Module>>(
  Object.entries(import.meta.glob<Module>('/src/transitions/*.ts')).map(([path, load]) => [
    path.split('/').pop()!.replace(/\.ts$/, ''),
    load,
  ])
);

/** Transitions loading or loaded, so each is downloaded once. */
const loaded = new Map<string, Promise<Transition | undefined>>();
const warned = new Set<string>();

/** Warns about a mistake once per visit, not on every navigation. */
function warnOnce(message: string) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`[interlude] ${message}`);
}

/** Whether `src/transitions/<name>.ts` exists, without loading it. */
export const hasTransition = (name: string) => loaders.has(name);

/** Loads a transition by name. Resolves to `undefined` if there's none (or it fails to load). */
export function loadTransition(name: string): Promise<Transition | undefined> {
  let pending = loaded.get(name);
  if (pending) return pending;

  const load = loaders.get(name);
  if (!load) {
    if (name !== NONE) warnOnce(`No transition named "${name}" in src/transitions/.`);
    return Promise.resolve(undefined);
  }

  pending = load()
    .then(({ default: transition }) => {
      if (!transition?.leave || !transition?.enter) {
        warnOnce(`src/transitions/${name}.ts has no default export made with defineTransition().`);
        return undefined;
      }
      if (transition.name !== name) {
        warnOnce(`src/transitions/${name}.ts is named "${transition.name}": use the file name.`);
      }
      return transition;
    })
    .catch((error) => {
      console.error(`[interlude] Couldn't load the "${name}" transition.`, error);
      loaded.delete(name); // let a later navigation try again
      return undefined;
    });
  loaded.set(name, pending);
  return pending;
}
