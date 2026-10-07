/**
 * Waiting for a page to be presentable before revealing it, without a library.
 *
 * Only images on screen matter: the ones visible as soon as the page is
 * revealed. Waiting for all of them would force lazy images to load and delay
 * the reveal on long pages. `HTMLImageElement.decode()` resolves once an image
 * is loaded and decoded, so it paints without a flash.
 */

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The images the reveal waits for: on screen, or just below the top of it
 * (within `screens` viewport heights), and drawn. Not the ones off to the side
 * (a carousel's far slides), which a lazy image never loads until they're
 * scrolled to: waiting for them would only run into the timeout. Nor the ones
 * in `display: none`, which have no size.
 */
const imagesToWait = (scope: ParentNode, screens: number) =>
  [...scope.querySelectorAll('img')].filter((img) => {
    const box = img.getBoundingClientRect();
    if (!box.width || !box.height) return false;
    const acrossScreen = box.right > 0 && box.left < window.innerWidth;
    const nearTop = box.bottom > 0 && box.top < window.innerHeight * screens;
    return acrossScreen && nearTop;
  });

/**
 * Resolves when the fonts are ready and the images near the top are decoded,
 * or after `timeout` ms, whichever comes first. Never rejects.
 */
export async function mediaReady(
  scope: ParentNode = document,
  { timeout = 1500, screens = 1.25 } = {}
) {
  const images = imagesToWait(scope, screens).map((img) => img.decode().catch(() => {}));
  await Promise.race([Promise.all([document.fonts.ready, ...images]), sleep(timeout)]);
}
