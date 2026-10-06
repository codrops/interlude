// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  // Your production URL: used for canonical links, Open Graph and the sitemap.
  site: 'https://example.com',
  // With <ClientRouter />, links are prefetched on hover (or focus), so the
  // next page is often ready before its cover transition even finishes.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  integrations: [sitemap()],
  // Self-hosted from the installed Fontsource packages: the Latin files only
  // (add more `src` files for other alphabets). Astro preloads them
  // (`<Font preload>` in the layout) and adds fallbacks with matching metrics,
  // so the text doesn't shift when they arrive.
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Inter',
      cssVariable: '--font-sans',
      options: {
        variants: [
          {
            src: ['@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'],
            weight: '100 900',
            style: 'normal',
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'JetBrains Mono',
      cssVariable: '--font-mono',
      fallbacks: ['monospace'],
      options: {
        variants: [
          {
            src: [
              '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
            ],
            weight: '100 800',
            style: 'normal',
          },
        ],
      },
    },
  ],
  // The styles are small: inlined, they don't hold back the first paint.
  build: { inlineStylesheets: 'always' },
  // The dev toolbar would sit above the transition layer.
  devToolbar: { enabled: false },
  vite: {
    // three.js (its WebGPU build, ~900 kB minified, ~240 kB compressed) is
    // bigger than Vite's 500 kB warning, but only WebGL transitions load it.
    build: { chunkSizeWarningLimit: 1000 },
    // In dev, bundle three.js up front: transitions load lazily, so Vite would
    // only find it on the first WebGL transition, then reload the page mid-way.
    optimizeDeps: { include: ['three/webgpu', 'three/tsl'] },
  },
});
