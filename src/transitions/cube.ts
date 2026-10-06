/**
 * Cube: the page is one face of a box. It pulls back, then the box turns over
 * to the next page and comes forward again. It turns the other way on "back".
 *
 * Both pages are on screen at once: `keepOldPage()` keeps a still copy of the
 * old page and `copyPage()` makes one of the next. They're two faces of a box
 * as deep as the screen is tall, turned about its middle with CSS 3D
 * transforms, and a film darkens each face as it turns away. Once the box has
 * come forward, a face is exactly the size of the screen, so the layer goes
 * and the real page underneath is the same.
 *
 * Needs: `src/lib/interlude/old-page.ts`.
 */
import { gsap } from 'gsap';
import { defineTransition, panel, sign } from '../lib/interlude';
import { copyPage, keepOldPage, oldPage, pageColor } from '../lib/interlude/old-page';

// Settings
const LEAVE = { duration: 0.5, ease: 'expo.in' }; // pulling back, on the click
const TURN = { duration: 0.5, ease: 'power3.inOut' }; // the box turning, once the next page is ready
const ENTER = { duration: 0.9, ease: 'expo' }; // coming forward again
const OVERLAP = 0; // seconds the coming forward starts before the turn ends, so it's one movement
const LIFT = 0.38; // how big the page looks pulled back, as a share of the screen
const PERSPECTIVE = 1.8; // how far the eye is from the screen, in screen heights: smaller is a stronger perspective
const DIM = 0.55; // how dark a face gets as it turns away, from 0 (not at all) to 1 (black)

/** The box, and where it is, from `leave` to `enter`. */
interface Scene {
  next: HTMLElement; // the face the next page goes on, empty until it's ready (and out of sight until the box turns)
  pose: { lift: number; turn: number }; // 0 to 1: how far back it is, and how far it has turned (a quarter turn)
  draw: () => void; // puts the box where `pose` says
}

let scene: Scene | undefined;

/** A dark film over a face, to shade it as it turns away from you. */
function film(face: HTMLElement) {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'absolute',
    inset: '0',
    background: 'var(--interlude-color, #111)',
    opacity: '0',
    pointerEvents: 'none',
  });
  face.append(el);
  return el;
}

export default defineTransition({
  name: 'cube',
  solidCover: false, // the old page's copy does the covering
  // The next page arrives whole, on its face: its content doesn't come in on its own.
  entrance: false,

  // On the click: the old page's copy becomes the box's front face, and the box pulls back.
  leave(context) {
    const old = keepOldPage(context);
    const { clientHeight: height } = context.root;
    const s = sign(context); // 1: the next page comes from above; -1: from below
    const half = height / 2;
    // How far back the box goes for the page to look `LIFT` times its size:
    // with the eye `PERSPECTIVE` heights away, size shrinks as eye / (eye + distance).
    const back = height * PERSPECTIVE * (1 / LIFT - 1);

    // Back to front: dark space, a stage with a perspective in it, and the box
    // on that stage. The box's middle is `half` behind the screen, so its
    // front face is on the screen: its own size.
    const space = panel(context, { style: { overflow: 'hidden' } });
    const stage = document.createElement('div');
    Object.assign(stage.style, {
      position: 'absolute',
      inset: '0',
      perspective: `${height * PERSPECTIVE}px`,
    });
    const box = document.createElement('div');
    Object.assign(box.style, { position: 'absolute', inset: '0', transformStyle: 'preserve-3d' });
    stage.append(box);
    space.append(stage);

    // The old page, as the front face…
    Object.assign(old.style, {
      inset: '0',
      transform: `translateZ(${half}px)`,
      backfaceVisibility: 'hidden',
    });
    box.append(old);
    const oldFilm = film(old);
    // …and the top face (the bottom one, going back): turned a quarter and
    // pushed out, so it lies in the box's side, out of sight. The next page
    // goes on it once it's ready.
    const next = document.createElement('div');
    Object.assign(next.style, {
      position: 'absolute',
      inset: '0',
      overflow: 'hidden',
      background: pageColor(),
      transform: `rotateX(${90 * s}deg) translateZ(${half}px)`,
      backfaceVisibility: 'hidden',
    });
    box.append(next);
    const nextFilm = film(next);

    const pose = { lift: 0, turn: 0 };
    const draw = () => {
      box.style.transform = `translateZ(${-half - back * pose.lift}px) rotateX(${-90 * s * pose.turn}deg)`;
      oldFilm.style.opacity = String(DIM * pose.turn);
      nextFilm.style.opacity = String(DIM * (1 - pose.turn));
    };
    draw();
    scene = { next, pose, draw };
    return gsap.to(pose, { lift: 1, ...LEAVE, onUpdate: draw });
  },

  // The next page is ready: it goes on the top face, the box turns, and comes forward.
  enter(context) {
    const old = oldPage(context);
    const current = scene;
    // No old page (a first load with `revealOnLoad`): the dark just fades.
    if (!old || !current) {
      const fade = panel(context);
      return gsap.fromTo(fade, { opacity: 1 }, { opacity: 0, duration: 0.5, ease: 'power1.out' });
    }
    scene = undefined;

    const { next, pose, draw } = current;
    next.style.background = pageColor(); // the next page's, now that it's in
    next.prepend(copyPage(context)); // under the film
    return (
      gsap
        .timeline()
        .to(pose, { turn: 1, ...TURN, onUpdate: draw }, 0)
        // The coming forward starts a little before the turn ends: one movement.
        .to(pose, { lift: 0, ...ENTER, onUpdate: draw }, TURN.duration - OVERLAP)
        // Exactly in place, so the real page underneath matches.
        .add(() => {
          Object.assign(pose, { lift: 0, turn: 1 });
          draw();
        })
    );
  },
});
