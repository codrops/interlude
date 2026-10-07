# How Interlude works

This page walks through what happens when someone visits a site built with Interlude, in order: the first page load, a click on a link, the back and forward buttons, and a navigation that interrupts another. The last two sections cover WebGL transitions and transitions that keep the old page on screen. For each step it says what the browser, Astro's router and Interlude do.

The [README](../README.md) explains how to use Interlude. Read this page when you want to change the engine, debug a transition, or understand why a transition behaves the way it does. Almost everything below happens in [`src/lib/interlude/controller.ts`](../src/lib/interlude/controller.ts), and the names like `#onBeforePreparation` are its methods, so you can follow along in the code.

## The idea

On a classic website, every link loads a new document. The browser throws away the old page, with all its elements and scripts, and builds the next one from scratch. Nothing survives the change, so nothing can animate across it.

Astro's client router (`<ClientRouter />`) works differently. It intercepts clicks on the site's own links, fetches the next page in the background, and swaps the new page's content into the current document. The document itself stays, so scripts keep running, and elements marked `transition:persist` are carried over to the next page.

Interlude relies on two features of the router:

1. **An element that's never replaced.** The layer (`<Interlude />`) is a full-screen element above the page, marked `transition:persist`. A transition covers the old page with it, and the layer is still there, still covering, once the new page has been swapped in underneath.
2. **A way to make the router wait.** Before swapping, the router fires `astro:before-preparation` and waits for that event's `loader`, the function that fetches the next page. Interlude replaces the loader with one that fetches the page _and_ plays the cover, and only finishes when both are done. So the router can't swap pages until the old one is hidden.

The rest (choosing a transition, revealing the new page, history, accessibility) is built around those two.

## The pieces

| Piece                 | Where                                                | What it does                                                                                                                             |
| --------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Astro's client router | `<ClientRouter />` in `src/layouts/BaseLayout.astro` | Intercepts links, fetches pages, swaps the DOM, updates history and scroll, fires the `astro:*` events                                   |
| The layer             | `src/components/Interlude.astro`                     | A full-screen element above the page, kept across navigations. Transitions draw inside it                                                |
| The controller        | `src/lib/interlude/controller.ts`                    | Listens to the router's events and runs each navigation: picks the transition, locks the page, covers it, reveals the next               |
| Transitions           | `src/transitions/*.ts`                               | The animations: `leave` covers, `enter` reveals, `prepare` is optional. Loaded on demand by `registry.ts`                                |
| Page scripts          | `src/scripts/pages/*.ts`                             | Code for particular pages, registered with `onPage()` (see `lifecycle.ts`)                                                               |
| Settings              | `src/interlude.config.ts`                            | The default transition, a minimum cover time, covering the first page load or not (and how), reduced motion, how long to wait for images |

## 1. The first page load

The first request is an ordinary one: the browser asks for a URL and gets back a complete HTML document. This project builds to static files (`npm run build` writes them to `dist/`), so any static host can serve them. In development, Astro's dev server renders each page when it's requested.

Three things in that HTML matter here:

- **`<meta name="astro-view-transitions-enabled">`**, added by `<ClientRouter />`. The router only takes over navigations between pages that have it.
- **`<html data-page="home">`**, set with the layout's `page` prop. It tells page scripts which page this is.
- **The layer**, `<div class="interlude" data-interlude data-state="idle">`. With `revealOnLoad`, it's rendered with `data-state="covered"` instead, and its CSS paints it solid before any script runs. It also carries `data-transition`, the name of the transition that will reveal the page, so the site's CSS can paint the cover to match it.

Then the scripts run. They're JavaScript modules, which run once the HTML is parsed, just before `DOMContentLoaded`:

1. **Astro's router** gives the current history entry a state, `{ index, scrollX, scrollY }` (its position in the history, and the scroll position), and starts listening for link clicks, form submissions and the back and forward buttons (`popstate`).
2. **Astro's prefetching** starts watching for links being hovered or focused.
3. **Interlude's script**, in `Interlude.astro`, imports every file in `src/scripts/pages/` (which registers their `onPage()` hooks), then calls `startInterlude()`. That creates the controller, once for the whole visit. The controller:
   - marks the layer `data-ready`, which disarms a CSS failsafe: if scripts never start, a page rendered covered uncovers itself after three seconds;
   - reads `prefers-reduced-motion`;
   - starts loading the default transition, the one most likely to be needed first, and with `revealOnLoad`, the one that will reveal the first page;
   - with `revealOnLoad`, notes the time: the first page's minimum cover time counts from here;
   - adds its listeners: the router's events, `pointerdown`, hover and focus, `popstate` and changes to the reduced motion setting.
