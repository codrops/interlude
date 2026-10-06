/**
 * Waiting for a page to be presentable before revealing it, without a library.
 *
 * Only images near the top of the page matter: the ones visible as soon as the
 * page is revealed. Waiting for all of them would force lazy images to load and
 * delay the reveal on long pages. `HTMLImageElement.decode()` resolves once an
 * image is loaded and decoded, so it paints without a flash.
 */

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Images whose top is within `screens` viewport heights of the top of the page. */
const imagesNearTop = (scope: ParentNode, screens: number) =>
  [...scope.querySelectorAll('img')].filter(
    (img) => img.getBoundingClientRect().top < window.innerHeight * screens
  );

/**
 * Resolves when the fonts are ready and the images near the top are decoded,
 * or after `timeout` ms, whichever comes first. Never rejects.
 */
export async function mediaReady(
  scope: ParentNode = document,
  { timeout = 1500, screens = 1.25 } = {}
) {
  const images = imagesNearTop(scope, screens).map((img) => img.decode().catch(() => {}));
  await Promise.race([Promise.all([document.fonts.ready, ...images]), sleep(timeout)]);
}
