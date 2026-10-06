/**
 * Stack: the page steps back like a card going onto a pile, shrinking and
 * darkening, and a sheet the colour of the page slides up over it. The same
 * both ways.
 *
 * An example of moving the whole page, header included: the transition keeps
 * a still copy of the page in the layer, in front of it, and animates the copy
 * (`keepOldPage()`). The real page never moves.
 *
 * Needs: `src/lib/interlude/old-page.ts`.
 * Inspired by the project page transition on Olga Prudka's site, olgaprudka.com.
 */
import { gsap } from 'gsap';
import { defineTransition, panel } from '../lib/interlude';
import { keepOldPage, pageColor } from '../lib/interlude/old-page';

// Settings
const SCALE = 0.9; // how small the page gets as it steps back
const RADIUS = 0; // px, the card's and the sheet's corners
const DIM = 0.5; // how dark the card gets, from 0 (not at all) to 1 (black)
const SHRINK = { duration: 1.4, ease: 'expo.inOut' }; // the page shrinking and darkening
const SHEET = { duration: 1.4, ease: 'expo.inOut' }; // the sheet sliding up
const SHEET_START = 0; // seconds after the shrink starts
const ENTER = { duration: 0.6, ease: 'expo.out' }; // the sheet fading on the next page

export default defineTransition({
  name: 'stack',
  solidCover: false, // the sheet does the covering
  entrance: 0.2, // the page's content starts coming in 0.2 s into enter()

  leave(context) {
    // Four panels, back to front: the dark backdrop the card steps back onto…
    panel(context);
    // …the card: a still copy of the page…
    const card = keepOldPage(context);
    // …a dark film over the copy, inside the card, that fades in to darken it…
    const dim = panel(context, { style: { opacity: '0' } });
    card.append(dim);
    // …and the sheet, the page's colour, that covers it all.
    const sheet = panel(context, { style: { background: pageColor() } });

    return (
      gsap
        .timeline()
        // The last number of each step is when it starts, in seconds into the timeline.
        .to(card, { scale: SCALE, borderRadius: RADIUS, ...SHRINK }, 0)
        .to(dim, { opacity: DIM, ...SHRINK }, 0)
        // From below the screen, its corners flattening as it lands.
        .fromTo(
          sheet,
          { yPercent: 100, borderRadius: RADIUS },
          { yPercent: 0, borderRadius: 0, ...SHEET },
          SHEET_START
        )
    );
  },

  enter(context) {
    // Only the sheet is left to see: the card is under it, and goes now.
    const sheet = context.root.lastElementChild as HTMLElement;
    [...context.root.children].forEach((el) => el !== sheet && el.remove());
    // The sheet fades, and the page's entrance brings the content in (see `entrance`).
    return gsap.to(sheet, { opacity: 0, ...ENTER });
  },
});
