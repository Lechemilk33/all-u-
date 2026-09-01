/**
 * The browser scan.
 *
 * Fetched HTML is sanitised, written into a same-origin frame, and laid out with
 * its real stylesheets. axe-core is then injected into that frame and run there.
 *
 * Running the engine *inside* the frame is not incidental. axe validates its
 * context against its own realm's `Document`, so a document handed across from
 * the parent is rejected; and colour contrast can only be computed where layout
 * actually happened. Injecting into the frame gives both, while the sanitiser
 * guarantees the only script in that frame is ours.
 */

import {
  toFinding,
  machineTestableCriteria,
  ruleCriteriaFromAxe,
  type Finding,
  type Region,
  type RenderMode,
} from '@curbcut/core';
import { regionOf, visibleLabelOf } from '@curbcut/scan';
import { sanitizeForScan } from './sanitize.js';
import { PROXY_URL } from './config.js';

export interface ProxyResponse {
  html: string;
  finalUrl: string;
  status: number;
  contentType: string;
  truncated: boolean;
}

export class ScanError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
    /** Set when the failure is that no fetch proxy is deployed to call. */
    readonly proxyUnavailable = false,
  ) {
    super(message);
    this.name = 'ScanError';
  }
}

/** Builds the proxy request URL. */
function proxyRequestUrl(target: string): string {
  // Resolved against the page so a same-origin default ("/api/fetch") works as
  // well as an absolute one, and so a proxy on a subpath is not mangled.
  const base = new URL(PROXY_URL, window.location.origin);
  base.searchParams.set('url', target);
  return base.toString();
}

export async function fetchThroughProxy(url: string, signal?: AbortSignal): Promise<ProxyResponse> {
  let res: Response;
  try {
    res = await fetch(proxyRequestUrl(url), { signal });
  } catch {
    throw new ScanError('Could not reach the fetch service.', undefined, true);
  }

  const body = (await res.json().catch(() => ({}))) as Partial<ProxyResponse> & { error?: string; hint?: string };
  if (!res.ok) {
    // 404 or 405 from a static host means there is no proxy deployed at all,
    // which is a different problem from a site that refused to be fetched.
    const missing = res.status === 404 || res.status === 405 || res.status === 501;
    throw new ScanError(
      missing
        ? 'This deployment has no fetch proxy, so it cannot scan by URL.'
        : (body.error ?? `The fetch service returned ${res.status}.`),
      missing ? undefined : body.hint,
      missing,
    );
  }
  if (typeof body.html !== 'string') throw new ScanError('The fetch service returned no HTML.');

  return {
    html: body.html,
    finalUrl: body.finalUrl ?? url,
    status: body.status ?? 200,
    contentType: body.contentType ?? 'text/html',
    truncated: body.truncated ?? false,
  };
}

interface AxeRuleMeta { ruleId: string; tags: string[] }
interface AxeNode { target: unknown[]; html: string; failureSummary?: string }
interface AxeResult {
  id: string; description: string; help: string; helpUrl: string;
  impact?: string | null; tags: string[]; nodes: AxeNode[];
}
interface AxeRun {
  violations: AxeResult[]; incomplete: AxeResult[]; passes: AxeResult[];
  testEngine?: { name: string; version: string };
}
interface AxeGlobal {
  run(context: Document, options: unknown): Promise<AxeRun>;
  getRules(): AxeRuleMeta[];
  version: string;
}

const FRAME_WIDTH = 1280;
const FRAME_HEIGHT = 900;

/**
 * axe-core is ~550 kB of source that only a scan needs, so it is fetched on
 * first use rather than shipped with the landing page. Cached after that.
 */
let axeSourcePromise: Promise<string> | null = null;
const loadAxeSource = (): Promise<string> => {
  axeSourcePromise ??= import('axe-core/axe.min.js?raw').then((m) => m.default);
  return axeSourcePromise;
};

function tagsFor(level: 'A' | 'AA'): string[] {
  const t = ['wcag2a', 'wcag21a', 'wcag22a'];
  if (level === 'AA') t.push('wcag2aa', 'wcag21aa', 'wcag22aa');
  return t;
}

/** Waits for the frame's stylesheets and images, with a hard ceiling. */
async function waitForLayout(frame: HTMLIFrameElement, budgetMs = 4000): Promise<void> {
  const doc = frame.contentDocument;
  if (!doc) return;

  const ready = new Promise<void>((resolve) => {
    if (doc.readyState === 'complete') return resolve();
    frame.addEventListener('load', () => resolve(), { once: true });
  });

  await Promise.race([ready, new Promise<void>((r) => setTimeout(r, budgetMs))]);

  // Give late stylesheets a moment; contrast is unmeasurable until they apply.
  const deadline = Date.now() + budgetMs;
  for (;;) {
    const sheets = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet" i]'));
    const pending = sheets.filter((l) => !l.sheet && !l.dataset.curbcutFailed);
    if (pending.length === 0 || Date.now() > deadline) break;
    await new Promise((r) => setTimeout(r, 120));
  }
  await new Promise((r) => requestAnimationFrame(() => r(null)));
}

