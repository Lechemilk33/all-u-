import { defineConfig, type Plugin } from 'vite';
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

/**
 * The path the site is served from — "/" at a root domain, "/all-u-/" on GitHub
 * Pages. Vite rewrites asset URLs for us, but not the internal links written by
 * hand in index.html, so the plugin below does those and records the base in a
 * meta tag for the client to read.
 */
const BASE = (() => {
  const raw = process.env.CURBCUT_BASE ?? '/';
  const lead = raw.startsWith('/') ? raw : `/${raw}`;
  return lead.endsWith('/') ? lead : `${lead}/`;
})();

const INTERNAL_LINK = /(href|action)="\/(?!\/)([^"]*)"/g;

function basePaths(): Plugin {
  return {
    name: 'curbcut-base-paths',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (BASE === '/') {
          return html.includes('curbcut:base')
            ? html
            : html.replace('<head>', '<head>\n<meta name="curbcut:base" content="/">');
        }
        const prefix = BASE.replace(/^\/|\/$/g, '');
        return html
          .replace(INTERNAL_LINK, (whole, attr, path) => {
            // Vite resolves and rewrites its own entries, and the generated
            // pages already carry the base — so this must be idempotent or a
            // subpath deploy ends up at /all-u-/all-u-/.
            if (path.startsWith('src/')) return whole;
            if (path === prefix || path.startsWith(`${prefix}/`)) return whole;
            return `${attr}="${BASE}${path}"`;
          })
          .replace(
            '<meta charset="utf-8">',
            `<meta charset="utf-8">\n<meta name="curbcut:base" content="${BASE}">`,
          );
      },
    },
  };
}

export default defineConfig({
  root,
  base: BASE,
  publicDir: resolve(root, 'public'),
  appType: 'mpa',
  plugins: [basePaths()],
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
