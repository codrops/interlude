/**
 * The demo's transitions, grouped and ordered: every file in
 * `src/transitions/`, with its entry in `src/content/transitions/` if it has
 * one. A transition without an entry is still listed, under "More".
 */
import { getCollection, type CollectionEntry } from 'astro:content';

/** From the simplest kind to the most involved. */
export const groups = [
  { id: 'overlays', label: 'Overlays', description: 'A shape covers the page.' },
  { id: 'page', label: 'Moving the page', description: 'No cover: the page itself moves.' },
  { id: 'shaders', label: 'Shaders', description: 'A WebGL shader covers the page.' },
  { id: 'more', label: 'More', description: 'Not described yet.' },
] as const;

export type Group = (typeof groups)[number];

export interface TransitionInfo {
  name: string;
  group: Group;
  entry?: CollectionEntry<'transitions'>;
}

/** The transition files, by name (only their paths: nothing is imported). */
const names = Object.keys(import.meta.glob('/src/transitions/*.ts')).map((path) =>
  path.split('/').pop()!.replace(/\.ts$/, '')
);

/** Every transition, in order: by group, then simplest first. */
export async function getTransitions(): Promise<TransitionInfo[]> {
  const entries = new Map((await getCollection('transitions')).map((entry) => [entry.id, entry]));
  return names
    .map((name) => {
      const entry = entries.get(name);
      const group = groups.find(({ id }) => id === (entry?.data.group ?? 'more'))!;
      return { name, group, entry };
    })
    .sort(
      (a, b) =>
        groups.indexOf(a.group) - groups.indexOf(b.group) ||
        (a.entry?.data.order ?? 0) - (b.entry?.data.order ?? 0) ||
        a.name.localeCompare(b.name)
    );
}

/** The transitions in their groups, leaving out empty groups. */
export async function getTransitionGroups() {
  const transitions = await getTransitions();
  return groups
    .map((group) => ({ ...group, transitions: transitions.filter((t) => t.group === group) }))
    .filter((group) => group.transitions.length > 0);
}

/** The page of a transition. */
export const transitionPath = (name: string) => `/transitions/${name}/`;

/** A transition's number in the list (`index` from 0), as shown: `01`, `02`… */
export const transitionNumber = (index: number) => String(index + 1).padStart(2, '0');
