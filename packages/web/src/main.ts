/**
 * Scanner page controller.
 *
 * Owns the form, the scan lifecycle and the announcement of progress. The scan
 * itself is a long operation with no visual output until it finishes, so every
 * stage change is written to a live region — a progress bar nobody can perceive
 * would be an unusually poor joke on this particular site.
 */

import { buildReport, daysUntil, suggestRegimes, type RegimeId } from '@curbcut/core';
import { siteHref } from './config.js';
import { ScanError, normaliseUrl, scanUrlInBrowser, type BrowserScanResult } from './scan-browser.js';
import { renderReport } from './report-view.js';
import './styles.css';

const $ = <T extends HTMLElement>(sel: string): T | null => document.querySelector<T>(sel);

const form = $<HTMLFormElement>('#scan-form');
const input = $<HTMLInputElement>('#scan-url');
const submit = $<HTMLButtonElement>('#scan-submit');
const errorBox = $<HTMLParagraphElement>('#scan-error');
const status = $<HTMLElement>('#scan-status');
const stageIntro = $<HTMLElement>('#stage-intro');
const stageProgress = $<HTMLElement>('#stage-progress');
const stageReport = $<HTMLElement>('#stage-report');
const reportMount = $<HTMLElement>('#report');
const frame = $<HTMLIFrameElement>('#preview-frame');
const jurisdiction = $<HTMLSelectElement>('#jurisdiction');

const STAGES = [
  { id: 'fetch', label: 'Fetching the page' },
  { id: 'render', label: 'Rendering it with its real stylesheets' },
  { id: 'audit', label: 'Running 105 accessibility checks' },
  { id: 'score', label: 'Mapping failures to law and scoring exposure' },
] as const;

type StageId = (typeof STAGES)[number]['id'] | 'done';

function showStage(which: 'intro' | 'progress' | 'report'): void {
  stageIntro?.setAttribute('data-active', String(which === 'intro'));
  stageProgress?.setAttribute('data-active', String(which === 'progress'));
  stageReport?.setAttribute('data-active', String(which === 'report'));
}

function markStage(current: StageId): void {
  const order = STAGES.map((s) => s.id) as readonly string[];
  const currentIndex = current === 'done' ? order.length : order.indexOf(current);
  for (const [i, stage] of STAGES.entries()) {
    const li = document.getElementById(`stage-${stage.id}`);
    if (!li) continue;
    const state = i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'todo';
    li.dataset.state = state;
    const mark = li.querySelector('.progress-mark');
    if (mark) mark.textContent = state === 'done' ? '✓' : state === 'active' ? '›' : '·';
  }
  const active = STAGES[currentIndex];
  if (status && active) status.textContent = `${active.label}…`;
}

function showError(err: unknown): void {
  // Unexpected failures still get reported with their real message: "something
  // went wrong" gives a visitor nothing to act on and hides bugs from us.
  console.error('[curbcut] scan failed', err);
  const message = err instanceof ScanError ? err.message : 'The scan could not be completed.';
  const hint =
    err instanceof ScanError
      ? err.hint
      : err instanceof Error
        ? err.message
        : undefined;
  if (errorBox) {
    errorBox.innerHTML = '';
    const strong = document.createElement('span');
    strong.textContent = message;
    errorBox.append(strong);
    if (hint) {
      errorBox.append(document.createElement('br'));
      const small = document.createElement('span');
      small.style.fontWeight = '400';
      small.textContent = hint;
      errorBox.append(small);
    }
    errorBox.hidden = false;
  }
  if (status) status.textContent = message;
  input?.setAttribute('aria-invalid', 'true');
  showStage('intro');

  if (err instanceof ScanError && err.proxyUnavailable) showProxyFallback();
}

/**
 * A browser cannot read another origin's HTML, so scanning by URL needs a
 * server-side fetch. On a static host there is none. Rather than leaving a dead
 * error, point at the two paths that need no server and are strictly better
 * anyway — they see the page as it really is, not an anonymous copy of it.
 */
function showProxyFallback(): void {
  if (document.getElementById('proxy-fallback')) return;
  const panel = document.createElement('div');
  panel.className = 'fallback';
  panel.id = 'proxy-fallback';
  panel.innerHTML = `
    <h3>Scan the real page instead</h3>
    <p>
      A browser will not let one website read another one's code, so scanning by
      address is limited to what an anonymous, logged-out visitor would see. Both
      of these audit the actual page, and both work right now:
    </p>
    <ul>
      <li><a href="${siteHref('/extension/')}"><strong>The browser extension</strong></a> —
        audits the page you are on, behind your login, after its JavaScript has run,
        and on sites whose security policy blocks every other tool.</li>
      <li><a href="${siteHref('/bookmarklet/')}"><strong>The bookmarklet</strong></a> —
        the same audit with nothing to install.</li>
    </ul>`;
  errorBox?.insertAdjacentElement('afterend', panel);
}

