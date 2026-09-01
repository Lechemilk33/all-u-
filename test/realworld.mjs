/**
 * Scans real production sites through the real code path.
 *
 * The fixture in e2e.mjs is planted, so it proves the pipeline but not that the
 * pipeline survives the actual web: enormous pages, unusual encodings, CSS that
 * loads slowly, markup that no fixture would think to contain.
 *
 * Network-dependent by nature, so this is not part of CI.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const DIST = new URL('../packages/web/dist/', import.meta.url).pathname;
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 4324;

const TARGETS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['https://example.com', 'https://news.ycombinator.com', 'https://www.w3.org/WAI/',
     'https://www.gnu.org', 'https://info.cern.ch'];

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml' };

// Stands in for the Worker, with the same response contract.
const server = createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  if (u.pathname === '/__proxy') {
    const target = u.searchParams.get('url');
    try {
      const r = await fetch(target, {
        redirect: 'follow',
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; CurbcutBot/0.1)', accept: 'text/html' },
      });
      const html = await r.text();
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' });
      return res.end(JSON.stringify({ html, finalUrl: r.url, status: r.status,
        contentType: r.headers.get('content-type') ?? '', truncated: false }));
    } catch (e) {
      res.writeHead(502, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
      return res.end(JSON.stringify({ error: String(e.message) }));
    }
  }
  let f = u.pathname.endsWith('/') ? `${u.pathname}index.html` : u.pathname;
  try {
    let body = await readFile(join(DIST, f));
    if (f.endsWith('.html')) {
      body = body.toString().replace(/<meta name="curbcut:proxy" content="[^"]*">/,
        `<meta name="curbcut:proxy" content="http://localhost:${PORT}/__proxy">`);
    }
    res.writeHead(200, { 'content-type': MIME[extname(f)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('nf'); }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch({ executablePath: CHROME });
let failures = 0;

for (const target of TARGETS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const started = Date.now();
  try {
    await page.goto(`http://localhost:${PORT}/?url=${encodeURIComponent(target)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#stage-report[data-active="true"]', { timeout: 60000 });
    const r = await page.evaluate(() => {
      const t = (s) => document.querySelector(s)?.textContent?.trim() ?? '';
      return {
        index: t('.gauge-value'), band: t('.gauge-band'),
        rules: [...document.querySelectorAll('.exhibit .tag')].map((e) => e.textContent.trim()),
        regions: [...document.querySelectorAll('.exhibit-meta')]
          .map((m) => m.textContent.match(/Where:\s*([^I]+)/)?.[1]?.trim()),
        criteria: t('#verdict-h ~ .form-hint'),
        coverage: t('#coverage-h ~ p'),
      };
    });
    const ms = Date.now() - started;
    console.log(`\n${target}`);
    console.log(`  index ${r.index} (${r.band})  in ${(ms / 1000).toFixed(1)}s`);
    console.log(`  exhibits: ${r.rules.length ? r.rules.map((x, i) => `${x}@${r.regions[i] ?? '?'}`).join(', ') : '(none)'}`);
    console.log(`  ${r.criteria || '(no failing criteria)'}`);
    if (errs.length) { console.log(`  PAGE ERRORS: ${errs.slice(0, 2).join(' | ')}`); failures++; }
    if (!/^\d+$/.test(r.index)) { console.log('  FAIL: no index rendered'); failures++; }
    if (!/automated engine can decide/.test(r.coverage)) { console.log('  FAIL: coverage note missing'); failures++; }
  } catch (e) {
    console.log(`\n${target}\n  FAIL: ${e.message.split('\n')[0]}`);
    failures++;
  }
  await page.close();
}

await browser.close();
server.close();
console.log(failures === 0 ? '\nAll real-world scans completed cleanly.' : `\n${failures} problem(s).`);
process.exit(failures === 0 ? 0 : 1);
