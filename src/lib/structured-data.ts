/**
 * Structured data (JSON-LD) for search engines, built from `src/config/site.ts`.
 * Pass it to the layout: `<BaseLayout schema={websiteSchema}>`.
 *
 * `WebSite`, on the home page, gives the site its name in search results. Once
 * the site is online, check it with Google's Rich Results Test.
 */
import { site } from '../config/site';

export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: site.name,
  description: site.description,
  url: new URL('/', import.meta.env.SITE).href,
  inLanguage: 'en',
  publisher: { '@type': 'Organization', name: site.author.name, url: site.author.href },
};
