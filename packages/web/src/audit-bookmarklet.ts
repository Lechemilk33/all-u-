/**
 * Bookmarklet entry.
 *
 * Injects axe-core into the page, because a bookmarklet has only the page's own
 * privileges. That is also its limitation: a site with a strict
 * Content-Security-Policy will refuse the injected script, and there is nothing
 * a bookmarklet can do about that. The extension has no such limit.
 */

import axeSource from 'axe-core/axe.min.js?raw';
import { runAudit, type AxeGlobal } from './audit-core.js';

function injectAxe(): AxeGlobal {
  const existing = (window as unknown as { axe?: AxeGlobal }).axe;
  if (existing?.run) return existing;

  const script = document.createElement('script');
  script.textContent = axeSource;
  document.documentElement.appendChild(script);
  script.remove();

  const axe = (window as unknown as { axe?: AxeGlobal }).axe;
  if (!axe) {
    throw new Error(
      "This page's Content-Security-Policy blocked the engine. The Curbcut extension is not subject to it.",
    );
  }
  return axe;
}

void runAudit(injectAxe);
