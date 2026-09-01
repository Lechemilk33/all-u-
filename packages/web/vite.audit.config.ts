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
