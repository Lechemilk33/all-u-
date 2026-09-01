/**
 * The live-page auditor.
 *
 * Injected by the bookmarklet into whatever page the visitor is looking at, so
 * it runs against the real DOM — after the page's scripts have built the menus,
 * modals and validation messages that a fetched copy never contains.
 *
 * Constraints that shape this file:
 *  - It lands in someone else's page, so it must not collide with anything.
 *    The panel lives in a shadow root and every global is namespaced.
 *  - Nothing may leave the browser. There is no network call here that carries
 *    page content, which is the actual privacy guarantee rather than a promise.
 */

import {
  buildReport,
  machineTestableCriteria,
  ruleCriteriaFromAxe,
  suggestRegimes,
  toFinding,
  BAND_LABEL,
  REGION_LABEL,
  type Region,
} from '@curbcut/core';
import { regionOf, visibleLabelOf } from '@curbcut/scan';

const PANEL_ID = 'curbcut-audit-panel';

interface AxeNode { target: unknown[]; html: string; failureSummary?: string }
interface AxeResult {
  id: string; description: string; help: string; helpUrl: string;
  impact?: string | null; tags: string[]; nodes: AxeNode[];
}
interface AxeGlobal {
  run(ctx: Document, opts: unknown): Promise<{
    violations: AxeResult[]; incomplete: AxeResult[];
    testEngine?: { name: string; version: string };
  }>;
  getRules(): { ruleId: string; tags: string[] }[];
  version: string;
}

const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/**
 * Statically imported, not lazily: this file is built as one self-contained
 * bundle so the bookmarklet is a single request into a page whose own
 * Content-Security-Policy we do not control.
 */
function loadAxe(): AxeGlobal {
  const existing = (window as unknown as { axe?: AxeGlobal }).axe;
  if (existing?.run) return existing;
  const script = document.createElement('script');
  script.textContent = axeSource;
  document.documentElement.appendChild(script);
  script.remove();
  const axe = (window as unknown as { axe?: AxeGlobal }).axe;
  if (!axe) throw new Error('axe-core did not initialise on this page');
  return axe;
}

const PANEL_CSS = `
:host { all: initial; }
.panel {
  position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
  width: min(430px, calc(100vw - 32px)); max-height: min(78vh, 780px);
  display: flex; flex-direction: column;
  background: #fbfaf8; color: #14161a;
  font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  border: 1px solid #b3ada2; border-radius: 10px;
  box-shadow: 0 8px 40px -8px rgb(0 0 0 / .35);
}
.head { display:flex; align-items:center; gap:.6rem; padding:.75rem .9rem;
  border-bottom:1px solid #d6d2ca; }
.head h2 { margin:0; font-size:.95rem; font-weight:660; flex:1; }
.score { font-size:1.5rem; font-weight:700; letter-spacing:-.03em; }
.band { font-size:.72rem; font-weight:660; text-transform:uppercase; letter-spacing:.05em; }
.body { overflow-y:auto; padding:.9rem; }
.body p { margin:0 0 .7rem; }
.item { border:1px solid #d6d2ca; border-radius:7px; padding:.6rem .7rem; margin-bottom:.55rem;
  background:#fff; }
.item h3 { margin:0 0 .3rem; font-size:.88rem; font-weight:640; }
.item .meta { font-size:.76rem; color:#646b76; display:flex; gap:.7rem; flex-wrap:wrap; }
.item code { font-family: ui-monospace, Menlo, monospace; font-size:.74rem;
  background:#f2f0ec; padding:.05em .3em; border-radius:3px; }
.note { font-size:.78rem; color:#454b55; border-left:3px solid #85560a;
  background:#f2f0ec; padding:.5rem .65rem; border-radius:0 6px 6px 0; }
button { font:inherit; cursor:pointer; border-radius:6px; border:1px solid #b3ada2;
  background:#fff; color:#14161a; padding:.25rem .55rem; font-size:.8rem; }
button:focus-visible { outline:3px solid #1b4dd1; outline-offset:2px; }
a { color:#1b4dd1; }
.foot { border-top:1px solid #d6d2ca; padding:.6rem .9rem; font-size:.75rem; color:#646b76;
  display:flex; gap:.5rem; align-items:center; flex-wrap:wrap; }
@media (prefers-color-scheme: dark) {
  .panel { background:#101216; color:#f2f3f5; border-color:#454c58; }
  .head, .foot { border-color:#2e333c; }
  .item { background:#181b21; border-color:#2e333c; }
  .item code, .note { background:#22262e; }
  .item .meta, .foot { color:#949ba7; }
  .note { color:#bcc2cc; }
  button { background:#181b21; color:#f2f3f5; border-color:#454c58; }
  a { color:#8fb0ff; }
}`;

function mountPanel(): { root: ShadowRoot; close: () => void } {
  document.getElementById(PANEL_ID)?.remove();
  const host = document.createElement('div');
  host.id = PANEL_ID;
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = PANEL_CSS;
  root.appendChild(style);
  document.body.appendChild(host);
  return { root, close: () => host.remove() };
}

/**
 * How the caller supplies the engine. The bookmarklet injects it into the page;
 * the extension bundles it into its own isolated world, where the page's
 * Content-Security-Policy does not apply and injection is unnecessary.
 */
