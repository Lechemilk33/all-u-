/**
 * Writes the bookmarklet loader.
 *
 * The bookmark itself stays tiny and stable — it only injects the audit bundle
 * from curbcut.dev — so an installed bookmarklet keeps working as the auditor
 * is updated, without anyone re-dragging it.
 */
import { writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, '..', 'packages', 'web', 'public');
const ORIGIN = process.env.CURBCUT_ORIGIN ?? 'https://curbcut.dev';

const loader = `(function(){
  var d=document, id='curbcut-audit-loader';
  var old=d.getElementById(id); if(old) old.remove();
  var s=d.createElement('script');
  s.id=id; s.src='${ORIGIN}/audit.js?t='+Date.now();
  s.onerror=function(){alert('Curbcut could not load on this page. Its Content-Security-Policy blocks injected scripts — use the scanner at ${ORIGIN} instead.');};
  d.documentElement.appendChild(s);
})();`;

const minified = loader.replace(/\n\s*/g, '');
const href = `javascript:${encodeURIComponent(minified)}`;

await writeFile(join(PUBLIC, 'bookmarklet.js'), minified, 'utf8');
await writeFile(join(PUBLIC, 'bookmarklet.txt'), href, 'utf8');

// Put the real href into the install page so nobody has to copy it by hand.
const pagePath = join(HERE, '..', 'packages', 'web', 'pages', 'bookmarklet', 'index.html');
try {
  let html = await readFile(pagePath, 'utf8');
  const escaped = href.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  html = html
    .replace(/(<a class="btn" id="bookmarklet-link" href=")[^"]*(")/, `$1${escaped}$2`)
    .replace(/(<code id="bookmarklet-code">)[\s\S]*?(<\/code>)/, `$1${escaped}$2`)
    .replace(/<script type="module" src="\/src\/bookmarklet-page\.ts"><\/script>/, '');
  await writeFile(pagePath, html, 'utf8');
  console.log(`Bookmarklet written (${href.length} chars) and injected into /bookmarklet/`);
} catch (err) {
  console.log(`Bookmarklet written (${href.length} chars); install page not found yet.`);
}
