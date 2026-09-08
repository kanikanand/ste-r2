import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Inline the CSS and JS into dist/index.html and drop the separate asset files,
 * so the build is a single file that also works when opened straight from disk
 * (browsers refuse to load ES modules or stylesheets over file://).
 */
function singleFile() {
  return {
    name: 'single-file',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = bundle['index.html'];
      const js = Object.values(bundle).find((f) => f.type === 'chunk' && f.isEntry);
      const css = Object.values(bundle).find((f) => f.type === 'asset' && f.fileName.endsWith('.css'));
      if (!html || !js) return;

      let source = html.source;
      if (css) {
        source = source.replace(
          new RegExp(`<link[^>]+href="[^"]*${css.fileName}"[^>]*>`),
          () => `<style>${css.source}</style>`
        );
        delete bundle[css.fileName];
      }
      // Vite hoists the entry script into <head>. As a classic inline script
      // that would run before #root exists, so drop it there and re-emit it at
      // the end of <body>. Function replacements keep $-sequences in the
      // bundle from being read as regex references.
      source = source.replace(new RegExp(`<script[^>]+src="[^"]*${js.fileName}"[^>]*></script>`), '');
      source = source.replace('</body>', () => `<script>${js.code}</script></body>`);
      delete bundle[js.fileName];
      html.source = source;
    },
  };
}

export default defineConfig({
  plugins: [react(), singleFile()],
  base: './',
  server: { host: true, port: 5173 },
  build: {
    // A classic, self-contained script — no module loading, no separate files.
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
});