4. **The demo's smooth scrolling**, `src/scripts/smooth-scroll.ts`, loaded at the end of the layout, starts Lenis (unless motion is reduced) and listens to Interlude's events to stay in step with the transitions. It isn't part of Interlude: a site without it scrolls natively.

On `DOMContentLoaded`, the controller sets up the first page (`#boot`):

- The page scripts' `init` hooks run, with the page's `<main>`.
- **Without `revealOnLoad`** (the default), the page is already on screen, so it's shown as it is (`#appear`): `interlude:enter` fires, then the page scripts' `enter` hooks (with `context.initial` set to `true`, `context.transition` to `'none'`, and `context.entrance` to `false`: the content is on screen already, there's nothing to bring in), then `interlude:idle`.
- **With `revealOnLoad`**, the controller loads the transition that reveals the first page (`revealOnLoad.transition`, or the default one) and waits until it's ready to play: its `ready()`, if it has one (a WebGL transition sets up its renderer, see [section 8](#8-adding-a-webgl-transition)). At the same time, it waits for the fonts and images (as in step 5 below). Each wait lasts `mediaTimeout` at most. Then, if `revealOnLoad.minCoverTime` is set, it waits until the page has been covered that long. And it reveals the page the same way as after a navigation (steps 6 and 7 below). With reduced motion and no `fade` transition, there's nothing to play: the page is shown right away, without the minimum.

Later, once every image has loaded, the browser fires `load` and the router fires its first `astro:page-load`. The controller has already set the page up, so it ignores this one. It doesn't wait for `load` because one slow image would hold back every page script.

> **What runs only once.** These scripts run once per visit. When the router swaps in a new page, it skips any script that has already run. So the router, the controller, the layer and the demo's Lenis last from the first page to the last, and so does the top-level code of page scripts. That's why page code goes in `onPage()` hooks: the hooks run for every page, the module itself only once.

## 2. A navigation, step by step

Say the visitor is on the home page and clicks `<a href="/about/" data-transition="circle">`. Here's the whole sequence, then each step in detail:

```
Astro's router                        Interlude
--------------                        ---------
the link is hovered or focused:
  prefetch /about/                    load circle.ts

the link is clicked:
  astro:before-preparation ---------> pick the transition
                                      fire interlude:leave
                                      lock the page
                                      wrap the loader

  run the loader and wait for it.
  Interlude's loader does both at once:
    fetch and parse /about/     +     cover: circle.leave()
                                      fire interlude:covered

  astro:before-swap ----------------> skip the view transition
                                      clean up the old page
  swap in the new page
  (the layer is kept)
  update history and scroll
  astro:after-swap -----------------> lock the new page
                                      circle.prepare(), if it has one

  run the new page's scripts
  astro:page-load ------------------> set up the new page
  announce the new title              wait for fonts and images
                                      fire interlude:enter
                                      reveal: circle.enter()
                                      unlock, focus <main>
                                      fire interlude:idle
```

### Before the click

- **Hovering or focusing the link** makes Astro prefetch `/about/` (the `prefetch` option in `astro.config.mjs`). The HTML lands in the browser's cache, so when the click comes, the fetch is often instant.
- At the same moment, Interlude loads the link's transition (`#onIntent`). It reads `data-transition` on the link, or on the nearest ancestor that has one. Each transition is a separate JavaScript file, loaded the first time it's needed.
- **Pressing on the link** (`pointerdown`) makes Interlude record where the pointer is (`#onPointerDown`). That becomes `context.origin`, which `circle` grows from. Someone using the keyboard has no pointer position, so the origin is the centre of the link instead (and for back and forward, the centre of the screen).

### Step 1: the click

The router's click listener decides whether to take over. It does for a plain click on a link to the same site. It doesn't for links to other sites, links with `target="_blank"`, `download` or `data-astro-reload`, or clicks with a modifier key held (to open a new tab or window): the browser handles those as usual, without a transition.

When it takes over, it cancels the browser's own navigation and starts its own. Forms submitted to the same site go through the same flow. A link to an anchor on the same page (`#contact`) isn't a navigation: the page only scrolls.

A plain click on a link to the page you're already on does nothing at all. Interlude cancels it before the router sees it (a capture-phase `click` listener, in `#onClick`): there'd be nothing to show, only the same page fetched and swapped again behind a transition.

### Step 2: `astro:before-preparation`, where Interlude takes over

The router fires `astro:before-preparation`. The event carries the `loader`, the router's function that fetches the next page. The controller's `#onBeforePreparation`:

1. **Starts a new run.** Each navigation gets a number. Any step of an older navigation that is still waiting for something checks the number when it resumes, and stops if it's out of date.
2. **Picks the transition:** `data-transition` on the link or the nearest ancestor that has one, otherwise `defaultTransition`. With reduced motion, no transition (or `fade`, with `reducedMotion: 'fade'` and a `fade` transition). The back and forward buttons work differently: see [section 4](#4-back-and-forward).
3. **Builds the `context`** the transition receives: `root` (the layer), the `from` and `to` URLs, `direction`, `trigger` (the link), `origin`, `reducedMotion` and `content` (the current `<main>`).
4. **Fires `interlude:leave`.**
5. **Locks the page:** every child of `<body>` except the layer becomes `inert` (no clicks, no keyboard focus, hidden from screen readers), and scrolling is held: the wheel, touch dragging and the scroll keys do nothing until the page is unlocked (shortcuts with a modifier, like Alt+← for "back", still work). The demo's Lenis stops too, on `interlude:leave`.
6. **Wraps the loader:** `event.loader` is replaced with a function that runs the original loader and the cover at the same time, and finishes when both are done.

If the transition is `'none'`, it stops after step 4: no locking, and the loader isn't touched (see [section 5](#5-navigations-without-a-transition)).

### Step 3: cover and fetch, at the same time

The router calls the loader and waits for it. Two things happen in parallel:

- **Fetching** (Astro): `fetch('/about/')`, served from the cache if it was prefetched. The router checks that the response is HTML and parses it into a separate document with `DOMParser`, which doesn't appear on screen. It also starts loading any stylesheet the new page needs that the current one doesn't have.
- **Covering** (`#cover`, then `#leave`): once the transition's file is loaded (usually it already is), the controller:
  - sets `data-state="leaving"`, `data-transition="circle"` and `data-direction="forward"` on the layer, which makes it visible and lets it catch clicks;
  - runs the page scripts' `leave` hooks;
  - calls `circle.leave(context)`, which adds a panel to the layer with `panel()` and grows it into a circle that covers the screen. The controller keeps the animation it returns, so it can stop it if needed;
  - when that ends, marks the page covered (`#setCovered`): `data-state="covered"` and `data-cover="solid"`, and the time, for `minCoverTime`. The layer now paints itself in `--interlude-color`, so the transition's panels aren't needed and are removed. `interlude:covered` fires.

So a navigation takes as long as the cover or the fetch, whichever is longer, rather than both added up. On a slow connection, the page stays covered until the next one arrives.

Once the loader is done, the router fires `astro:after-preparation` (Interlude doesn't use it) and saves the old page's scroll position in its history entry, for when the visitor comes back to it.

### Step 4: the swap

By default, Astro animates between pages with the browser's View Transitions API. So the router calls `document.startViewTransition()`, or an imitation of it in browsers that don't support it, and does the swap inside it. The browser doesn't paint anything until the swap is done.

**`astro:before-swap`** (`#onBeforeSwap`):

- Interlude skips the view transition. It does its own animating, so nothing should play over the layer (a `transition:name` morph, for instance). Astro's built-in animations are already off, with `transition:animate="none"` on `<html>`.
- It records, in the old page's history entry, which transition left it.
- It runs the old page's cleanups: whatever `init` returned, then `destroy`.

**The swap itself** (Astro):

- The attributes of `<html>` are replaced with the new page's, so `data-page` is now `about`.
- In `<head>`, the new page's elements come in. Stylesheets that both pages use stay where they are.
- `<body>` is replaced with the new page's body, except for elements marked `transition:persist`: Astro moves the existing layer into the new body, in place of the new page's copy of it. It's the same element, still covering the screen, with whatever was in it.

**History and scroll** (Astro): the new URL is added to the history (`history.pushState`), and the page scrolls to the top. On back and forward, it returns to the saved position instead, and with a `#hash` in the URL, to that anchor.

**`astro:after-swap`** (`#onAfterSwap`):

- Interlude records, in the new history entry, which transition brought the visitor there.
- The demo's Lenis catches up with the scroll position the router just set (its own `astro:after-swap` listener).
- The new page is locked: its header, `<main>` and footer are new elements, so they aren't `inert` yet.
- `context.content` now points at the new `<main>`: the page's own, never one inside the layer, where a transition may be keeping a copy of the old page ([section 9](#9-keeping-the-old-page-on-screen)).
- If the transition has a `prepare`, it runs now. The new page is in the DOM but hasn't been painted, so this is the place to set its starting state: a transition that moves the page's blocks in, for instance, moves them down and hides them here.

### Step 5: the new page is set up

The router runs the new page's scripts, skipping any that already ran (Interlude's own scripts ran on the first page, so they don't run again). Then it fires `astro:page-load`, and announces the new page's title to screen readers.

On `astro:page-load` (`#onPageLoad`), the controller:

- runs the page scripts' `init` hooks for the new page, with its `<main>`: the layer may still hold a copy of the old page ([section 9](#9-keeping-the-old-page-on-screen)), so page scripts look inside `<main>`, not in the whole document;
- waits until the page is ready to be seen (`mediaReady` in `media.ts`): the fonts, and the images on screen or just below it (within 1.25 screen heights), decoded with `img.decode()` so they appear without a flash. It never waits longer than `mediaTimeout` (1.5 seconds by default), and it doesn't make lazy images further down the page load early;
- at the same time, if `minCoverTime` is set, waits until the page has been covered that long, counted from the end of `leave` (step 3).

### Step 6: the reveal

`#reveal`:

1. sets `context.entrance` to the transition's `entrance`, or 0 if it doesn't set one, and fires `interlude:enter`;
2. calls `circle.enter(context)`, which adds a new full-screen panel and shrinks it back down to the origin;
3. sets `data-state="entering"` on the layer in the same frame, which removes the solid colour. That's why `enter` has to create its panels right away, before its first `await`: they take over from the solid colour without a gap;
4. runs the page scripts' `enter` hooks alongside. `src/scripts/pages/entrance.ts`, for instance, brings in the `data-entrance` elements, starting `context.entrance` seconds in (with `curtain`, 0.2 seconds, as the curtain lifts). A transition that shows the page as it is, or brings the content in itself, sets `entrance: false`, and the entrance stays out of its way;
5. waits for the animation `enter` returned.

### Step 7: back to idle

`#finish`:

- clears the layer: the panels are removed, the attributes are reset, and with `data-state="idle"` it's hidden again and clicks pass through it;
- unlocks the page: `inert` is removed, and scrolling works again;
- moves focus to the new `<main>` (without scrolling), so keyboard and screen reader users continue from the new content. A plain `<main>` can't take focus, so if it has no `tabindex`, it gets `tabindex="-1"` first;
- fires `interlude:idle`, on which the demo's Lenis lets the visitor scroll again.

## 3. The layer's states

The controller keeps track of where a navigation is, and shows it on the layer with `data-state`. The layer's CSS (in `Interlude.astro`) responds to it:

| `data-state` | Meaning                                                              | The layer is                                                                                                                       |
| ------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `idle`       | No transition is running                                             | hidden, and lets clicks through                                                                                                    |
| `leaving`    | `leave` is covering the page                                         | visible, and blocks clicks                                                                                                         |
| `covered`    | The old page is hidden. The fetch or the swap may still be happening | visible, and blocks clicks. Painted with `--interlude-color` (`data-cover="solid"`), unless the transition has `solidCover: false` |
| `entering`   | `enter` is revealing the new page                                    | visible, and blocks clicks                                                                                                         |

While a transition runs, the layer also carries `data-transition` (the transition's name) and `data-direction` (`forward` or `back`), so a transition can have its own CSS.

**Without a solid cover.** A transition with `solidCover: false` hides the page in its own way. When its `leave` ends, the controller doesn't paint the layer: it leaves in place whatever `leave` built, and sets `data-cover="custom"`. The transition is then responsible for keeping the new page hidden until `enter`: with what it left in the layer (the WebGL transitions keep their canvas there, see [section 8](#8-adding-a-webgl-transition); others keep a copy of the old page, see [section 9](#9-keeping-the-old-page-on-screen)), or, if it moves the page itself, in `prepare`, before the new page is first painted (see "Without a solid cover" in the README).

## 4. Back and forward

When the visitor presses back, the browser changes the URL and fires `popstate`. The router compares the history entry's `index` with the previous one to tell back from forward, then runs the same flow as for a click, with `navigationType` set to `'traverse'`. The URL has already changed, and in step 4 the router restores the saved scroll position instead of scrolling to the top.

**Which transition plays.** Each history entry remembers two transitions, in `history.state.interlude`: `leave`, the one that left that page, and `arrive`, the one that brought the visitor to it. They're written during step 4, for new navigations only, not for back and forward. Going back replays how the visitor left the page they're returning to, with `context.direction` set to `'back'` so the transition can play mirrored. Going forward replays how they first arrived on the page.

For example:

1. Home → About, with `circle`. Home's entry remembers `leave: 'circle'`, About's `arrive: 'circle'`.
2. About → Contact, with `wipe`. About's entry remembers `leave: 'wipe'`, Contact's `arrive: 'wipe'`.
3. Back, from Contact to About: About's `leave` is `wipe`, so `wipe` plays, backwards.
4. Back again, to Home: Home's `leave` is `circle`, so `circle` plays, backwards.
5. Forward, to About: About's `arrive` is `circle`, so `circle` plays forwards.

The browser keeps `history.state` across reloads, so this still works after a reload, and when the same page appears in the history more than once.

**Swiping back.** On touch devices, browsers animate a swipe back on their own. The `popstate` event then has `hasUAVisualTransition` set. Interlude notes it (`#onPopState`, which runs before the router's listener), and that navigation runs without a transition, so it isn't animated twice.

## 5. Navigations without a transition

A navigation has no transition with `data-transition="none"`, with reduced motion and `reducedMotion: 'none'`, and after a swipe back. Then `#onBeforePreparation` fires `interlude:leave` and returns: the page isn't locked and the loader isn't wrapped, so the router swaps the page as soon as it's fetched. `#onBeforeSwap` fires `interlude:covered`, since the old page is gone from that point on. `#onPageLoad` then shows the new page with `#appear`: `interlude:enter`, the page scripts' `enter` hooks (with `context.entrance` at 0: the content can come in right away), `interlude:idle`.

So the events and hooks are the same, in the same order, with or without a transition. Code that listens to them doesn't need a special case.

## 6. When navigations overlap, or something fails

**A navigation starts while another is running.** For example, the visitor presses back during a transition. The router cancels the older navigation's fetch. In Interlude, each step that was waiting checks the run number when it resumes (see step 2), and stops if a newer navigation has started. What happens next depends on where the first navigation was:

- **Covering:** the new navigation reuses the cover already playing (`#covering`) instead of starting another.
- **Covered:** there's nothing to cover, so it goes straight to fetching and swapping.
- **Revealing:** `#stop()` stops the reveal where it is and clears the layer, and the new `leave` covers the page from there.

**A transition throws an error** in `leave`, `prepare` or `enter`: the error is logged, and the navigation carries on. The page is never left covered.

**A transition's file fails to load** (a network error, for instance): the default transition plays instead, and the next navigation tries to load it again.

**The router can't swap the page:** when the response isn't HTML, the request redirects to another site, or the next page doesn't use `<ClientRouter />`. The router then falls back to a classic page load. The cover stays up until the browser replaces the page.

**Scripts never start** (they're blocked, or JavaScript is off): there's no cover, and links are classic page loads. A first page rendered covered with `revealOnLoad` uncovers itself after three seconds, through the CSS failsafe.

## 7. What lasts the whole visit, and what runs on every page

**Created once, and kept for the whole visit:**

- Astro's router and prefetching
- the controller and its listeners
- the demo's Lenis instance, and its loader (kept across swaps with `transition:persist`)
- the layer element
- the page scripts' modules (their top-level code runs once)
- each transition's module, once it's loaded
- the WebGL renderer and its canvas, once a WebGL transition has loaded

**Run on every navigation:**

- the `astro:*` and `interlude:*` events
- the transition's `leave`, `prepare` and `enter`
- the page scripts' hooks: `init` and `destroy` for setting up and cleaning up, `leave` and `enter` alongside the transition

## 8. Adding a WebGL transition

A WebGL (or WebGPU) transition is a transition like any other: one file in `src/transitions/`, and nothing else in the engine, the layout or the pages has to change. The flow above already gives it what it needs.

When the effect is one full-screen shader, `shaderCover()` in `src/lib/interlude/webgl.ts` takes care of everything below, and the transition is only its shader: see the six in `src/transitions/`, from `dither.ts` (squares at a few sizes, dithered) to `channel.ts` (TV static that keeps moving while the next page loads), and the README. When it's a scene of its own, `layerRenderer()` hands the transition the same shared renderer, its canvas already in the layer, and the transition does the rest (`particles.ts`: thousands of particles, a render loop while it plays, the pointer). This section explains what all that involves, and what to do when you write `leave` and `enter` yourself.

**Where it draws.** In `leave`, it adds a `<canvas>` to the layer (`context.root`), and it sets `solidCover: false`. So when the page is covered, the engine doesn't paint the layer over the canvas (see [section 3](#3-the-layers-states)): the canvas stays on screen through the swap, and `enter` reveals the new page with it. When the reveal is over, the engine empties the layer, canvas included, and the next navigation adds it back.

**Setting up once.** The transition's module runs once per visit ([section 7](#7-what-lasts-the-whole-visit-and-what-runs-on-every-page)), so the renderer, the canvas and the compiled shaders can be created at the top of the module and reused by every navigation. The module loads when a link that uses the transition is hovered, focused or touched, so start setting up right away: by the click, it's usually ready. `leave` can `await` it if it isn't. `enter` can't, because it has to start synchronously ([step 6](#step-6-the-reveal)). That's fine after a navigation, since `leave` ran first. On the first page with `revealOnLoad`, though, there's no `leave`: give the transition a `ready()` that resolves once it's set up, and the engine waits for it before that first reveal ([section 1](#1-the-first-page-load)). `shaderCover()` does, with the shader compiled too. The wait lasts `mediaTimeout` at most, so `enter` still needs a fallback for a renderer that isn't ready by then.

**Rendering only while it plays.** Animate a `progress` value with GSAP, render a frame in the tween's `onUpdate`, and return the tween. It ends when the page is covered or revealed, the engine can stop it if a navigation interrupts, and the GPU does nothing the rest of the time. An effect that should keep moving while the next page loads (static, say) renders on every tick from the end of `leave` to the start of `enter`, and stops at `interlude:idle` in case `enter` never comes: `shaderCover()`'s `live` option does that, for `channel.ts`.

**Interruptions.** If a navigation starts during the reveal, the engine stops the animation `enter` returned and empties the layer ([section 6](#6-when-navigations-overlap-or-something-fails)). Have the next `leave` animate from the current `progress` (`gsap.to`, not `gsap.fromTo`), so the effect turns around where it was instead of jumping.

**What the effect can use:**

- `context.origin`, where the click was: the centre of a ripple, for instance;
- `context.direction`, to mirror the effect going back (`sign(context)`);
- `--interlude-color`, read with `getComputedStyle(context.root)`, so the fully covered screen matches the other transitions;
- the new page's images, as textures: by the time `enter` runs, the images near the top are decoded ([step 5](#step-5-the-new-page-is-set-up)). The page itself can't be used as a texture: browsers can't draw live HTML into WebGL yet.

**A fallback.** If neither WebGPU nor WebGL is available, or the GPU context is lost, cover the page with `panel()` instead, so the swap never happens in plain view. Keep that path quiet: a missing GPU is normal on some devices, so note it with `console.info`, not as a warning or an error.

**Already taken care of:** with reduced motion the engine plays no transition (or `fade`), so the WebGL code never runs. If the transition throws, the error is logged and the navigation completes. The layer is `aria-hidden` and the page is locked while the transition runs.

**Where the code goes.** Shader code and helpers can sit next to the transition, in a folder (`src/transitions/ripple/` for `ripple.ts`): only the files directly in `src/transitions/` are registered as transitions. Import the WebGL library from there too, not from code every page loads, so it's bundled with the transition and only downloaded by the visitors who trigger it. The library is up to you. With three.js, `WebGPURenderer` and TSL compile one shader for both WebGPU and WebGL 2.

**A scene that stays on screen**, like a background that also does the transitions, needs more than a transition file: a canvas in the layout, kept across navigations with `transition:persist`, listening to the `interlude:*` events. The transitions then drive that scene instead of drawing their own.

## 9. Keeping the old page on screen

Barba's `sync` mode keeps the old and new pages in the document together, so a transition can show both: the new page sliding over the old one, an image flying from one to the other. Astro's router can't: at the swap ([step 4](#step-4-the-swap)) it replaces the whole `<body>` in one go, and the `<head>` with it. Keeping the real old page would mean replacing Astro's swap, or moving the old page's elements aside, which restarts its components, pauses its videos and reloads its iframes.

So the transition keeps a copy instead, in the layer, which Astro doesn't touch. `keepOldPage()` (in `src/lib/interlude/old-page.ts`) makes it in `leave`, before anything moves:

- **Of the page's blocks:** the children of `<body>`, except the layer and `fixed` elements (a skip link, a loader), which stay where they are on screen. `absolute` ones, like a header laid over a hero, are included, and land in the copy where they were.
- **A still copy**, built element by element rather than with `cloneNode(true)`: scripts and templates are left out, ids and `data-entrance` are removed, custom elements (Astro islands among them) become plain elements so they don't start again, videos and canvases become pictures of their current frame, and iframes and other embeds become empty boxes of the same size. It's `inert`, so nothing in it can be reached.
- **With the old page's styles:** the `<style>` and stylesheet `<link>` elements of the `<head>` are copied in with it. Otherwise, after the swap, the copy would lose the styles only the old page had.
- **With `<body>`'s classes, data attributes and layout:** the copy's wrapper takes them from the old `<body>`. After the swap, `<body>` is the new page's, and the copy sits inside it, so styles hung on the old body (a per-page theme, like the demo's `data-ground`) would stop reaching it, and a body laid out as a flex column or a grid would no longer place its blocks.
- **Where the page was scrolled to**, so it lines up with what was on screen, and where each element scrolled inside it was (a row of pictures, a code block): the copy puts those back on the next frame, once it's on the page, and again after the swap, since Astro moving the layer into the new `<body>` resets the scrolling inside it.

The transition sets `solidCover: false`, so when `leave` ends the layer isn't painted over the copy ([section 3](#3-the-layers-states)). The copy stays on screen through the swap, hiding it, and `enter` finds it again with `oldPage()` and animates it together with the real new page underneath. When the reveal is over, the engine empties the layer, copy and copied styles included.

Two things follow from the copy being in the layer:

- **The engine looks for the page's `<main>` outside the layer**, since the copy has one too: `context.content` is always the real page's.
- **The layer is in front of the page.** To bring the new page over the old one, the transition clips the copy away wherever the new page has arrived (`slide-over.ts`).

Because `leave` runs while the next page is fetched ([step 3](#step-3-cover-and-fetch-at-the-same-time)), the old page can start moving on the click, before the next one has arrived, which Barba's `sync` mode waits for (`stack` does). Or `leave` can leave the copy still, so the page is covered at once by an exact picture of itself, and `enter` plays everything as one movement once the next page is ready (`slide-over` does). The demo then shows a loader at the cursor if the wait is long: `src/components/Loader.astro`, which listens to Interlude's events. With `minCoverTime`, such a transition is held right there, at the click, since nothing has moved yet: the loader shows then too, so the wait doesn't look like a click that did nothing.
