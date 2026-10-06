/**
 * Typewriter: a black sheet comes in, and a grid of cells types the site's
 * tagline in a wave from left to right, then erases it once the next page is
 * ready.
 *
 * The characters aren't split into elements: a screen of cells is thousands of
 * characters. Each cell is one element, and GSAP tweens two numbers per cell,
 * how many characters are typed and how many erased; the cell then shows that
 * slice of the phrase. The rest stays in place, invisible, so nothing shifts.
 *
 * Inspired by the type animation of The Manifest, by Studio Freight, shared by
 * Lídia Santos: https://www.linkedin.com/posts/inventorylidia_too-often-in-the-creative-world-we-see-the-activity-7431778963980443648-jglF
 */
import { gsap } from 'gsap';
import { defineTransition, panel, type TransitionContext } from '../lib/interlude';

// Settings
const PHRASE = 'ASTRO STARTER FOR PAGE TRANSITIONS'; // what the cells type: the site's tagline
const SHEET = '#0c0c0c'; // the sheet
const TEXT = '#fff'; // the characters and cursors
const CHARS_PER_LINE = 21; // the phrase wraps between words, after at most this many characters
const FADE_IN = { duration: 0.15, ease: 'power1.out' }; // the sheet coming in
const TYPE_SPEED = 0.022; // seconds per character, typing
const ERASE_SPEED = 0.015; // seconds per character, erasing
const WAVE = 0.5; // seconds for the wave to cross the screen, left to right
const JITTER = 0.25; // up to this many seconds of randomness in when each cell starts
const SKIP = 0.2; // the share of cells that stay empty
const HOLD = 0.1; // seconds a cell stays complete before it erases
const BLINK = 0.5; // seconds a waiting cursor stays on, then off (complete cells, while the next page loads)
const FADE_OUT = { duration: 0.35, ease: 'power2.inOut' }; // the sheet going, once all is erased

/** Columns by screen width: wide, medium, narrow. */
const columnsFor = (width: number) => (width >= 1024 ? 9 : width >= 640 ? 6 : 3);

/** One cell of the grid: its parts, where its wave starts, and its two counters. */
interface Cell {
  erasedPart: HTMLElement; // erased characters: invisible, but keeping their place
  shownPart: HTMLElement;
  caret: HTMLElement;
  restPart: HTMLElement; // not typed yet: invisible too
  wave: number; // when its turn comes, in seconds from the start
  typed: number;
  erased: number;
}

