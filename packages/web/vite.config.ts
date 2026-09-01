import { defineConfig } from 'vite';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname);

/** Every generated page becomes its own entry so the build stays a static MPA. */
function htmlEntries(dir: string, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) Object.assign(out, htmlEntries(full, `${prefix}${name}/`));
    else if (name.endsWith('.html')) out[`${prefix}${name.replace(/\.html$/, '')}`] = full;
  }
  return out;
}

export default defineConfig({
  root,
  publicDir: resolve(root, 'public'),
  appType: 'mpa',
  build: {
    outDir: resolve(root, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(root, 'index.html'),
        ...htmlEntries(resolve(root, 'pages')),
      },
    },
  },
});
