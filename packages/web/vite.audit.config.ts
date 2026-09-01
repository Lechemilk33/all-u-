import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * Builds the bookmarklet payload as one self-contained file.
 *
 * It is injected into pages Curbcut does not control, so it cannot rely on
 * module loading, a shared chunk, or anything already on the page.
 */
export default defineConfig({
  root: resolve(import.meta.dirname),
  /**
   * ASCII-only output. A classic script injected into a page we do not control
   * is decoded using that page's encoding when the response carries no charset,
   * so a literal em dash in this bundle renders as mojibake on any host page
   * that is not UTF-8. Escaping non-ASCII to \uXXXX makes the payload
   * encoding-independent instead of relying on a header being right.
   */
  esbuild: { charset: 'ascii' },
  build: {
    outDir: resolve(import.meta.dirname, 'public'),
    emptyOutDir: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/audit.ts'),
      formats: ['iife'],
      name: '__curbcutAudit',
      fileName: () => 'audit.js',
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
