import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname);

/**
 * Copies the manifest and icons, which Vite does not process.
 * The auditor is built separately by vite.audit.config.ts, because Chrome
 * injects it as a classic script while the service worker must be a module.
 */
function extensionAssets() {
  return {
    name: 'curbcut-extension-assets',
    closeBundle() {
      const out = resolve(root, 'dist');
      mkdirSync(resolve(out, 'icons'), { recursive: true });
      copyFileSync(resolve(root, 'manifest.json'), resolve(out, 'manifest.json'));
      for (const icon of readdirSync(resolve(root, 'icons'))) {
        copyFileSync(resolve(root, 'icons', icon), resolve(out, 'icons', icon));
      }
    },
  };
}

export default defineConfig({
  root,
  // ASCII-only: the auditor renders text into pages whose encoding we do not
  // control, exactly as the bookmarklet does.
  esbuild: { charset: 'ascii' },
  plugins: [extensionAssets()],
  build: {
    outDir: resolve(root, 'dist'),
    emptyOutDir: true,
    target: 'chrome116',
    rollupOptions: {
      input: { background: resolve(root, 'src/background.ts') },
      output: {
        entryFileNames: '[name].js',
        // Chrome loads these as plain files, not as a module graph, so each
        // entry has to be self-contained.
        inlineDynamicImports: false,
        manualChunks: undefined,
        format: 'es',
      },
      preserveEntrySignatures: false,
    },
  },
});