export type { AxeGlobal };

export type AxeProvider = () => AxeGlobal | Promise<AxeGlobal>;

export async function runAudit(getAxe: AxeProvider): Promise<void> {
  const { root, close } = mountPanel();

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Curbcut accessibility audit');
  panel.innerHTML = `<div class="head"><h2>Curbcut</h2></div><div class="body"><p>Auditing this page…</p></div>`;
  root.appendChild(panel);

  try {
    const axe = await getAxe();
    const results = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'] },
      resultTypes: ['violations', 'incomplete'],
      elementRef: false,
    });

    const enrich = (r: AxeResult) =>
      toFinding({
        id: r.id, description: r.description, help: r.help, helpUrl: r.helpUrl,
        impact: r.impact ?? null, tags: r.tags,
        nodes: r.nodes.map((n) => {
          const sel = n.target.flat(Infinity).filter((t): t is string => typeof t === 'string');
          let el: Element | null = null;
          try { el = sel.length ? document.querySelector(sel[sel.length - 1] as string) : null; } catch { el = null; }
          const region: Region = el ? regionOf(el, location.href) : 'unknown';
          const label = el ? visibleLabelOf(el) : undefined;
          return {
            target: sel, html: n.html,
            ...(n.failureSummary ? { failureSummary: n.failureSummary } : {}),
            region, ...(label ? { label } : {}),
          };
        }),
      });

    const report = buildReport({
      url: location.href,
      title: document.title,
      scannedAt: new Date().toISOString(),
      engine: results.testEngine ? `${results.testEngine.name} ${results.testEngine.version}` : `axe-core ${axe.version}`,
      renderMode: 'live-dom',
      findings: results.violations.map(enrich),
      needsReview: results.incomplete.map(enrich),
      regimes: suggestRegimes('US'),
      testableCriteria: machineTestableCriteria(ruleCriteriaFromAxe(axe.getRules()), 'live-dom'),
    });

    const shareUrl = `https://curbcut.dev/?url=${encodeURIComponent(location.href)}`;

    panel.innerHTML = `
<div class="head">
  <span class="score">${report.exposure.index}</span>
  <div style="flex:1">
    <h2>Exposure Index</h2>
    <span class="band">${esc(BAND_LABEL[report.exposure.band])}</span>
  </div>
  <button type="button" data-act="close" aria-label="Close the Curbcut panel">Close</button>
</div>
<div class="body">
  <p><strong>${esc(report.headline)}</strong></p>
  ${report.exhibits
    .map(
      (e) => `<div class="item">
        <h3>${e.rank}. ${esc(e.finding.help)}</h3>
        <p style="font-size:.83rem;margin:0 0 .4rem">${esc(e.why)}</p>
        <div class="meta">
          <span><code>${esc(e.finding.ruleId)}</code></span>
          <span>${esc(REGION_LABEL[e.node.region])}</span>
          <span>${e.instances} element${e.instances === 1 ? '' : 's'}</span>
          <span>${Math.round(e.share * 100)}% of exposure</span>
        </div>
      </div>`,
    )
    .join('') || '<p>No machine-detectable Level AA failures on this page.</p>'}
  <p class="note">${esc(report.coverage.statement)}</p>
</div>
<div class="foot">
  <button type="button" data-act="log">Log full detail to console</button>
  <a href="${esc(shareUrl)}" target="_blank" rel="noopener">Open full report</a>
</div>`;

    panel.querySelector('[data-act="close"]')?.addEventListener('click', close);
    panel.querySelector('[data-act="log"]')?.addEventListener('click', () => {
      console.groupCollapsed(`%cCurbcut — ${report.host} — Exposure Index ${report.exposure.index}`, 'font-weight:700');
      console.log(report.summary);
      console.table(
        report.remediation.map((m) => ({
          rank: m.rank, rule: m.ruleId, fix: m.title,
          elements: m.instances, effort: m.effort,
          share: `${Math.round(m.share * 100)}%`,
        })),
      );
      for (const e of report.exhibits) {
        console.groupCollapsed(`Exhibit ${e.rank}: ${e.finding.ruleId}`);
        console.log(e.why);
        console.log('Selector:', e.node.target);
        try {
          const el = document.querySelector(e.node.target);
          if (el) console.log('Element:', el);
        } catch { /* selector not resolvable from here */ }
        console.groupEnd();
      }
      console.log('Not legal advice.', report.disclaimer);
      console.groupEnd();
    });

    (panel.querySelector('[data-act="close"]') as HTMLElement | null)?.focus();
  } catch (err) {
    panel.innerHTML = `<div class="head"><h2>Curbcut</h2>
      <button type="button" data-act="close" aria-label="Close">Close</button></div>
      <div class="body"><p>The audit could not run on this page.</p>
      <p class="note">${esc(err instanceof Error ? err.message : String(err))}</p>
      <p style="font-size:.8rem">Some sites set a Content-Security-Policy that blocks injected
      scripts. On those, use the <a href="https://curbcut.dev/">web scanner</a> instead.</p></div>`;
    panel.querySelector('[data-act="close"]')?.addEventListener('click', close);
  }
}
