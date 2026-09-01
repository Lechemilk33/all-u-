/**
 * Audits Curbcut's own pages with Curbcut's own engine.
 *
 * A tool that grades accessibility and fails its own grader has no argument to
 * make. This runs the live-DOM path — the strictest mode — across a sample of
 * every page type and fails the build on any Level AA violation.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('../packages/web/dist/', import.meta.url).pathname;
const AXE = new URL('../node_modules/axe-core/axe.min.js', import.meta.url).pathname;
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 4322;

const PAGES = [
  ['/', 'landing'],
  ['/wcag/', 'criteria index'],
  ['/wcag/1-4-3-contrast-minimum/', 'criterion detail'],
  ['/law/', 'law index'],
  ['/law/ada-title-ii/', 'regime detail'],
  ['/fix/', 'fix index'],
  ['/fix/image-alt/', 'fix detail'],
  ['/fix/shopify/', 'platform guide'],
  ['/deadlines/', 'deadlines'],
  ['/method/', 'method'],
  ['/bookmarklet/', 'bookmarklet'],
];

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
               '.svg':'image/svg+xml', '.xml':'application/xml', '.txt':'text/plain' };

const server = createServer(async (req, res) => {
  let f = new URL(req.url, `http://localhost:${PORT}`).pathname;
  if (f.endsWith('/')) f += 'index.html';
  else if (!extname(f)) f += '/index.html';
  try {
    const body = await readFile(join(ROOT, f));
    res.writeHead(200, { 'content-type': MIME[extname(f)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(PORT, r));

const axeSrc = await readFile(AXE, 'utf8');
const browser = await chromium.launch({ executablePath: CHROME });

let totalViolations = 0;
const rows = [];

for (const [path, label] of PAGES) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: 'networkidle' });
  await page.addScriptTag({ content: axeSrc });
  const r = await page.evaluate(async () =>
    window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22a','wcag22aa','best-practice'] },
      resultTypes: ['violations'],
    }).then((res) => ({
      violations: res.violations.map((v) => ({
        id: v.id, impact: v.impact, n: v.nodes.length,
        wcag: v.tags.some((t) => /^wcag\d{3,4}$/.test(t)),
        sample: v.nodes[0]?.html?.slice(0, 110),
      })),
    })));

  // Best-practice rules are reported but do not fail the build; only real
  // WCAG failures do, which is the same standard applied to scanned sites.
  const wcagFails = r.violations.filter((v) => v.wcag);
  totalViolations += wcagFails.length;
  rows.push({ path, label, wcag: wcagFails, advisory: r.violations.filter((v) => !v.wcag) });
  await page.close();
}

for (const row of rows) {
  const mark = row.wcag.length === 0 ? ' ok  ' : 'FAIL ';
  console.log(`${mark} ${row.path.padEnd(22)} ${row.label.padEnd(18)} ${
    row.wcag.length ? row.wcag.map((v) => `${v.id} x${v.n}`).join(', ') : 'no WCAG AA violations'}${
    row.advisory.length ? `   [advisory: ${row.advisory.map((v) => v.id).join(', ')}]` : ''}`);
  for (const v of row.wcag) console.log(`        ${v.id}: ${v.sample}`);
}

await browser.close();
server.close();

console.log(totalViolations === 0
  ? `\nCurbcut passes its own scan on all ${PAGES.length} page types.`
  : `\n${totalViolations} WCAG violation(s) on our own site.`);
process.exit(totalViolations === 0 ? 0 : 1);
