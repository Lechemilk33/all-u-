/**
 * Loads the unpacked extension into real Chromium and audits two pages.
 *
 * The second page sets a strict Content-Security-Policy. A bookmarklet cannot
 * run there at all — the page refuses the injected script — so this is the
 * check that the extension actually earns its existence rather than duplicating
 * the bookmarklet.
 */
import { createServer } from 'node:http';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const DIST = new URL('../packages/extension/dist', import.meta.url).pathname;
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 4330;

const BODY = `<h1>Nordvik Supply</h1>
<style>.muted{color:#bcbcbc}.icon{background:none;border:0}</style>
<p class="muted">Orders before 3pm ship same day.</p>
<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="40" height="40">
<form id="checkout"><input type="email" name="email"><button class="icon">&#215;</button></form>
<div id="late"></div>
<script>document.getElementById('late').innerHTML='<a href="/x"><svg width="12" height="12"></svg></a>';</script>`;

/**
 * The shipped manifest uses `activeTab`, which Chrome grants only on a real
 * toolbar click — a gesture no automated harness can produce. So the test loads
 * a copy carrying the host permission the user would otherwise grant from the
 * extension's own options. Everything below that line is the shipped code path:
 * the same service worker, the same injection, the same auditor.
 */
const EXT = await mkdtemp(join(tmpdir(), 'curbcut-ext-'));
await cp(DIST, EXT, { recursive: true });
{
  const manifestPath = join(EXT, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.host_permissions = ['http://localhost/*'];
  delete manifest.optional_host_permissions;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}

const server = createServer((req, res) => {
  const strict = req.url.startsWith('/strict');
  const headers = { 'content-type': 'text/html; charset=utf-8' };
  if (strict) {
    // Blocks inline and injected scripts outright — the bookmarklet's hard limit.
    headers['content-security-policy'] = "default-src 'self'; script-src 'none'; style-src 'unsafe-inline'";
  }
  res.writeHead(200, headers);
  res.end(`<!doctype html><html lang="en"><head><title>${strict ? 'Strict CSP' : 'Normal'}</title></head><body>${BODY}</body></html>`);
});
await new Promise((r) => server.listen(PORT, r));

const context = await chromium.launchPersistentContext('', {
  executablePath: CHROME,
  channel: 'chromium',
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

// Find the service worker so we can trigger the action the way a click does.
let worker = context.serviceWorkers()[0];
if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 20000 });
check('service worker started', !!worker, worker?.url()?.split('/').pop());

for (const [path, label] of [['/', 'normal page'], ['/strict', 'strict CSP page']]) {
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: 'networkidle' });

  // Drive the same code path the toolbar click uses.
  await page.bringToFront();
  const result = await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab) return { ok: false, error: 'no active tab' };
    return globalThis.__curbcutAuditTab(tab);
  });
  if (!result?.ok) console.log(`      worker reported: ${JSON.stringify(result)}`);

  let state = null;
  try {
    await page.waitForFunction(
      () => document.getElementById('curbcut-audit-panel')?.shadowRoot?.querySelector('.score'),
      { timeout: 25000 },
    );
    state = await page.evaluate(() => {
      const root = document.getElementById('curbcut-audit-panel').shadowRoot;
      const t = (s) => root.querySelector(s)?.textContent?.trim() ?? '';
      return {
        score: t('.score'),
        band: t('.band'),
        rules: [...root.querySelectorAll('.item code')].map((c) => c.textContent.trim()),
        note: t('.note'),
      };
    });
  } catch (e) {
    check(`audit ran on ${label}`, false, e.message.split('\n')[0]);
    await page.close();
    continue;
  }

  console.log(`\n  ${label}: index ${state.score} (${state.band}) — ${state.rules.join(', ')}`);
  check(`audit ran on ${label}`, /^\d+$/.test(state.score), `score "${state.score}"`);
  check(`  found contrast on ${label}`, state.rules.includes('color-contrast'), state.rules.join(','));
  check(`  found missing alt on ${label}`, state.rules.includes('image-alt'), state.rules.join(','));
  check(`  coverage note on ${label}`, /automated engine can decide/.test(state.note));
  await page.close();
}

await context.close();
server.close();
console.log(failures === 0 ? '\nEXTENSION OK' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
