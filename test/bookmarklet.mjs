/**
 * Verifies the bookmarklet payload on a third-party page.
 *
 * audit.js is injected into pages Curbcut does not control, so this checks the
 * things that only fail there: that it runs at all, that its panel survives the
 * host page's own CSS, and that it reports the live DOM rather than the served
 * HTML — including content that only exists after the page's scripts have run.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { launchChromium, launchPersistent } from './chromium.mjs';

const DIST = new URL('../packages/web/dist/', import.meta.url).pathname;
const PORT = 4323;

/**
 * A host page that is hostile in the ways real pages are: aggressive global
 * CSS, and half its content built by script so a static fetch would miss it.
 */
const HOST_PAGE = `<!doctype html><html lang="en"><head><title>Third-party host</title>
<style>
  * { font-family: cursive !important; }
  div { color: #ddd !important; background: #ddd !important; border: 4px dotted red !important; }
  button { all: unset !important; }
</style></head><body>
<h1>Host page</h1>
<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="30" height="30">
<div id="late"></div>
<script>
  // Built after load: invisible to any scan of the served HTML.
  var d = document.getElementById('late');
  d.innerHTML = '<form id="signup"><input type="email"><button></button></form>';
</script>
</body></html>`;

// Deliberately charset-less: this is the case the ASCII-only build defends
// against, so sending utf-8 here would hide the very bug it exists to catch.
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml' };
const server = createServer(async (req, res) => {
  const p = new URL(req.url, `http://localhost:${PORT}`).pathname;
  if (p === '/host') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(HOST_PAGE);
  }
  let f = p.endsWith('/') ? `${p}index.html` : p;
  try {
    const body = await readFile(join(DIST, f));
    res.writeHead(200, { 'content-type': MIME[extname(f)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('nf'); }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(`http://localhost:${PORT}/host`, { waitUntil: 'networkidle' });

// Exactly what the bookmarklet does.
await page.evaluate((origin) => {
  const s = document.createElement('script');
  s.src = `${origin}/audit.js`;
  document.documentElement.appendChild(s);
}, `http://localhost:${PORT}`);

await page.waitForFunction(
  () => document.getElementById('curbcut-audit-panel')?.shadowRoot?.querySelector('.score'),
  { timeout: 30000 },
);

const state = await page.evaluate(() => {
  const root = document.getElementById('curbcut-audit-panel').shadowRoot;
  const t = (s) => root.querySelector(s)?.textContent?.trim() ?? '';
  const panel = root.querySelector('.panel');
  const cs = getComputedStyle(panel);
  return {
    score: t('.score'),
    band: t('.band'),
    headline: t('.body p strong'),
    items: [...root.querySelectorAll('.item h3')].map((h) => h.textContent.trim()),
    rules: [...root.querySelectorAll('.item code')].map((c) => c.textContent.trim()),
    note: t('.note'),
    // Did the host page's `* { font-family: cursive !important }` leak in?
    fontIsolated: !/cursive/i.test(cs.fontFamily),
    positionFixed: cs.position === 'fixed',
    hasCloseButton: !!root.querySelector('[data-act="close"]'),
    dialogRole: panel.getAttribute('role'),
  };
});

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

console.log(JSON.stringify(state, null, 1));
console.log();

check('panel mounted on a third-party page', /^\d+$/.test(state.score), `score "${state.score}"`);
check('band named in words', state.band.length > 2, state.band);
check('shadow root isolates the host page CSS', state.fontIsolated);
check('panel is positioned independently of host layout', state.positionFixed);
check('panel is a labelled dialog with a close control', state.dialogRole === 'dialog' && state.hasCloseButton);
check('found the script-built form input', state.rules.some((r) => /label|aria-input/.test(r)), state.rules.join(','));
check('found the script-built empty button', state.rules.includes('button-name'), state.rules.join(','));
check('found the static missing alt', state.rules.includes('image-alt'), state.rules.join(','));
check('coverage note shown', /automated engine can decide/.test(state.note));
check('payload is encoding-independent, no mojibake', !/[\u00c2\u00c3\u00e2]/.test(state.note + state.headline),
  JSON.stringify(state.note.slice(55, 95)));
check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await page.screenshot({ path: 'test/shot-bookmarklet.png' });

// Closing must leave the host page exactly as it was.
await page.evaluate(() => document.getElementById('curbcut-audit-panel').shadowRoot
  .querySelector('[data-act="close"]').click());
const gone = await page.evaluate(() => !document.getElementById('curbcut-audit-panel'));
check('closes cleanly, leaving no residue', gone);

await browser.close();
server.close();
console.log(failures === 0 ? '\nBOOKMARKLET OK' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