export interface BrowserScanResult {
  readonly url: string;
  readonly title: string;
  readonly lang: string | null;
  readonly scannedAt: string;
  readonly engine: string;
  readonly renderMode: RenderMode;
  readonly findings: Finding[];
  readonly needsReview: Finding[];
  readonly testableCriteria: Set<string>;
  readonly sanitised: { scripts: number; handlers: number };
  readonly truncated: boolean;
}

/**
 * Renders `html` in `frame` and scans it. The caller owns the frame so the page
 * can keep it around and highlight findings in it afterwards.
 */
export async function scanHtmlInFrame(
  frame: HTMLIFrameElement,
  html: string,
  url: string,
  options: { level?: 'A' | 'AA'; truncated?: boolean } = {},
): Promise<BrowserScanResult> {
  const { level = 'AA', truncated = false } = options;

  const clean = sanitizeForScan(html, url);

  frame.setAttribute('sandbox', 'allow-same-origin allow-scripts');
  frame.width = String(FRAME_WIDTH);
  frame.height = String(FRAME_HEIGHT);

  const doc = frame.contentDocument;
  if (!doc) throw new ScanError('The browser would not open a frame to render the page in.');

  doc.open();
  doc.write(clean.html);
  doc.close();

  await waitForLayout(frame);

  const win = frame.contentWindow as (Window & { axe?: AxeGlobal }) | null;
  if (!win) throw new ScanError('The render frame closed before the scan could run.');

  const script = doc.createElement('script');
  script.textContent = await loadAxeSource();
  (doc.head ?? doc.documentElement).appendChild(script);

  const axe = win.axe;
  if (!axe) throw new ScanError('The accessibility engine failed to start in the render frame.');

  const results = await axe.run(doc, {
    runOnly: { type: 'tag', values: tagsFor(level) },
    resultTypes: ['violations', 'incomplete'],
    elementRef: false,
    performanceTimer: false,
  });

  const enrich = (r: AxeResult) =>
    toFinding({
      id: r.id,
      description: r.description,
      help: r.help,
      helpUrl: r.helpUrl,
      impact: r.impact ?? null,
      tags: r.tags,
      nodes: r.nodes.map((n) => {
        const selectors = n.target.flat(Infinity).filter((t): t is string => typeof t === 'string');
        const selector = selectors[selectors.length - 1];
        let el: Element | null = null;
        try {
          el = selector ? doc.querySelector(selector) : null;
        } catch {
          el = null;
        }
        const region: Region = el ? regionOf(el, url) : 'unknown';
        const label = el ? visibleLabelOf(el) : undefined;
        return {
          target: selectors,
          html: n.html,
          ...(n.failureSummary ? { failureSummary: n.failureSummary } : {}),
          region,
          ...(label ? { label } : {}),
        };
      }),
    });

  const renderMode: RenderMode = 'rendered-dom';

  return {
    url,
    title: doc.title || '',
    lang: doc.documentElement?.getAttribute('lang') ?? null,
    scannedAt: new Date().toISOString(),
    engine: results.testEngine ? `${results.testEngine.name} ${results.testEngine.version}` : `axe-core ${axe.version}`,
    renderMode,
    findings: results.violations.map(enrich),
    needsReview: results.incomplete.map(enrich),
    testableCriteria: machineTestableCriteria(ruleCriteriaFromAxe(axe.getRules()), renderMode),
    sanitised: { scripts: clean.removedScripts, handlers: clean.removedHandlers },
    truncated,
  };
}

export async function scanUrlInBrowser(
  frame: HTMLIFrameElement,
  url: string,
  options: { level?: 'A' | 'AA'; signal?: AbortSignal; onStage?: (stage: string) => void } = {},
): Promise<BrowserScanResult> {
  options.onStage?.('fetch');
  const page = await fetchThroughProxy(url, options.signal);

  options.onStage?.('render');
  const result = await scanHtmlInFrame(frame, page.html, page.finalUrl, {
    ...(options.level ? { level: options.level } : {}),
    truncated: page.truncated,
  });

  options.onStage?.('done');
  return result;
}

/** Normalises what someone types into the box into a URL worth fetching. */
export function normaliseUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new ScanError('Enter a website address to scan.');
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new ScanError(`“${trimmed}” is not a web address.`, 'Try something like example.com or https://example.com/checkout');
  }
  if (!url.hostname.includes('.')) {
    throw new ScanError(`“${trimmed}” is not a full domain.`, 'Include the domain ending, for example example.com');
  }
  return url.toString();
}
