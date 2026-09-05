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

// The invariant is not which state we are in, but that an absent cash stack is
// never rendered as a number. Both states are legitimate; "0 gp" is not.
const cash = await page.locator('#cash-value').textContent();
const cashOk = cash === 'not connected' || /^[\d.,]+[kmb]? gp$/.test(cash ?? '');
check('cash is a real figure or an explicit "not connected"', cashOk, `("${cash}")`);
const cashClass = await page.locator('#cash-value').getAttribute('class');
check('absent cash is styled as absent, not as a value',
      cash === 'not connected' ? (cashClass ?? '').includes('absent') : !(cashClass ?? '').includes('absent'),
      `("${cash}" / "${cashClass}")`);

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
// The drawer must state the boundary it actually operates within: it types,
// it does not trade, and confirming stays the user's action.
check('drawer names the boundary honestly',
      (drawer ?? '').includes('synthesised') && (drawer ?? '').includes('stay yours'),
      `("${(drawer ?? '').slice(0, 80)}")`);
check('drawer offers staging to the client', (drawer ?? '').includes('Send to client'), '');
await page.screenshot({ path: 'test/shots/detail.png' });

// Light theme renders too.
// Positions tab: everything here comes from the client report, so the tab must
// say so plainly when nothing is connected rather than rendering empty state.
await page.keyboard.press('Escape');
await page.locator('#tab-positions').click();
await page.waitForSelector('#view-positions:not([hidden])');
await page.waitForTimeout(600);

const pos = await page.locator('#positions').textContent();
const hasSlots = (pos ?? '').includes('Grand Exchange slots');
const saysDisconnected = (pos ?? '').includes('No client connected');
check('positions tab renders slots or names the disconnect', hasSlots || saysDisconnected, `("${(pos ?? '').slice(0, 60)}")`);

if (hasSlots) {
  const bars = await page.locator('.bar-fill').count();
  check('every slot has a fill bar', bars > 0, `(${bars})`);
  // A slot with nothing filled must never print a realised price of 0.
  check('no realised price of zero is rendered', !/Realised price\s*0 gp/.test(pos ?? ''), '');
  check('fill history is measured, not estimated', (pos ?? '').includes('measured, not estimated'), '');
}
await page.screenshot({ path: 'test/shots/positions.png' });

await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
await page.screenshot({ path: 'test/shots/light.png' });

await browser.close();
console.log(failures.length === 0 ? '\nUI OK' : `\n${failures.length} failure(s): ${failures.join('; ')}`);
process.exit(failures.length === 0 ? 0 : 1);
