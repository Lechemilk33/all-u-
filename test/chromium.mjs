/**
 * Resolves a Chromium to drive.
 *
 * The sandbox this was developed in ships a browser at a fixed path and sets
 * PLAYWRIGHT_BROWSERS_PATH; a CI runner installs its own. Hard-coding either
 * breaks the other, so prefer an explicit override, then a discovered build,
 * then let Playwright resolve it itself.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

function discover() {
  const explicit = process.env.CHROME_PATH;
  if (explicit && existsSync(explicit)) return explicit;

  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;

  for (const dir of readdirSync(root)) {
    if (!dir.startsWith('chromium-')) continue;
    for (const candidate of ['chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
      const full = join(root, dir, candidate);
      if (existsSync(full)) return full;
    }
  }
  return undefined;
}

/** Launch options carrying an executablePath only when one was found. */
export function chromiumOptions(extra = {}) {
  const executablePath = discover();
  return { ...(executablePath ? { executablePath } : {}), ...extra };
}

export const launchChromium = (extra = {}) => chromium.launch(chromiumOptions(extra));

export const launchPersistent = (userDataDir, extra = {}) =>
  chromium.launchPersistentContext(userDataDir, chromiumOptions(extra));
