import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * The auditor, as one self-contained classic script.
 *
 * chrome.scripting.executeScript({ files }) injects classic scripts, not
 * modules, so this must be an IIFE with nothing left to import at runtime.
 */
export default defineConfig({
  root: resolve(import.meta.dirname),
  esbuild: { charset: 'ascii' },
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: false,
    target: 'chrome116',
    lib: {
      entry: resolve(import.meta.dirname, 'src/audit-extension.ts'),
      formats: ['iife'],
      name: '__curbcutAudit',
      fileName: () => 'audit.js',
    },
    rollupOptions: { output: { inlineDynamicImports: true, extend: true } },
  },
});