/** The phrase broken into lines between words, at most `max` characters each. */
function wrap(text: string, max: number) {
  const lines: string[] = [];
  for (const word of text.split(' ')) {
    const last = lines.at(-1);
    if (last !== undefined && `${last} ${word}`.length <= max)
      lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

const lines = wrap(PHRASE, CHARS_PER_LINE);
/** With its line breaks: the cells don't wrap on their own (`white-space: pre`), so the lines never move. */
const text = lines.join('\n');

/** Shows a cell's current slice of the phrase. */
function draw(cell: Cell) {
  const typed = Math.round(cell.typed);
  const erased = Math.round(cell.erased);
  cell.erasedPart.textContent = text.slice(0, erased);
  cell.shownPart.textContent = text.slice(erased, typed);
  // The cursor follows the typing, and stays once the phrase is complete,
  // blinking with the sheet's `--blink`, until the cell starts erasing.
  cell.caret.textContent = typed > 0 && erased === 0 ? '_' : '';
  cell.caret.style.opacity = typed === text.length ? 'var(--blink, 1)' : '1';
  cell.restPart.textContent = text.slice(typed);
}

/** The cells of this navigation, and the timeline typing them (it outlives `leave`). */
let cells: Cell[] = [];
let typing: gsap.core.Timeline | undefined;
/** The waiting cursors' blinking, from `leave` to the end of `enter`. */
let blink: gsap.core.Tween | undefined;

/** Fills the sheet with a grid of empty cells, sized to the screen. */
function grid(context: TransitionContext, sheet: HTMLElement) {
  const { clientWidth: width, clientHeight: height } = context.root;
  const columns = columnsFor(width);
  const cellWidth = width / columns;
  // Monospace characters are 0.6em wide: the longest line fills 90% of a cell.
  const fontSize = (cellWidth * 0.9) / (Math.max(...lines.map((line) => line.length)) * 0.6);
  const rowHeight = fontSize * (1.1 * lines.length + 0.9);
  const rows = Math.ceil(height / rowHeight) + 1;
  const bleed = 0.3; // the first column starts a little off screen, as if the grid went on

  Object.assign(sheet.style, {
    fontFamily: 'var(--font-mono, monospace)', // the site's monospace font, if it has one
    fontSize: `${fontSize}px`,
    lineHeight: '1.1',
    color: TEXT,
    whiteSpace: 'pre',
    overflow: 'hidden',
  });

  const made: Cell[] = [];
  for (let column = 0; column <= columns; column++) {
    for (let row = 0; row < rows; row++) {
      if (Math.random() < SKIP) continue;
      const el = document.createElement('div');
      el.style.cssText = `position:absolute;left:${(column - bleed) * cellWidth}px;top:${row * rowHeight}px`;
      const part = (hidden: boolean) => {
        const span = document.createElement('span');
        if (hidden) span.style.visibility = 'hidden';
        return el.appendChild(span);
      };
      made.push({
        erasedPart: part(true),
        shownPart: part(false),
        caret: part(false),
        restPart: part(true),
        wave: (column / columns) * WAVE + Math.random() * JITTER,
        typed: 0,
        erased: 0,
      });
      sheet.append(el);
    }
  }
  made.forEach(draw);
  return made;
}

export default defineTransition({
  name: 'typewriter',
  // The sheet does the covering, and stays through the swap: its cells erase on the next page.
  solidCover: false,
  // Neither page's content moves.
  entrance: false,

  leave(context) {
    typing?.kill(); // what's left of an earlier navigation's typing…
    blink?.kill(); // …and blinking
    const sheet = panel(context, { style: { background: SHEET, opacity: '0' } });
    // On, off, on…: complete cells' cursors read it (see `draw`).
    blink = gsap.fromTo(
      sheet,
      { '--blink': 1 },
      { '--blink': 0, duration: BLINK, ease: 'steps(1)', repeat: -1, yoyo: true }
    );
    cells = grid(context, sheet);

    // Each cell types its phrase when its turn in the wave comes. This keeps
    // going after `leave`, into `enter`, which erases each cell once it's typed.
    const typeTime = text.length * TYPE_SPEED;
    typing = gsap.timeline({ delay: FADE_IN.duration });
    for (const cell of cells) {
      typing.to(
        cell,
        { typed: text.length, duration: typeTime, ease: 'none', onUpdate: () => draw(cell) },
        cell.wave
      );
    }

    // The page counts as covered once the sheet is in and the first cells
    // could start erasing: the next page can come in while the rest still type.
    const firstTyped = Math.min(...cells.map((cell) => cell.wave)) + typeTime;
    return gsap
      .timeline()
      .to(sheet, { opacity: 1, ...FADE_IN })
      .add(() => {}, FADE_IN.duration + firstTyped + HOLD);
  },

  enter(context) {
    const sheet = context.root.firstElementChild as HTMLElement | null;
    // No sheet (a first load with `revealOnLoad`): just fade in.
    if (!sheet || !typing) {
      return gsap.fromTo(panel(context), { opacity: 1 }, { opacity: 0, ...FADE_OUT });
    }

    // Each cell erases in the wave, but never before it's fully typed and held.
    const now = typing.time();
    const typeTime = text.length * TYPE_SPEED;
    const erasing = gsap.timeline();
    for (const cell of cells) {
      const start = Math.max(cell.wave, cell.wave + typeTime + HOLD - now);
      erasing.to(
        cell,
        {
          erased: text.length,
          duration: text.length * ERASE_SPEED,
          ease: 'none',
          onUpdate: () => draw(cell),
        },
        start
      );
    }
    // Once all is erased, the sheet goes, and the blinking stops.
    return erasing.to(sheet, { opacity: 0, ...FADE_OUT }).add(() => blink?.kill());
  },
});
