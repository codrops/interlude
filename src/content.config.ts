import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * A page for each transition: one Markdown file in `src/content/transitions/`,
 * named like the transition's file. The body says how it's made.
 */
const transitions = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/transitions' }),
  schema: ({ image }) =>
    z.object({
      /** See `groups` in `src/lib/transitions.ts`. */
      group: z.enum(['overlays', 'page', 'shaders']),
      /** Position in its group: simplest first. */
      order: z.number(),
      summary: z.string(),
      /**
       * The transition caught halfway, relative to the Markdown file: the
       * image shown when the page is shared. Optional: without one, the page
       * shares the site's default image (`site.image`).
       */
      poster: image().optional(),
      /** What the poster shows, for people who can't see it. */
      posterAlt: z.string().optional(),
      /**
       * The page's ground, if not white like the others: `grey` for one that
       * should match the home page (see `stack.md`).
       */
      ground: z.enum(['white', 'grey', 'night']).optional(),
    }),
});

export const collections = { transitions };
