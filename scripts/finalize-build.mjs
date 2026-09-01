/**
 * Post-build tidy.
 *
 * Generated reference pages live under packages/web/pages/ so they stay out of
 * the package root, but they must be served from the site root — /wcag/1.4.3/,
 * not /pages/wcag/1.4.3/. Vite mirrors the input path, so this lifts them.
 */
import { rename, rm, readdir, mkdir, cp } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'web', 'dist');
const PAGES = join(DIST, 'pages');

let moved = 0;
try {
  for (const entry of await readdir(PAGES, { withFileTypes: true })) {
    const from = join(PAGES, entry.name);
    const to = join(DIST, entry.name);
    await mkdir(dirname(to), { recursive: true });
    try {
      await rename(from, to);
    } catch {
      // Cross-device or an existing target: copy then drop the original.
      await cp(from, to, { recursive: true, force: true });
      await rm(from, { recursive: true, force: true });
    }
    moved++;
  }
  await rm(PAGES, { recursive: true, force: true });
} catch (err) {
  if ((err instanceof Error && 'code' in err && err.code === 'ENOENT')) {
    console.log('No generated pages to lift.');
  } else {
    throw err;
  }
}
console.log(`Lifted ${moved} page group(s) to the site root.`);
