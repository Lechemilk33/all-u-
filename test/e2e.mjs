/**
 * End-to-end check: serve the built site, stand up a local stand-in for the
 * Cloudflare fetch proxy, drive a real scan in Chromium, and assert the report
 * actually renders — including the checks that only exist once a page is laid
 * out, which are the ones a markup-only scanner silently misses.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('../packages/web/dist/', import.meta.url).pathname;
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 4319;

/** A deliberately broken storefront: every failure here is planted. */
const FIXTURE = `<!doctype html><html lang="en"><head><title>Nordvik Supply — Checkout</title>
<style>
 body{background:#fff;color:#222;font:16px/1.5 system-ui;margin:0;padding:24px}
 .muted{color:#b4b4b4}
 .promo{background:#6aa9e9;color:#fff;padding:10px}
 nav a{color:#9aa4b0}
 footer{color:#c9c9c9;margin-top:40px}
 .icon-btn{background:none;border:0;font-size:20px}
</style></head><body>
<nav><a href="/">Home</a> <a href="/shop">Shop</a> <a href="/x"><svg width="20" height="20"><circle cx="10" cy="10" r="9"/></svg></a></nav>
<main>
  <h1>Checkout</h1>
  <p class="muted">Orders placed before 3pm ship the same day.</p>
  <p class="promo">Save 10% with code SPRING</p>
  <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="120" height="90">
  <form id="checkout-form" action="/pay">
    <input type="email" name="email" placeholder="Email address">
    <input type="text" name="postcode" placeholder="Postcode">
    <button class="icon-btn">&#215;</button>
    <button type="submit">Pay now</button>
  </form>
</main>
<footer><p>&copy; Nordvik Supply</p><a href="/terms"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="16" height="16"></a></footer>
</body></html>`;

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.json':'application/json' };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/__proxy') {
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
    return res.end(JSON.stringify({ html: FIXTURE, finalUrl: 'https://nordvik.example/checkout',
      status: 200, contentType: 'text/html', truncated: false }));
  }

  let file = url.pathname === '/' ? '/index.html' : url.pathname;
  if (file.endsWith('/')) file += 'index.html';
  else if (!extname(file)) file += '/index.html';
  try {
    let body = await readFile(join(ROOT, file));
    if (file.endsWith('.html')) {
      body = body.toString().replace(
        /<meta name="curbcut:proxy" content="[^"]*">/,
        `<meta name="curbcut:proxy" content="http://localhost:${PORT}/__proxy">`);
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
check('landing page renders', (await page.title()).includes('Curbcut'));

// The proxy stand-in ignores the URL, so anything valid exercises the same path.
await page.fill('#scan-url', 'nordvik.example/checkout');
await page.click('#scan-submit');
try {
  await page.waitForSelector('#stage-report[data-active="true"]', { timeout: 30000 });
} catch (e) {
  console.log('\n--- scan did not complete ---');
  console.log('error box :', await page.evaluate(() => document.querySelector('#scan-error')?.textContent || '(empty)'));
  console.log('status    :', await page.evaluate(() => document.querySelector('#scan-status')?.textContent || '(empty)'));
  console.log('stage     :', await page.evaluate(() => [...document.querySelectorAll('.stage')].map(s=>s.id+'='+s.dataset.active).join(' ')));
  console.log('console   :', consoleErrors.slice(0,8).join('\n            ') || '(none)');
  await browser.close(); server.close(); process.exit(1);
}

const report = await page.evaluate(() => {
  const t = (s) => document.querySelector(s)?.textContent?.trim() ?? '';
  return {
    index: t('.gauge-value'),
    band: t('.gauge-band'),
    headline: t('#verdict-h'),
    exhibits: [...document.querySelectorAll('.exhibit')].map((e) => ({
      title: e.querySelector('.exhibit-title')?.textContent?.trim(),
      rule: e.querySelector('.tag')?.textContent?.trim(),
      meta: e.querySelector('.exhibit-meta')?.textContent?.replace(/\s+/g, ' ').trim(),
    })),
    coverage: t('#coverage-h ~ p'),
    blindSpots: [...document.querySelectorAll('#coverage-h ~ .callout h3')].map((h) => h.textContent.trim()),
    lawRows: document.querySelectorAll('#law-h ~ .table-scroll tbody tr').length,
    remediation: document.querySelectorAll('#fix-h ~ .grid details').length,
    disclaimer: t('.callout-legal p'),
    evidenceEscaped: [...document.querySelectorAll('.evidence')].every((p) => p.querySelector('img,button,form') === null),
    docTitle: document.title,
  };
});

console.log('\n--- report ---');
console.log(JSON.stringify(report, null, 1).slice(0, 2600));
console.log('---\n');

check('exposure index rendered', /^\d+$/.test(report.index), `got "${report.index}"`);
check('band is named in words', report.band.length > 2, report.band);
check('headline names the host', report.headline.includes('nordvik.example'));
check('exhibits produced', report.exhibits.length >= 3, `${report.exhibits.length} exhibits`);

const rules = report.exhibits.map((e) => e.rule);
check('contrast detected (needs real layout)', rules.includes('color-contrast'), rules.join(','));
check('missing alt detected', rules.includes('image-alt'), rules.join(','));
check('checkout region weighting applied',
  report.exhibits.some((e) => /Checkout|A form/i.test(e.meta ?? '')),
  report.exhibits.map((e) => e.meta?.match(/Where: [^ ]+ ?[^I]*/)?.[0]).join(' | '));

check('coverage statement present', /automated engine can decide/.test(report.coverage));
check('blind spots disclosed', report.blindSpots.length >= 2, report.blindSpots.join(' / '));
check('legal regimes tabulated', report.lawRows >= 1, `${report.lawRows} rows`);
check('remediation plan present', report.remediation >= 2, `${report.remediation} items`);
check('disclaimer present', /not legal advice/.test(report.disclaimer));
check('scanned markup is escaped, not live', report.evidenceEscaped);
check('document title updated for sharing', report.docTitle.includes('Exposure Index'));
check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

await page.screenshot({ path: 'test/report.png', fullPage: true });
console.log('\nscreenshot: test/report.png');

await browser.close();
server.close();
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