function clearError(): void {
  if (errorBox) {
    errorBox.hidden = true;
    errorBox.textContent = '';
  }
  document.getElementById('proxy-fallback')?.remove();
  input?.removeAttribute('aria-invalid');
}

const regimesFor = (): RegimeId[] => suggestRegimes(jurisdiction?.value ?? 'US');

function present(scan: BrowserScanResult, regimes: RegimeId[]): void {
  const report = buildReport({
    url: scan.url,
    title: scan.title,
    scannedAt: scan.scannedAt,
    engine: scan.engine,
    renderMode: scan.renderMode,
    findings: scan.findings,
    needsReview: scan.needsReview,
    regimes,
    testableCriteria: scan.testableCriteria,
    ...(scan.truncated
      ? { coverageWarning: 'This page was larger than the 3 MB fetch limit and was truncated, so the end of it was not scanned.' }
      : {}),
  });

  if (reportMount) reportMount.innerHTML = renderReport(report);
  showStage('report');

  if (status) {
    status.textContent = `Scan complete. Exposure Index ${report.exposure.index} of 100. ${report.headline}`;
  }

  const url = new URL(window.location.href);
  url.searchParams.set('url', scan.url);
  window.history.replaceState({}, '', url);

  document.title = `${report.host} — Exposure Index ${report.exposure.index} · Curbcut`;
  reportMount?.querySelector('h1')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

let running = false;

async function run(rawUrl: string): Promise<void> {
  if (running || !frame) return;
  running = true;
  clearError();
  showStage('progress');
  markStage('fetch');
  if (submit) submit.disabled = true;

  const regimes = regimesFor();

  try {
    const url = normaliseUrl(rawUrl);
    if (input) input.value = url;

    const scan = await scanUrlInBrowser(frame, url, {
      onStage: (stage) => {
        if (stage === 'fetch') markStage('fetch');
        if (stage === 'render') {
          markStage('render');
          setTimeout(() => running && markStage('audit'), 400);
        }
        if (stage === 'done') markStage('score');
      },
    });

    present(scan, regimes);
  } catch (err) {
    showError(err);
  } finally {
    running = false;
    if (submit) submit.disabled = false;
  }
}

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  void run(input?.value ?? '');
});

// A URL in the query string makes any scan shareable and re-runnable.
const initial = new URLSearchParams(window.location.search).get('url');
if (initial && input) {
  input.value = initial;
  void run(initial);
}

// Theme toggle. Respects the system setting until the visitor overrides it.
const themeToggle = $<HTMLButtonElement>('#theme-toggle');
const storedTheme = (() => {
  try {
    return localStorage.getItem('curbcut-theme');
  } catch {
    return null;
  }
})();
if (storedTheme === 'dark' || storedTheme === 'light') {
  document.documentElement.dataset.theme = storedTheme;
}
themeToggle?.addEventListener('click', () => {
  const isDark =
    document.documentElement.dataset.theme === 'dark' ||
    (!document.documentElement.dataset.theme &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  const next = isDark ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  themeToggle.setAttribute('aria-pressed', String(next === 'dark'));
  try {
    localStorage.setItem('curbcut-theme', next);
  } catch {
    /* private mode; the setting simply does not persist */
  }
});


/**
 * Fills in the hero countdowns. The dates are in the markup so the panel is
 * meaningful without JavaScript; this only turns them into day counts, which
 * would otherwise go stale the moment the page was built.
 */
for (const el of document.querySelectorAll<HTMLElement>('.clock-days[data-deadline]')) {
  const date = el.dataset.deadline;
  if (!date) continue;
  const days = daysUntil(date);
  if (days < 0) {
    el.textContent = 'Passed';
    el.classList.add('clock-past');
  } else {
    el.textContent = days.toLocaleString('en-US');
    el.classList.remove('clock-past');
    const unit = document.createElement('span');
    unit.className = 'visually-hidden';
    unit.textContent = days === 1 ? ' day remaining' : ' days remaining';
    el.append(unit);
  }
}
