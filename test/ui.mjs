/**
 * Browser smoke test.
 *
 * Asserts the properties that matter for correctness rather than for looks:
 * that rows render from live data, that both legs are shown separately, that an
 * absent baseline renders as "unknown" and never as a number, and that the
 * staging panel carries exact copyable values.
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';

const BASE = process.env.FLIP_URL ?? 'http://127.0.0.1:8787';
mkdirSync('test/shots', { recursive: true });

// The container ships a pinned Chromium that may not match the version this
// Playwright build expects, so prefer an explicit path and fall back to
// whatever Playwright resolves itself.
const explicit = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(
  existsSync(explicit) ? { executablePath: explicit } : {},
);
const page = await browser.newPage({ viewport: { width: 1600, height: 940 } });
const failures = [];
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else { console.log(`  FAIL ${name} ${detail}`); failures.push(name); }
};

page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') failures.push(`console: ${m.text()}`); });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('#rows tr', { timeout: 15000 });

const rows = await page.locator('#rows tr').count();
check('rows rendered from live feed', rows > 0, `(${rows} rows)`);

const feed = await page.locator('#feed-text').textContent();
check('feed health shows live status', /live|stale|error/.test(feed ?? ''), `("${feed}")`);

const legs = await page.locator('#rows tr:first-child .legs').textContent();
check('both legs shown separately', /b .+ \/ s .+/.test(legs ?? ''), `("${legs}")`);

const cash = await page.locator('#cash-value').textContent();
check('cash absent renders as "not connected", not 0', cash === 'not connected', `("${cash}")`);

const funnelText = await page.locator('#funnel').textContent();
check('funnel is visible', (funnelText ?? '').includes('input'), '');

// An unknown z-score must never render as a bare number.
const unknowns = await page.locator('.z-unknown').count();
const zNums = await page.locator('.z-normal, .z-wide, .z-extreme').count();
check('z-scores render as number or explicit unknown', unknowns + zNums === rows,
      `(${zNums} numeric + ${unknowns} unknown vs ${rows} rows)`);

await page.screenshot({ path: 'test/shots/grid.png' });

// Drawer
await page.locator('#rows tr').first().click();
await page.waitForSelector('#drawer:not([hidden])');
const drawer = await page.locator('#d-body').textContent();
check('drawer shows staging values', (drawer ?? '').includes('Search for'), '');
check('drawer shows provenance', (drawer ?? '').includes('/latest'), '');
check('drawer names the rules honestly', (drawer ?? '').includes('never places'), '');
await page.screenshot({ path: 'test/shots/detail.png' });

// Light theme renders too.
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
await page.screenshot({ path: 'test/shots/light.png' });

await browser.close();
console.log(failures.length === 0 ? '\nUI OK' : `\n${failures.length} failure(s): ${failures.join('; ')}`);
process.exit(failures.length === 0 ? 0 : 1);
