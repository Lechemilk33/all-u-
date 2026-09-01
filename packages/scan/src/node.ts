/**
 * Node adapter: fetch a URL (or take HTML) and scan it with jsdom.
 *
 * This is the static-HTML path. It sees what the server sent, which is exactly
 * what a crawler, a screen reader on a slow connection, and a plaintiff's
 * first look all see — but it does not execute the page's own JavaScript, so
 * client-rendered content is invisible to it. `renderMode` records which was
 * used so a report never overstates its own coverage.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { JSDOM, VirtualConsole } from 'jsdom';
import type { RenderMode } from '@curbcut/core';
import { scanDocument, type ScanOptions, type ScanResult } from './run.js';

const require = createRequire(import.meta.url);

let axeSource: string | null = null;
function loadAxeSource(): string {
  if (axeSource === null) axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
  return axeSource;
}

export interface FetchOptions {
  readonly timeoutMs?: number;
  readonly userAgent?: string;
}

const DEFAULT_UA =
  'Mozilla/5.0 (compatible; CurbcutBot/0.1; +https://curbcut.dev/bot) AppleWebKit/537.36';

export interface FetchedPage {
  readonly html: string;
  readonly finalUrl: string;
  readonly status: number;
  readonly contentType: string;
}

export async function fetchPage(url: string, options: FetchOptions = {}): Promise<FetchedPage> {
  const { timeoutMs = 20_000, userAgent = DEFAULT_UA } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': userAgent,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    const contentType = res.headers.get('content-type') ?? '';
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    if (!/text\/html|application\/xhtml/i.test(contentType)) {
      throw new Error(`Not an HTML document (${contentType || 'unknown content type'})`);
    }
    return { html: await res.text(), finalUrl: res.url || url, status: res.status, contentType };
  } finally {
    clearTimeout(timer);
  }
}

export interface NodeScanResult extends ScanResult {
  readonly renderMode: RenderMode;
  /** Set when the scan is a static one and the page looks client-rendered. */
  readonly coverageWarning?: string;
}

/**
 * Heuristic for "this page is a shell that JavaScript fills in". If the body has
 * very little text but plenty of script, a static scan understates the truth and
 * the report must say so rather than quietly reporting a clean bill of health.
 */
function coverageWarningFor(doc: Document): string | undefined {
  const bodyText = (doc.body?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const scripts = doc.querySelectorAll('script[src]').length;
  const roots = doc.querySelectorAll('#root, #app, #__next, [data-reactroot]').length;
  if (bodyText.length < 500 && (scripts >= 3 || roots > 0)) {
    return 'This page renders most of its content with JavaScript. A static scan sees only the initial HTML, so the real number of failures is very likely higher. Run the browser extension or the bookmarklet against the rendered page for a complete result.';
  }
  return undefined;
}

export async function scanHtml(
  html: string,
  url: string,
  options: ScanOptions = {},
): Promise<NodeScanResult> {
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', () => {});
  virtualConsole.on('error', () => {});

  const dom = new JSDOM(html, {
    url,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole,
  });

  try {
    const { window } = dom;
    window.eval(loadAxeSource());
    const axe = (window as unknown as { axe: Parameters<typeof scanDocument>[0] }).axe;
    if (!axe) throw new Error('axe-core failed to initialise in the virtual DOM');

    const result = await scanDocument(axe, window.document, { ...options, url });
    const warning = coverageWarningFor(window.document);
    return {
      ...result,
      renderMode: 'static-html',
      ...(warning ? { coverageWarning: warning } : {}),
    };
  } finally {
    dom.window.close();
  }
}

export async function scanUrl(
  url: string,
  options: ScanOptions & FetchOptions = {},
): Promise<NodeScanResult> {
  const page = await fetchPage(url, options);
  return scanHtml(page.html, page.finalUrl, options);
}
