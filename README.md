# Interlude

<!-- Placeholders: replace # with the live demo's address and the article's once they exist. -->

**[Demo](#) · [Article](#)**

A starter for custom page transitions in Astro, built on Astro's own client router: a small engine that plugs into `<ClientRouter />` and runs your own cover-and-reveal transitions, each in its own file in `src/transitions/`. It's a starter, not a library: there's no package to install. Copy the engine into your Astro site, keep the transitions you want, and write your own.

The demo is a small site about Interlude itself. Its home page is the list of transitions, set as one sentence: each name plays its transition on the way to its own page. Every page is white; a page can have another ground (grey and night are ready), so a transition can go from one colour to another.

## Quick start

```sh
npm install
npm run dev       # http://localhost:4321
npm run build     # type checks, then builds to dist/
npm run preview   # serves the build
```

Requires Node 22.12 or later.

## Add it to an existing Astro site

Interlude is a set of files you copy into your site, not a package. Built with Astro 7.3.

**1. Install GSAP:** `npm install gsap`. For the WebGL transitions, also `npm install three` and `npm install -D @types/three` (without the types, the type check fails, and so does the build).

**2. Copy these into your `src/`, at the same paths:**

- `src/lib/interlude/`: the engine. Without WebGL transitions, leave out `webgl.ts`.
- `src/components/Interlude.astro`: the layer the transitions draw in, and the script that starts Interlude.
- `src/interlude.config.ts`: the settings.
- The transitions you want, into `src/transitions/`: at least your default one (`peel`, unless you change `defaultTransition`, which needs `src/lib/interlude/old-page.ts`), and the one `revealOnLoad` names, if it names one. Each transition says at the top of its file what else it needs: the WebGL ones `src/lib/interlude/webgl.ts` and three.js, and `stack`, `slide-over`, `peel`, `slices`, `frame`, `carousel`, `cube`, `corner`, `tear` and `channel` `src/lib/interlude/old-page.ts`.

Keep Interlude's licence notice (`LICENSE`, MIT) with the copied files.

Some of the transitions carry the demo's content or colours. Adapt them at the top of their files:

- `particles` spells `WORD` ("Interlude"). Keep it short: a long word can't be read as dots on a phone.
- `typewriter` types `PHRASE`, the demo's tagline.
- `carousel` builds its row of pages from the links `LINKS` selects: the demo's header and list. Point it at your navigation.
- The colours come from your CSS when it defines them, and fall back to the demo's otherwise: `--red` (`frame`, `corner`, `ink`, `spiral`, `velvet`), `--color-accent` (`dissolve`, `particles`), `--color-bg` (`particles`). `typewriter` uses `--font-mono`.

**3. In your layout,** add Astro's router and the layer:

```astro
---
import { ClientRouter } from 'astro:transitions';
import Interlude from '../components/Interlude.astro';
---

<html lang="en" transition:animate="none">
  <head>
    <!-- … -->
    <ClientRouter />
  </head>
  <body>
    <Interlude />
    <!-- your header… -->
    <main tabindex="-1">
      <slot />
    </main>
  </body>
</html>
```

- `<ClientRouter />` turns on Astro's client-side navigation, which Interlude runs on.
- `transition:animate="none"` turns off Astro's own view transition animations: Interlude does the animating.
- `<Interlude />` must be a direct child of `<body>`.
- Each page's content goes in a `<main>`: it's what transitions get as `context.content`. After each navigation, focus moves to it, so keyboard and screen reader users continue from the new content. `tabindex="-1"` lets it take focus (the engine adds it if it's missing); add `main:focus { outline: none; }` to your CSS, so no outline is drawn around the page.

**4. In your CSS,** set the transitions' cover colour, and keep the page from widening while a transition moves it sideways (a scrollbar can flash otherwise):

```css
:root {
  --interlude-color: #111;
}

body {
  overflow-x: clip;
}
```

**5. For the WebGL transitions,** add this to `astro.config.mjs`:

```js
vite: {
  optimizeDeps: { include: ['three/webgpu', 'three/tsl'] },
  build: { chunkSizeWarningLimit: 1000 },
},
```

If your config already has a `vite` block (for a Tailwind plugin, say), add these two lines to it rather than a second block, which would replace the first. The first line bundles three.js up front in development, so the first WebGL transition doesn't make Vite reload the page. The second raises Vite's warning about large files above three.js's size: only WebGL transitions load it.

Every link between your pages now plays the default transition. Pick others per link with `data-transition` (see [Using transitions](#using-transitions)).

**What it costs:** every page loads GSAP (about 28 kB compressed), Astro's router (about 5 kB), the engine (about 4 kB) and the default transition (and with `revealOnLoad`, the one that reveals the first page). Each other transition loads when a link that uses it is hovered, focused or touched, and three.js (about 240 kB) only with a WebGL transition. Copying all the transitions costs nothing until one is used.

### Your site's scripts

With `<ClientRouter />`, a navigation doesn't load a new document: the router swaps the new page in, and skips every script it has already run, recognised by its `src` or its text. That includes bundled scripts, the ones Astro inlines, and `is:inline` ones. So code that sets up a page when it loads now runs on the first page only: on the pages after it, buttons, menus and carousels stay dead, without an error.

- **Set up pages in `onPage()`** ([Page scripts](#page-scripts)). `onPage(() => true, { init(main) { … } })` runs `init` on every page. Return a cleanup from it for whatever outlives the page: listeners on `window` or `document`, `matchMedia` listeners, library instances.
- **To match a page by its id** (`onPage('home', …)`), give your `<html>` a `data-page` attribute in the layout (the demo's comes from its `page` prop). `onPage(() => true, …)`, for every page, needs nothing.
- **`onPage()` works from a component's own `<script>`** too, not only from `src/scripts/pages/`: the script runs before its page is set up, also when that page is reached by a navigation.
- **Prefer it to `astro:page-load`:** on the first load, the router fires `astro:page-load` only once every image has loaded, so on a page with many images its buttons wait for them. `onPage()` runs as soon as the HTML is ready.
- **Look for the page's elements inside `main`,** the page's `<main>` that `init` gets, not in the whole document: during a transition, a still copy of the old page can be in the layer, with the same classes and data attributes. Outside `<main>`, use ids, which the copy doesn't keep.
- **Every file in `src/scripts/pages/` is loaded on every page.** Import a heavy library (a carousel, a map) with `await import()` inside `init`, so only the pages that use it download it.
- **An `is:inline` script that must run on every page** needs `data-astro-rerun`.
- **`<html>`'s attributes are replaced on each navigation** with the new page's: a class a script set on it (a theme, a library's state) is gone after a navigation.
- **Modal dialogs** (a `<dialog>` opened with `showModal()`: a menu, a cart) sit above everything, the transition's layer included. Close them on `interlude:leave` ([Events](#events)), or the cover plays behind them and they vanish at the swap.
- **A link to the page you're on does nothing** ([Details](#details)), where it used to reload the page: a menu that closed on reload stays open. Close it when one of its links is clicked.
- **Forms** that submit to your own site go through the router too. Add `data-astro-reload` to a form that must post as a normal page load.
- **`transition:name` and `transition:animate` on elements won't play:** Interlude skips the browser's view transition, so nothing animates over its layer.
- **Check your features on a page reached by a link, and after going back,** not only on a fresh load: that's where a missed script shows.

### Optional, from the demo

- **The content's entrance:** copy `src/scripts/pages/entrance.ts` (files in `src/scripts/pages/` are loaded by themselves) and mark elements with `data-entrance` ([The entrance](#the-entrance)).
- **Smooth scrolling:** `npm install lenis`, copy `src/scripts/smooth-scroll.ts`, import it in a `<script>` at the end of your layout, and copy the `html.lenis` rule from `src/styles/global.css`. If your site already uses Lenis, do with yours what that file does: stop it on `interlude:leave`, bring it to the scroll position Astro sets after the swap (`astro:after-swap`), and start it again on `interlude:idle`. `interlude:leave` fires before the layer changes state, so to know whether a transition is running, set a flag on `interlude:leave` and clear it on `interlude:idle`, rather than reading the layer. The demo's `html.lenis` rule keeps the scrollbar while Lenis is stopped for a transition; if your site also stops Lenis for its own reasons (a dialog's scroll lock), don't copy the rule as it is, or it undoes that lock's `overflow` too: limit it to transitions, with a class your script sets on `interlude:leave` and removes on `interlude:idle`.
- **The loader:** copy `src/components/Loader.astro` and add `<Loader />` to your layout.

## Start a new site from this one

Clone the repository, then remove what only the demo uses:

- **The demo's pages:** `src/pages/index.astro`, `src/pages/start.astro` and `src/pages/transitions/`. Keep `src/pages/404.astro` and adapt it.
- **The transition pages' content:** `src/content/transitions/`, the `transitions` collection in `src/content.config.ts`, and the posters in `src/assets/transitions/`.
- **The list of transitions:** `src/lib/transitions.ts` and `src/components/TransitionIndex.astro`. The header and the footer (`Header.astro`, `Footer.astro`) use them: replace both with your own.
- **The Back link's script,** `src/scripts/pages/back-link.ts`, made for the transition pages.
- **The transitions you don't use,** in `src/transitions/`. Keep the default one (`peel`, unless you change `defaultTransition`), and the one `revealOnLoad` names, if it names one.

Then put in your own details:

- `src/config/site.ts`: the name, tagline, description, author and links, and `src/assets/share.jpg`, the image a shared link shows.
- `astro.config.mjs`: `site` (your domain) and the fonts.
- `public/`: the favicons.
- `src/styles/global.css`: the colours and type. `--interlude-color` is the transitions' cover colour.

Optional, from the demo, to keep or remove: the content's entrance (`src/scripts/pages/entrance.ts`), smooth scrolling (`src/scripts/smooth-scroll.ts`, its `<script>` in the layout, and the `lenis` package), and the loader (`src/components/Loader.astro`, and `<Loader />` in the layout). Without WebGL transitions, also remove `src/lib/interlude/webgl.ts`, the `optimizeDeps` and `chunkSizeWarningLimit` lines in `astro.config.mjs`, and the `three` and `@types/three` packages.

## How it works

Astro's client router (`<ClientRouter />`) fetches the next page, swaps the DOM and updates the history. It fires events along the way, and one of them, `astro:before-preparation`, has a replaceable `loader`: the router waits for it before swapping. Interlude wraps that loader, so the page gets covered before the swap and revealed after it.

```
click
  astro:before-preparation  ->  cover the page (transition.leave)    } at the
                                fetch the next page                  } same time
  astro:before-swap         ->  clean up the old page
  (Astro swaps the page under the cover and sets the scroll position)
  astro:after-swap          ->  set the new page's starting state (transition.prepare)
  astro:page-load           ->  set up the new page, wait for fonts and images,
                                then reveal it (transition.enter)
```

The cover and the fetch run at the same time, so a navigation costs whichever is longer, not both. On a slow connection the page stays covered until the next one arrives.

The transitions draw inside one persistent layer (`<Interlude />` in the layout, kept across navigations with `transition:persist`). Astro's own view transition animations are turned off (`transition:animate="none"`), and the browser's view transition is skipped, so nothing plays over the layer.

[docs/how-it-works.md](docs/how-it-works.md) walks through the whole flow step by step: the first page load, a navigation, back and forward, and what happens when navigations overlap.

## Interlude and Barba

[Barba.js](https://barba.js.org) is the usual choice for custom page transitions, in Astro too, and Interlude borrows its shape: a transition is a `leave` and an `enter`. The difference is the router. Barba replaces Astro's with its own; Interlude keeps Astro's and adds the cover and the reveal around it. In practice:

|                                         | Barba in Astro                                                 | Interlude                                                                                                                     |
| --------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Fetching, swapping, history             | Barba, about 10 kB gzipped, instead of `<ClientRouter />`      | Astro's `<ClientRouter />`, about 5 kB, and Interlude, about 4 kB, plus GSAP (about 28 kB), which the transitions use         |
| What a navigation swaps                 | The container (`data-barba="container"`) and the title         | The whole page, `<head>` included: each page's styles, scripts and metadata                                                   |
| Astro's page scripts, `astro:page-load` | Don't run on Barba's navigations: redo that setup in its hooks | Run as usual                                                                                                                  |
| Scroll position, back and forward       | Recorded; restoring it is up to you                            | Restored by Astro                                                                                                             |
| Screen readers and focus                | Up to you                                                      | Astro announces the new page; Interlude moves focus to it and locks the page meanwhile                                        |
| A click or "back" mid-transition        | A full page load, or ignored with `preventRunning`             | Carries on from there: a cover in progress is shared, a reveal turns around                                                   |
| Old and new page on screen together     | Yes, with `sync: true`, both live                              | Yes, with `keepOldPage()`: the old page as a still copy, which can start moving on the click, before the next page has loaded |
| Choosing a transition                   | Rules: by namespace, route, or a function                      | Per link, with `data-transition`, and replayed by history                                                                     |
| Outside Astro                           | Works on any site                                              | Astro only                                                                                                                    |

So Barba fits better when the site isn't only Astro, or when the old page has to stay live during a transition (a video playing on, say). Interlude is for keeping Astro's router doing its job, and adding transitions on top.

## When Astro's view transitions are enough

Astro's own [view transitions](https://docs.astro.build/en/guides/view-transitions/) animate a picture of the old page and one of the new page with CSS (`transition:animate`, which takes your own keyframes, 3D included), and morph matching elements from one page to the other (`transition:name`). If that's what you need (a fade, a slide, a page turning, a card's image growing into the next page), you don't need Interlude.

Interlude is for what they can't do:

- **Respond on the click:** cover the page right away, and hold the cover while the next page loads. Astro's start once it has loaded.
- **Draw in between:** panels, canvases, WebGL shaders. Astro's have the two pictures and CSS.
- **Work with the page itself:** slice it, move its parts one by one.
- **Turn around** when someone goes back mid-transition, instead of cutting off.
- **Pick the transition per link,** replayed by history, with the new page's fonts and images ready before it shows.

Some of the included transitions (`curtain`, `wipe`, `slide-over`) could be done natively with some CSS, and a plain fade is what Astro does out of the box, so the demo has none. They're here as simple examples of writing a transition, and for the behaviour above. The WebGL ones can't. One site uses one or the other: Interlude turns Astro's view transition animations off, so they don't play over its layer.

## Using transitions

Pick a transition with `data-transition` on a link, or on any ancestor, to set one for a whole group of links:

```html
<a href="/about/" data-transition="circle">About</a>

<ul data-transition="wipe">
  <li><a href="/work/one/">One</a></li>
  <li><a href="/work/two/">Two</a></li>
</ul>

<a href="/contact/" data-transition="none">Contact, swapped instantly</a>
```

Links without one use `defaultTransition` from `src/interlude.config.ts`.

- **Back and forward** replay the transition each history entry was reached with, with `context.direction` set to `back` going back. Each transition decides what that means: in the demo, `curtain` and `wipe` run the other way, `slide-over`, `peel`, `frame` and `corner` play backwards, `tear` runs up from the bottom, `carousel` slides towards the page it's going to, whichever side it's on, `cube` turns the other way, and `stack` stays the same. It's remembered per entry (in `history.state`), so it stays right when a page is in the history more than once.
- **The first page load** isn't covered by default. Set `revealOnLoad: true` to cover it and reveal it with the default transition, like a preloader, or give that first reveal settings of its own: `revealOnLoad: { transition: 'curtain', minCoverTime: 1200 }`. `minCoverTime` keeps the first page covered at least that long (ms) from when Interlude starts: for an intro, or a preloader of the site's own, drawn above the layer (as `src/components/Loader.astro` is) and gone on `interlude:enter`. The cover is painted before any script runs, in `--interlude-color`. Then, if the transition has a `cover()`, the engine draws it (see "Writing a transition" below): that's the transition's own cover, text or shape, shown during the wait. Without one, the first reveal starts from the plain colour. It works best with a transition that starts from a plain cover: `curtain`, `wipe`, `columns`, `circle`, or a WebGL one but `particles` (three.js then loads with the first page). The others need the old page, and fade instead, unless they have a `cover()`. For a transition whose cover has another colour, paint the first cover to match: the layer is rendered with the name of the transition that will reveal it, so `.interlude[data-state='covered'][data-transition='ink'] { background: var(--red); }` does it (the demo does that for `ink` and `velvet`, in `src/styles/global.css`).
- **A minimum cover time:** `minCoverTime` keeps the page covered at least that long (ms) on each navigation, counted from the end of `leave`, even if the next page is ready sooner: for a cover that's meant to be seen. At 0, the default, the next page is revealed as soon as it's ready. Where it holds depends on the transition: one whose `leave` covers the page (`curtain`, the WebGL ones) holds its cover; one that keeps the old page still until `enter` (`peel`, `slide-over`, `slices`, `frame`, `corner`) holds the page as it was clicked, and the demo's loader shows, so the wait doesn't look like a click that did nothing.
- **Reduced motion:** visitors who prefer it get no transition: pages swap without animation. For a short fade instead, add a `fade` transition and set `reducedMotion: 'fade'`. A change of the setting during a visit is picked up too.

Included: five overlays, `curtain`, `wipe`, `circle`, `columns` and `typewriter` (the cover has content of its own: a grid typing the tagline); `stack`, `slide-over`, `peel` (the default), `slices`, `frame`, `carousel`, `cube`, `corner` and `tear`, which move the page itself and show the old page and the new one together; and seven WebGL ones: `dither` (squares, coarse to fine, each filling in with a pattern of dots), `dissolve`, `ink`, `spiral` (a dark spiral from the click, with a red glow along its edge), `velvet` (a red stage curtain drawn across from the right, its folds swaying while the next page loads), `particles` (a scene of its own: particles forming the site's name, which the pointer pushes aside while the page loads) and `channel` (TV static, with the page jumping sideways under it, and static that keeps moving while the next page loads). The demo's home page lists them all, grouped from the simplest kind to the most involved, and every other page ends with the same list.

## Writing a transition

A transition has two halves: `leave` covers the current page, and `enter` uncovers the next one once it's in. From scratch:

**1. Add a file to `src/transitions/`.** The file name is the transition's name: it's registered automatically, and appears in the demo's list of transitions.

```ts
// src/transitions/slide-up.ts
import { gsap } from 'gsap';
import { defineTransition, panel } from '../lib/interlude';

// Settings: how long each half takes, and how it eases.
const LEAVE = { duration: 0.8, ease: 'power2.inOut' };
const ENTER = { duration: 0.8, ease: 'power2.out' };

export default defineTransition({
  name: 'slide-up',
  entrance: 0.2, // the page's content starts coming in 0.2 s into enter()

  // Cover the page: a panel slides up from below the screen.
  // Return the animation: the engine waits for it, and can stop it.
  leave(context) {
    return gsap.fromTo(panel(context), { yPercent: 100 }, { yPercent: 0, ...LEAVE });
  },

  // Uncover the next page: a new panel, covering at first, slides on up.
  enter(context) {
    return gsap.fromTo(panel(context), { yPercent: 0 }, { yPercent: -100, ...ENTER });
  },
});
```

**2. Use it** on a link: `<a href="/about/" data-transition="slide-up">`.

**3. Tune it.** Every transition in `src/transitions/` keeps its settings at the top of its file: durations, eases, distances. The eases are [GSAP's](https://gsap.com/docs/v3/Easing/): covers mostly ease in and out, reveals mostly ease out, and any GSAP ease works, like `{ duration: 1.4, ease: 'expo.inOut' }`. In development, add `?slowmo=6` to the URL to play everything six times slower, and `?latency=2000` to make every page take 2 seconds longer to arrive, as on a slow network (both last for the visit).

**4. Say when the page's content comes in** with `entrance`: how many seconds into `enter` the page's own entrance animations start (see [The entrance](#the-entrance)). Early for a cover that's quickly gone, later for one that lingers, `false` if the transition brings the content in itself. Without it, the content starts with `enter`.

**5. In the demo**, give it a page: a Markdown file in `src/content/transitions/` sets its group in the list, its order and summary, and optionally the image its page is shared with. Until then it's listed under "More".

The rules:

- **Draw inside the layer with `panel()`**, which adds a full-screen filled element to `context.root`. Don't style the root itself: the engine owns it, clears it after each transition, and paints it solid while the page is covered.
- **Return your animation.** GSAP tweens and timelines work as they are, and so does any promise. If a navigation interrupts the reveal (the back button, mid-transition), the engine stops what `enter` returned, clears the layer and starts the next `leave` from wherever things are.
- **In `enter`, build synchronously**, before the first `await`. The engine clears the solid cover in the same frame.
- **Set up ahead with `ready()`:** a transition that needs something set up before it can play (a WebGL renderer, say) returns a promise from `ready()` that resolves once it is. `leave` can wait for it itself, but `enter` can't: on the first page with `revealOnLoad`, where `enter` runs without a `leave` before it, the engine waits for `ready()` first (up to `mediaTimeout`). `shaderCover()` sets it for the WebGL transitions.
- **Draw the first page's cover with `cover()`:** on the first page with `revealOnLoad`, there's no `leave`, so the cover a visitor sees during the wait is the layer's colour, unless the transition has `cover(context)`. Write it as a function `leave` also calls, so the two can't drift apart: `cover` builds what `leave` ends with, in `context.root`, synchronously, and the engine calls it as soon as the transition has loaded, before the wait. `enter` then finds what `cover` built in `context.root`, and removes it or reuses it. `cover` only draws: move the page's content in `prepare` and `enter`. A transition with `solidCover: false` keeps its panels in place until `enter`, as it does after `leave`.
- **`context`** has everything else: `content` (the page's `<main>`, old in `leave`, new in `enter`), `from` and `to` URLs, `direction`, `trigger` (the clicked link), `origin` (where the click was, in px), `transition` (the name in use), `reducedMotion`, `initial` (the first page load) and `entrance`.
- **Helpers** in `src/lib/interlude`: `panel()`, `farthestCorner(x, y)` (the radius that covers the screen from a point) and `sign(context)` (+1 forward, -1 back).
- **CSS hook:** while a transition runs, the layer carries `data-transition="its-name"` and `data-direction`, so it can have its own styles.

Each transition is its own small chunk, loaded when a link that uses it is hovered, focused or touched, or at the latest when the navigation starts (while the next page is fetched anyway). The default one is loaded up front, and so is the one that reveals the first page with `revealOnLoad`. So a heavy transition only costs the visitors who trigger it.

If a transition throws, the error is logged and the navigation still completes: the page is never left covered.

### Without a solid cover

Some transitions hide the page their own way: by moving the content itself, or with their own canvas. Set `solidCover: false` and the layer stays see-through, with whatever `leave` left in place until `enter` takes over. Then use `prepare` to set the new page's starting state: it runs right after the swap, before the new page is painted.

The WebGL transitions work this way: their canvas does the covering (see below). A transition can also move the page itself: say the page's blocks leave one after another, and `prepare` hides the next page's blocks before they're painted:

```ts
// The page's blocks: what's directly in <main>.
const blocks = (context: TransitionContext) => [...context.content.children];

export default defineTransition({
  name: 'sink',
  solidCover: false,
  entrance: false, // it brings the content in itself
  leave: (context) => gsap.to(blocks(context), { y: -60, opacity: 0, stagger: 0.07 }),
  prepare: (context) => gsap.set(blocks(context), { y: 60, opacity: 0 }),
  enter: (context) => gsap.to(blocks(context), { y: 0, opacity: 1, stagger: 0.07 }),
});
```

`entrance: false` keeps the page's own entrance animations out of the way, so the content isn't animated twice.

### Keeping the old page on screen

Some transitions show both pages at once, like Barba's `sync` mode: the new page slides over the old one, or an image flies from one to the other. Astro swaps the whole page in one go, so the old one can't stay. Instead, `keepOldPage()` puts a still copy of it in the layer, where it lasts through the swap, and `enter` animates it together with the real new page underneath:

```ts
import { keepOldPage, oldPage } from '../lib/interlude/old-page';

export default defineTransition({
  name: 'step-back',
  solidCover: false, // the copy does the covering
  leave(context) {
    // A still copy of the page, in the layer. It can start moving right away,
    // while the next page loads.
    const old = keepOldPage(context);
    return gsap.to(old, { scale: 0.95, duration: 0.6 });
  },
  enter(context) {
    // The same copy, still there, over the real new page.
    const old = oldPage(context);
    return gsap.to(old, { opacity: 0, duration: 0.6 });
  },
});
```

- **The copy looks like the page and does nothing:** no scripts, no ids, nothing focusable, and components, embeds and videos don't start again. Videos and canvases are painted as they were, and the page's styles are kept with it, since Astro swaps the `<head>` too.
- **It keeps the old page's look after the swap:** it carries `<body>`'s classes, data attributes and layout, so a per-page theme set on `<body>` (the demo's `data-ground`) still applies to it. Write such styles as `[data-…]` or `.class` selectors, not `body…`: the copy is a `<div>`.
- **It's a still picture.** A video stops on its frame, and a component stops responding, until the transition is over. A web component's shadow DOM isn't copied, and CSS that targets ids or `<html>`'s attributes doesn't reach the copy.
- **The layer is in front of the page,** so to bring the new page over the old one, clip the copy away where the new page has arrived: `slide-over.ts` does that.
- **Move on the click, or wait:** `leave` can start moving the copy right away, while the next page loads (`stack` does), or leave it still and play everything in `enter`, as one movement once the next page is ready (`slide-over`, `peel` and `frame` do; the demo's loader shows if the wait is long).
- **Going back, the same film backwards:** then the new page is the one that moves, so it can't be the real page under the layer. `slide-over` brings it forward as a copy (`copyPage()`), under the old page sliding away; `peel` leaves it under the copy and cuts the copy away where the returning sheet has landed.
- **`copyPage(context)`** makes another still copy of the page as it is now, without the styles: for more pieces of the old page in `leave`, or of the new page in `enter`. `slices.ts` uses one copy of each page per column.
- **`pageBlocks(context)`** gives the real page's blocks (header, main, footer), to move the whole new page; `pageColor()` its background colour.
- **A strip of pages made on the spot** (`carousel`): nothing is prerendered or stored. In `leave`, it reads the links of the page you're on (`LINKS`, at the top of `carousel.ts`) and makes one card for each distinct page of the site, in the order the links appear. A card is only a name in the site's own look, taken from the link's text, except two: the page you're leaving (`keepOldPage()`) and the one you're going to (`copyPage()`, in `enter`), which are real copies. Both ends are in the strip even if no link leads there. For your own site, point `LINKS` at your navigation, or build `pagesFromLinks()` from your sitemap or content collection.
- `old-page.ts` isn't exported from `src/lib/interlude/index.ts`, so it's only downloaded with the transitions that import it.

The demo has nine: `stack` (the old page steps back and a sheet covers it), `slide-over` (the next page slides over the old one), `peel` (the page turns over like a sheet of paper), `slices` (the page breaks into columns, and in each the next page pushes the old one out), `frame` (a red rectangle grows from the middle of the screen, then the next page in a window just behind it, inside a red frame), `carousel` (the page zooms out into a row of all the pages, the row slides to the next one, and it zooms in), `cube` (the page is one face of a box: it pulls back on the click, then turns over, the old page going down and the next one coming round from above), `corner` (a red rectangle and a black one grow from the top left corner, then the next page grows over them from the same corner) and `tear` (the page is torn in two like a sheet of paper, and the halves pull apart).

### WebGL transitions

A WebGL transition only describes its shader: how much of each pixel is covered, from 0 (the page shows) to 1 (covered). `shaderCover()`, in `src/lib/interlude/webgl.ts`, does the rest: the canvas in the layer, the animation, interruptions, being ready for a first page with `revealOnLoad` (`ready()`), and a fade where WebGL isn't available.

```ts
// src/transitions/spot.ts
import { defineTransition } from '../lib/interlude';
import { below, reach, shaderCover } from '../lib/interlude/webgl';

export default defineTransition({
  name: 'spot',
  ...shaderCover({
    // Covered inside a circle growing from where the navigation started.
    shader: ({ position, origin, aspect, progress }) =>
      below(position.distance(origin).div(reach(origin, aspect)), progress),
  }),
});
```

- **The shader is written in [TSL](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)**, three.js's shading language, which its `WebGPURenderer` compiles for WebGPU, or for WebGL 2 where WebGPU isn't available.
- **It gets**, as TSL nodes: `position` (this pixel, in screen heights from the top left), `origin`, `progress` (0 to 1 while covering, 1 to 0 while revealing), `reveal` (0 while covering, 1 while revealing, so the reveal can look different), `direction` (1 or -1), `aspect`, `time` and `color` (`--interlude-color`).
- **It returns** the coverage, or `{ alpha, color }` to colour it too (`dissolve.ts` adds a glowing rim that way).
- **Timing:** `shaderCover({ leave: { duration: 1.2 }, enter: { duration: 1.2, ease: 'expo.out' }, shader })`. Each half defaults to 1 second, `'power2.inOut'` covering and `'power2.out'` revealing.
- **Moving while covered:** frames are drawn only while the cover animates, so a full cover holds still while the next page loads. A shader that moves on its own with `time` sets `live: true` to keep drawing until the reveal (`channel.ts`'s static does).
- **Helpers:** `below(field, threshold, softness)` draws an edge, crisp and anti-aliased, or soft with `softness`; `reach(origin, aspect)` is the distance to the farthest corner; `cssColor('--color-accent')` reads a colour from the CSS.
- **Your own `leave` and `enter`** around `shaderCover()`'s, to add something under the canvas (`channel.ts` does): keep its `ready` too, `ready: cover.ready`.
- **Weight:** three.js is about 240 kB compressed. It's bundled with the WebGL transitions only, so it's downloaded when a link that uses one is hovered, focused or touched, not on the first page load (unless a WebGL transition reveals it, with `revealOnLoad`).

For more than a full-screen shader, like particles or meshes, draw a scene of your own with the shared renderer: `await layerRenderer(context)` in `leave` gives it, with its canvas added to the layer and sized to the screen (or `null` without WebGL: fall back to a fade), and `currentRenderer()` gets it back in `enter`. `particles.ts` does that, moving thousands of particles on the GPU. For anything else (textures, a scene that stays on screen), [docs/how-it-works.md](docs/how-it-works.md#8-adding-a-webgl-transition) lists what to take care of.

## Page scripts

Per-page code (carousels, observers, content animations) goes in `src/scripts/pages/`, or in a component's own `<script>`. Every file in `src/scripts/pages/` is loaded once per visit, whatever the page, and registers its hooks with `onPage()`:

```ts
import { onPage } from '../../lib/interlude';

onPage('home', {
  // The page is in the DOM, before its reveal. Return a cleanup if needed.
  init(main) {
    const carousel = createCarousel(main.querySelector('.carousel'));
    return () => carousel.destroy();
  },
  // Alongside the reveal / the cover: animate the page's own content.
  enter(context) {},
  leave(context) {},
  // Just before the page is swapped out.
  destroy() {},
});
```

Pages are identified by `<html data-page="…">`, set with the layout's `page` prop (`<BaseLayout page="transition">`). Match an id, a pattern (`/^trans/`) or anything with a function (`() => true` for every page). `src/scripts/pages/entrance.ts` is a complete example.

`init` gets the page's `<main>`: look for the page's elements inside it, not in the whole document. During a transition, the layer can still hold a still copy of the old page ([Keeping the old page on screen](#keeping-the-old-page-on-screen)), with the same classes and data attributes, and it comes before `<main>` in the document: `document.querySelector('.carousel')` could find the copy's. For elements outside `<main>` (a header, a cart count), use ids, which the copy doesn't keep, or leave out the layer: `:not([data-interlude] *)`.

`enter` runs whenever a page is shown, also without a transition: after `data-transition="none"`, and on the first load (`context.initial`). To animate content in, start `context.entrance` seconds in: that's when the transition says its cover is out of the way. It's `false` when there's nothing to animate in: the transition moves the content itself, or it's a first page nothing covered, already on screen. On the first load, `init` runs as soon as the document is parsed, without waiting for images.

### The entrance

How each page's content comes in is the demo's own page script, `src/scripts/pages/entrance.ts`, not part of the engine: every site animates its content its own way, or not at all. Mark elements in a page, and they come in as the page is revealed (the ones on screen) or as they scroll into view (the rest):

```html
<p data-entrance>Fades in, moving a little (rising, by default).</p>
<h1 data-entrance="lines">Each line comes in from behind a mask.</h1>
<div data-entrance="image"><img … /></div>
<!-- the frame opens (upwards, by default) while the image zooms out -->
```

Its durations, distances and ease are settings at the top of the file. The line effect uses GSAP's [SplitText](https://gsap.com/docs/v3/Plugins/SplitText/).

The transition decides whether and when the content comes in (`entrance`); the site decides how. The content can come in differently after each transition, to match it: list the transition in `BY_TRANSITION`, at the top of the file, with the side the content comes in from, or `'here'` for it to only fade in, where it is:

```ts
const BY_TRANSITION: Record<string, Style> = {
  curtain: { from: 'below', back: 'above' }, // rising with the curtain, and sinking going back
  stack: { from: 'here' }, // only fading in: the sheet was the page's colour, and nothing else moves
};
```

Going back, content comes in from the same place; a transition that runs another way going back says where its content comes from with `back` (`curtain` runs top to bottom, so its content sinks). Transitions that aren't listed use `DEFAULT`, which also applies to what comes in on scroll.

## Design choices

The engine makes no visual decisions; the demo does, and they're all meant to be changed:

- **Each transition's timing**: the settings at the top of its file, and its `entrance`.
- **The eases**: each transition's own, at the top of its file; covers mostly ease in and out, reveals mostly ease out.
- **Smooth scrolling** with [Lenis](https://github.com/darkroomengineering/lenis), in `src/scripts/smooth-scroll.ts` (see [Details](#details)).
- **The content's entrance**: three kinds (move, lines, image), all `expo.out`, 1.2 to 1.8 seconds, 0.03 seconds apart, rising by default (and sinking going back after `curtain`, which runs top to bottom then: the last element leads, the mirror image of rising), and only fading in after `stack`. After `wipe`, `circle`, `typewriter`, the WebGL transitions and those that move the page itself, the page is there as it is once uncovered (their `entrance: false`). All in `src/scripts/pages/entrance.ts`.
- **`curtain` and `wipe` move the whole page too**: the old page drifts out and the new one in. With `curtain` that's on top of the content's entrance; `wipe` has none, the page arrives as one.
- **A loader at the cursor** while the next page loads, for `slide-over`, `peel`, `slices`, `frame`, `carousel`, `cube`, `corner` and `tear` only (they wait for the next page before they show it), and only after 300 ms of waiting, also when the wait is `minCoverTime` holding the cover (most of these show nothing moving until the reveal): `src/components/Loader.astro`, which follows Interlude's events. List other transitions in its `SHOW_FOR`, or remove `<Loader />` from the layout.
- **`cube`'s lift**: on the click the page pulls back, still facing you, while the next page loads; then the box turns and comes forward. How far back and the timings are settings at the top of the file.
- **`peel`'s shadow**: the sheet darkens a little as it turns away, and the page under it is in its shadow, dark where it first shows and lighter as the sheet goes (`DIM` and `UNDER` at the top of the file).
- **`tear`'s paper**: the tear starts above where you clicked (kept away from the sides), wanders in a few slow waves with a little roughness, and has a paper-coloured torn edge, a little warmer than the page, with fibres here and there and a hairline shadow. The halves pull apart and tilt, each with a soft shadow. They go just far enough for the wider half to leave the screen. Its speed, the halves' tilt and the edge are settings at the top of the file.
- **`velvet`'s curtain**: the site's red, drawn in from the right and back again, the hem trailing behind the top while it moves, and lit folds that bunch up as it gathers and sway while the page loads (`live`); the page beside it dims as it closes and brightens as it opens. The folds, the trail, the sway, the sheen, the shadow and the dimming are settings at the top of the file.
- **`dither`'s squares**: three sizes, each half the one before; the big ones first, the small ones filling the gaps, each square coming in as a pattern of dots (a 4×4 Bayer matrix, as in 1-bit images) that fills in to solid. The sizes, how many of each switch on, the stagger and the dots' size are settings at the top of the file.
- **`channel`'s static**: black and white, in bands that flicker in and out about fourteen times a second, with scanlines and a rolling bar over the page, and the page jumping sideways under it; the grain, the speeds and the jumps are settings at the top of the file. It replaces the loader for this transition: the static moving is the wait.
- **`particles`' word**: "Interlude", in light and accent dots on the dark cover. The word, the dots' number and size, the timing and the pointer's push are settings at the top of the file.
- **`typewriter`'s phrase**: the tagline, in white on a black sheet. The phrase, the speeds and the grid are settings at the top of the file.
- **Each page's ground**: white on every page for now (`ground` on the layout, or `ground` in a transition's Markdown for its page; `data-ground` on `<body>`). Grey and night grounds are ready: with a page on another ground, a transition goes from one colour to the other.
- **The colours**: the grounds' (`[data-ground]`), `--interlude-color` (the cover), `--color-accent` (also `dissolve`'s rim) and `--red` (also the colour of `ink`, `frame`, `corner` and `velvet`, the light of `spiral`, and the first page's cover when `ink` or `velvet` reveals it), in `src/styles/global.css`. On the home page the names are black, and the others dim while one is pointed at or focused; in the list that ends the other pages, they're dimmed with the current one lit. The dim colour keeps a 3:1 contrast on its ground, the minimum for large text.

## Events

For code that isn't tied to one page (analytics, a menu, an audio player, a WebGL scene…), each step of a navigation is also an event on `document`, with the transition's `context` as `detail`:

| Event               | When                                                           |
| ------------------- | -------------------------------------------------------------- |
| `interlude:leave`   | A navigation starts: the page is about to be covered.          |
| `interlude:covered` | The old page is hidden; the swap comes next.                   |
| `interlude:enter`   | The new page is about to be revealed (also on the first load). |
| `interlude:idle`    | It's over: the page is interactive again.                      |

```ts
document.addEventListener('interlude:leave', () => menu.close());
document.addEventListener('interlude:idle', ({ detail }) => track(detail.to.pathname));
```

They fire in that order for every navigation, including ones without a transition. The first load has `enter` and `idle` only. `interlude:leave` fires before the layer changes state: to know whether a transition is running, set a flag on `interlude:leave` and clear it on `interlude:idle`.

## Configuration

`src/interlude.config.ts`:

| Option              | Default  |                                                                                                                             |
| ------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| `defaultTransition` | `'peel'` | Used by links without `data-transition`.                                                                                    |
| `minCoverTime`      | `0`      | Shortest time (ms) the page stays covered on a navigation.                                                                  |
| `revealOnLoad`      | `false`  | Cover the first page, then reveal it (like a preloader). `true`, or `{ transition, minCoverTime }` for settings of its own. |
| `reducedMotion`     | `'none'` | With reduced motion: `'none'`, or `'fade'` (add a `fade` transition).                                                       |
| `mediaTimeout`      | `1500`   | Longest wait (ms) for fonts and images before a reveal, and on the first load for the transition's `ready()`.               |

The transition colour is `--interlude-color` in `src/styles/global.css`.

## Details

- **Smooth scrolling** is the demo's, not Interlude's: `src/scripts/smooth-scroll.ts` runs one [Lenis](https://github.com/darkroomengineering/lenis) instance for the whole visit, and follows Interlude's events. It stops when a transition starts (`interlude:leave`), catches up after each swap with the scroll position Astro's router set (the top, or where you were when going back), and starts again when the page is shown (`interlude:idle`). It's off with reduced motion. To scroll natively, remove its `<script>` from the layout.
- **Waiting for media:** before a reveal, the fonts and the images near the top of the page are awaited with `img.decode()`, capped by `mediaTimeout`. Lazy images further down aren't forced to load.
- **Overlapping navigations** (clicking back mid-transition, for instance) share one cover instead of starting another, and outdated steps are dropped.
- **Links to the current page do nothing:** a plain click on a link to the page you're on is cancelled, so no transition plays between two identical pages. Links with a hash, to other sites or new tabs, with a modifier key, and `data-astro-reload` links are left alone.
- **Native swipe back:** when the browser already animated a history navigation (a swipe on touch devices), the swap happens without a transition.
- **Prefetching:** links are prefetched on hover or focus, so the next page is often ready before the cover finishes.
- **Starting and stopping:** the layout starts Interlude once with `startInterlude()` (calling it again returns the same instance). `destroy()` on that instance removes it and gives the page back.

## Accessibility

- While a transition runs, everything but the layer is `inert` (header and footer included): no clicks, no keyboard focus, hidden from screen readers. The page can't be scrolled either (wheel, touch and scroll keys), so it doesn't move under the cover. The new page stays locked until it's revealed.
- After each navigation, focus moves to `<main>`, and Astro announces the new page title to screen readers.
- `prefers-reduced-motion` is respected (see above), and the demo's smooth scrolling is off.
- If JavaScript is off, or fails to start, there's no cover: a CSS failsafe uncovers the first page after three seconds, and without scripts the links are plain page loads.
- The demo pages have a skip link, landmark regions, `aria-current` in the navigation and visible focus styles.

## SEO and performance

Every page is a complete HTML file with real links, so search engines crawl the site like any static one: the transitions don't get in the way. The layout's `<Seo>` component (`src/components/Seo.astro`) fills in the rest from `src/config/site.ts` and each page's props:

- the title, description and canonical URL, built from `site` in `astro.config.mjs`: set it to your domain;
- an image for sharing on every page: `site.image` by default, or the page's own (the `image` prop: each transition's page shares its poster, if it has one), served as a 1200px JPEG;
- the author (`site.author`): the `author` meta tag, the X account shown on shared links (`twitter:site`), and the publisher in the structured data;
- the favicons: `public/favicon.svg` for browsers, and PNG copies for Google Search, which doesn't show SVG favicons (`favicon.png`), and for iOS (`apple-touch-icon.png`). Replace all three with yours;
- structured data (JSON-LD) on the home page, from `src/lib/structured-data.ts`;
- `noindex` on the 404 page.

`@astrojs/sitemap` writes the sitemap, and `src/pages/robots.txt.ts` points to it.

The fonts are self-hosted with Astro's Fonts API (`fonts` in `astro.config.mjs`): preloaded, with fallback fonts adjusted to their metrics, so the text doesn't shift when they arrive. The styles are inlined in each page, so no stylesheet request holds back the first paint.

Google measures loading speed and layout shifts on the first page load, the one a link from elsewhere opens, and the transitions don't run on it. It also measures how quickly the page responds to clicks, and that includes the clicks that start a transition: keep the work a transition does on the click light (a large scene, or many copies of the page, can delay that first frame).

## Checking changes

```sh
npm run format:check   # formatting (npm run format fixes it)
npm run build          # type checks, then builds
```

There are no automated tests. Before shipping a change, click through every transition (the list on the home page), go back and forward, use the keyboard (Tab, Enter), turn on reduced motion, and keep the console clean. In development, `?slowmo=6` plays the animations six times slower, and `?latency=2000` makes pages arrive 2 seconds late, to see the covers and the loader wait.

## Structure

```
src/
├── interlude.config.ts      settings
├── transitions/             one file per transition: add yours here
├── lib/interlude/           the engine
│   ├── controller.ts        router events, cover, reveal, locking, focus, events
│   ├── registry.ts          loads src/transitions/* on demand
│   ├── lifecycle.ts         onPage() and the page hooks
│   ├── helpers.ts           defineTransition(), panel(), farthestCorner(), sign()
│   ├── webgl.ts             shaderCover(): WebGL transitions (three.js, TSL)
│   ├── old-page.ts          keepOldPage(): the old page on screen with the new one
│   ├── media.ts             waiting for fonts and images
│   ├── types.ts             Transition, TransitionContext, PageHooks, events
│   └── index.ts             what transitions and page scripts import
├── lib/transitions.ts       getTransitions(): the demo's transitions, grouped and in order
├── lib/structured-data.ts   JSON-LD for search engines
├── config/site.ts           the site's name, description, author, links and share image
├── scripts/pages/           page scripts (onPage): entrance.ts brings each page's content in, back-link.ts makes the Back link a history step, chosen.ts keeps the clicked link looking hovered during a transition
├── scripts/smooth-scroll.ts the demo's smooth scrolling (Lenis)
├── components/              Interlude (the layer), Loader, Seo, header, footer, TransitionIndex (the list as a sentence)
├── layouts/BaseLayout.astro
├── pages/                   the demo site
├── content/transitions/     a page for each transition (Markdown)
├── assets/transitions/      their posters, each page's image for sharing
├── assets/share.jpg         the default image for sharing a page
└── styles/global.css        tokens, reset, shared styles
docs/how-it-works.md         the whole flow, step by step
```

## Credits

- [Astro](https://astro.build)
- [GSAP](https://gsap.com)
- [three.js](https://threejs.org)
- [Lenis](https://github.com/darkroomengineering/lenis)
- [Inter](https://rsms.me/inter/) and [JetBrains Mono](https://www.jetbrains.com/lp/mono/), via Fontsource
- The `typewriter` transition is inspired by the type animation of The Manifest, by Studio Freight, shared by [Lídia Santos](https://www.linkedin.com/posts/inventorylidia_too-often-in-the-creative-world-we-see-the-activity-7431778963980443648-jglF)
- The `peel` transition is inspired by the page turn on [eminente.art](https://eminente.art/)
- The `stack` transition is inspired by the project page transition on [Olga Prudka's site](https://olgaprudka.com/)
- The `frame` transition is inspired by the page transition on [Benoît Marzouvanlian's site](https://www.benmarzouvanlian.com/)
- The `corner` transition is inspired by [a post by Oli](https://x.com/olvhrs/status/1899756396897333632) on X

## Maintenance

Interlude is shared as a starting point to copy and adapt. It isn't actively maintained, so issues and pull requests may not get a reply.

## License

[MIT](LICENSE)

## Misc

Follow Codrops: [X](https://x.com/codrops), [Facebook](https://www.facebook.com/codrops), [Instagram](https://www.instagram.com/codropsss/), [LinkedIn](https://www.linkedin.com/company/codrops/), [GitHub](https://github.com/codrops)
