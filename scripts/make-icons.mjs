/**
 * Renders the extension icons from the site favicon, so there is one source of
 * truth for the mark. Chrome requires PNGs at 16, 48 and 128.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const SVG = join(HERE, '..', 'packages', 'web', 'public', 'favicon.svg');
const OUT = join(HERE, '..', 'packages', 'extension', 'icons');
const CHROME = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

await mkdir(OUT, { recursive: true });
const svg = await readFile(SVG, 'utf8');

const browser = await chromium.launch({ executablePath: CHROME });
for (const size of [16, 48, 128]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    { waitUntil: 'load' },
  );
  const png = await page.screenshot({ omitBackground: true });
  await writeFile(join(OUT, `${size}.png`), png);
  await page.close();
  console.log(`icons/${size}.png`);
}
await browser.close();
