## Project

Interlude: a starter for custom page transitions in Astro, built on Astro's own
client router (`<ClientRouter />`) and GSAP. The README explains how to use it
and how it's built, and `docs/how-it-works.md` follows a navigation step by
step: read both before changing the engine.

- The engine is `src/lib/interlude/`. Transitions are `src/transitions/*.ts`,
  one per file, with a `name` equal to the file name (the registry loads them
  by file name) and a default export made with `defineTransition`. Page
  scripts are `src/scripts/pages/*.ts`, registered with `onPage()`.
- Transitions and page scripts import from `src/lib/interlude` (`index.ts`),
  never from `registry.ts` or `controller.ts`: the registry loads transitions,
  and the layout starts the controller once. Two modules are left out of
  `index.ts` so that they're only downloaded with the transitions that use
  them, which import them directly: `webgl.ts` (`shaderCover()`,
  `layerRenderer()`, with three.js) and `old-page.ts` (`keepOldPage()`,
  `copyPage()`, for showing the old and new pages together).
- Transitions draw only inside `context.root` (the layer), and return their
  GSAP animation, so the engine can stop it if a navigation interrupts. The
  controller owns the layer's own attributes and styles. A transition that
  covers the page with something other than its panels (a canvas, a copy of
  the old page) sets `solidCover: false`; one that moves the page itself also
  hides the new content in `prepare` (see "Without a solid cover" in the
  README).
- The page's content comes in with the demo's entrance
  (`src/scripts/pages/entrance.ts`, `data-entrance` in the markup), not with the
  engine. A transition says whether and when it comes in with `entrance`
  (seconds into `enter`, or `false` for none), and page scripts read
  `context.entrance`, never a transition's name. How the content comes in is
  the site's choice, and can differ per transition (`BY_TRANSITION` in
  `entrance.ts`).
- Code that isn't tied to one page listens to the `interlude:*` events on
  `document` (see `types.ts`) instead of reaching into the controller.
- The engine waits for images with `img.decode()` (`media.ts`): no
  image-loading libraries. It doesn't scroll: the demo's smooth scrolling is
  Lenis, in `src/scripts/smooth-scroll.ts`, driven by the `interlude:*` events.
- Fonts go through Astro's Fonts API (`fonts` in `astro.config.mjs`), not CSS
  imports. Page metadata (titles, share images, JSON-LD, `noindex`) goes
  through `src/components/Seo.astro`, from the layout's props. The site's
  name, tagline, description, author and links are in `src/config/site.ts`.
- Each transition has a page in the demo: `src/content/transitions/<name>.md`
  (its group, order, summary, poster and poster description, then a
  description). A transition without one is still listed, under "More".

## Conventions

- TypeScript strict, and Prettier with the repo's `.prettierrc`
  (`npm run format`).
- People read the code to learn from it: comment what a step does when the code
  doesn't show it (GSAP's position parameter, shader maths, a DOM detail), and
  why, briefly. Shared styles live in `src/styles/global.css`, shared
  transition helpers in `src/lib/interlude/helpers.ts`.
- Settings go at the top of their file, named, each with a comment. In a
  transition, durations and eases are `{ duration, ease }` objects (`LEAVE`,
  `ENTER`, or named after what they time). A design choice that isn't the
  engine's (a timing, an ease, an effect) gets a line in the README's "Design
  choices".
- Accessible and mobile first: landmarks, focus, reduced motion, and no
  sideways scrolling at 390px wide.
- Texts on the site and in the docs are plain and factual: they say what
  something does, without selling it.

## Checking changes

- `npm run format:check` and `npm run build` (which runs `astro check` first)
  must pass with no errors and no warnings.
- There are no automated tests. In the browser, click through every transition
  (the list on the home page), go back and forward, use the keyboard (Tab,
  Enter), turn on reduced motion, and keep the console clean. In development,
  `?slowmo=6` plays the animations six times slower, and `?latency=2000` makes
  pages arrive 2 seconds late, to see the covers and the loader wait.
- If a change alters what happens during a page load or a navigation (the
  order of steps, events, hooks, history, locking, the layer's states), update
  `docs/how-it-works.md` in the same change.
- Keep the README current: if a change touches what people use or set (the
  author API, the options, the files "Add it to an existing Astro site" lists,
  a design choice, the comparison with Barba), update it in the same change.

## Development

Start the dev server in the background:

```
npx astro dev --background
```

Manage it with `npx astro dev stop`, `npx astro dev status` and
`npx astro dev logs`.

## Astro documentation

https://docs.astro.build. The guides closest to this project:

- [Routing](https://docs.astro.build/en/guides/routing/)
- [Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Content collections](https://docs.astro.build/en/guides/content-collections/)
- [Styling](https://docs.astro.build/en/guides/styling/)
- [View transitions and the client router](https://docs.astro.build/en/guides/view-transitions/)
