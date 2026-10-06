/**
 * The demo site's details, in one place.
 */
import shareImage from '../assets/share.jpg';

export const site = {
  name: 'Interlude',
  tagline: 'Astro starter for page transitions',
  description:
    "A starter for custom page transitions in Astro, built on Astro's ClientRouter and GSAP, with WebGL transitions in three.js.",
  /** Who makes it: credited on the home page, and in the metadata. */
  author: { name: 'Codrops', href: 'https://tympanus.net/codrops/', x: '@codrops' },
  /** Shown when a page without its own image is shared (1200×630 or larger). */
  image: { src: shareImage, alt: 'Interlude: Astro starter for page transitions.' },
  /** The home page is the transitions index: the header links there with the site's name. */
  nav: [{ label: 'Get started', href: '/start/' }],
  /** Where the project lives. The article link is a placeholder until the article is out. */
  links: [
    { label: 'Code', href: 'https://github.com/codrops/interlude' },
    { label: 'Article', href: 'https://tympanus.net/codrops/' },
  ],
};
