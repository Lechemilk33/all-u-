/**
 * Renders a Report to HTML.
 *
 * Everything is escaped: the report reproduces markup from an arbitrary
 * third-party page as evidence, and that evidence must never become live DOM.
 */

import {
  BAND_LABEL,
  REGION_LABEL,
  criterionPath,
  type Exhibit,
  type Report,
  type RemediationItem,
  type UpcomingDeadline,
} from '@curbcut/core';
import { siteHref } from './config.js';

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

const money = (n: number): string => `$${n.toLocaleString('en-US')}`;

const dateLong = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

/* ------------------------------------------------------------------ gauge */

/**
 * A semicircular gauge. The value is also written as text and the band is
 * spelled out in words, because an index communicated only by arc length and
 * hue is exactly the failure this product exists to find.
 */
function gauge(index: number, band: Report['exposure']['band']): string {
  const R = 78;
  const CIRC = Math.PI * R;
  const filled = (index / 100) * CIRC;
  const label = BAND_LABEL[band];

  return `
<div class="gauge band-${band}">
  <svg viewBox="0 0 200 116" role="img" width="200" height="116"
       aria-label="Exposure Index ${index} out of 100. ${esc(label)}.">
    <path d="M 22 100 A ${R} ${R} 0 0 1 178 100" fill="none"
          stroke="var(--rule)" stroke-width="15" stroke-linecap="round"/>
    <path d="M 22 100 A ${R} ${R} 0 0 1 178 100" fill="none"
          stroke="currentColor" stroke-width="15" stroke-linecap="round"
          stroke-dasharray="${filled.toFixed(2)} ${CIRC.toFixed(2)}"/>
  </svg>
  <div class="gauge-value">${index}</div>
  <p class="gauge-band">${esc(label)}</p>
  <p class="gauge-caption">Exposure Index, 0–100</p>
</div>`;
}

/* -------------------------------------------------------------- deadlines */

function deadlineCard(d: UpcomingDeadline): string {
  const days = Math.abs(d.daysAway);
  return `
<div class="deadline${d.passed ? ' deadline-passed' : ''}">
  <p class="deadline-days">${d.passed ? 'Passed' : days.toLocaleString('en-US')}</p>
  <p class="deadline-label">
    <strong>${esc(d.regime.shortName)}</strong> — ${d.passed ? 'was due' : `${plural(days, 'day')} until`}
    ${esc(d.date)}.<br>${esc(d.appliesTo)}
  </p>
</div>`;
}

/* --------------------------------------------------------------- exhibits */

function exhibitCard(e: Exhibit): string {
  const criteria = e.finding.criteria.map((c) => `${c.num} ${c.name}`).join(', ') || 'Best practice';
  const blocking = { blocks: 'Blocks task completion', impairs: 'Impairs use', degrades: 'Degrades experience' }[
    e.finding.blocking
  ];

  return `
<article class="exhibit">
  <div class="exhibit-head">
    <span class="exhibit-num">EXHIBIT ${e.rank}</span>
    <h3 class="exhibit-title">${esc(e.finding.help)}</h3>
    <span class="tag">${esc(e.finding.ruleId)}</span>
  </div>
  <div class="exhibit-body">
    <p>${esc(e.why)}</p>
    <p class="visually-hidden">Failing markup:</p>
    <pre class="evidence" tabindex="0" role="region" aria-label="Failing markup"><code>${esc(e.node.html)}</code></pre>
    ${e.node.reason ? `<p><strong>Why it fails:</strong> ${esc(e.node.reason)}</p>` : ''}
    <div class="exhibit-meta">
      <span><strong>Where:</strong> ${esc(REGION_LABEL[e.node.region])}</span>
      <span><strong>Instances:</strong> ${e.instances}</span>
      <span><strong>Criterion:</strong> ${esc(criteria)}</span>
      <span><strong>Severity:</strong> ${blocking}</span>
      <span><strong>Share of exposure:</strong> ${Math.round(e.share * 100)}%</span>
    </div>
  </div>
</article>`;
}

/* ------------------------------------------------------------ remediation */

const EFFORT_LABEL = { minutes: 'Minutes', hours: 'Hours', days: 'Days' } as const;

function remediationRow(item: RemediationItem): string {
  const steps = item.recipe
    ? `<ol>${item.recipe.fix.map((f) => `<li>${esc(f)}</li>`).join('')}</ol>`
    : `<p>${esc(item.finding.help)}. <a href="${esc(item.finding.helpUrl)}" rel="noopener">Engine documentation for this rule</a>.</p>`;

  const fixLink = item.recipe
    ? `<p><a href="${esc(siteHref(`/fix/${item.ruleId}/`))}">Platform-specific instructions for ${esc(item.recipe.title.toLowerCase())}</a></p>`
    : '';

  return `
<details class="card" ${item.rank === 1 ? 'open' : ''}>
  <summary>
    <strong>${item.rank}. ${esc(item.title)}</strong>
    — ${plural(item.instances, 'element')}, ${EFFORT_LABEL[item.effort].toLowerCase()} of work
  </summary>
  <div style="padding-top:.9rem">
    ${item.recipe ? `<p>${esc(item.recipe.problem)}</p>` : ''}
    ${item.recipe ? `<p><strong>Who it affects.</strong> ${esc(item.recipe.impact)}</p>` : ''}
    <h4>How to fix it</h4>
    ${steps}
    ${
      item.recipe?.wrong && item.recipe?.right
        ? `<h4>Before</h4><pre tabindex="0"><code>${esc(item.recipe.wrong)}</code></pre>
           <h4>After</h4><pre tabindex="0"><code>${esc(item.recipe.right)}</code></pre>`
        : ''
    }
    ${
      item.recipe?.pitfalls.length
        ? `<h4>Common mistakes</h4><ul>${item.recipe.pitfalls.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`
        : ''
    }
    ${fixLink}
  </div>
</details>`;
}

/* ------------------------------------------------------------------ main */

export function renderReport(report: Report): string {
  const { exposure, coverage } = report;

  const liveDeadlines = report.deadlines.filter((d) => !d.passed).slice(0, 2);
  const passedDeadlines = report.deadlines.filter((d) => d.passed).slice(0, 2);
  const shownDeadlines = [...liveDeadlines, ...passedDeadlines];

  return `
<header class="report-head">
  <p class="eyebrow">Exposure report</p>
  <h1>${esc(report.host)}</h1>
  <p class="form-hint">
    <a href="${esc(report.url)}" rel="noopener nofollow">${esc(report.url)}</a><br>
    Scanned ${esc(dateLong(report.scannedAt))} · ${esc(report.engine)} ·
    ${esc(coverage.renderModeLabel)} · Graded against WCAG ${esc(report.standard.wcag)} Level ${esc(report.standard.level)}
  </p>
</header>

${
  report.coverageWarning
    ? `<div class="callout callout-warn"><h3>This scan is probably incomplete</h3><p>${esc(report.coverageWarning)}</p></div>`
    : ''
}

<section class="verdict" aria-labelledby="verdict-h">
  ${gauge(exposure.index, exposure.band)}
  <div>
    <h2 id="verdict-h" style="margin-top:0">${esc(report.headline)}</h2>
    <p>${esc(report.summary)}</p>
    <p><strong>${esc(exposure.verdict.statement)}</strong></p>
    ${
      exposure.verdict.failedCriteria.length
        ? `<p class="form-hint">Failing criteria: ${exposure.verdict.failedCriteria
            .map((c) => {
              const path = criterionPath(c);
              return path ? `<a href="${esc(siteHref(path))}">${esc(c)}</a>` : esc(c);
            })
            .join(', ')}</p>`
        : ''
    }
  </div>
</section>

${
  shownDeadlines.length
    ? `<section aria-labelledby="deadlines-h">
        <h2 id="deadlines-h">Deadlines that apply</h2>
        <div class="deadline-strip">${shownDeadlines.map(deadlineCard).join('')}</div>
      </section>`
    : ''
}

<section aria-labelledby="exhibits-h">
  <h2 id="exhibits-h">What a complaint would point at</h2>
  <p>
    These are the findings ranked by legal exposure rather than by count: how often the criterion
    is actually pleaded, whether the failure stops someone finishing a task, and where on the page
    it sits. Each one is reproduced with the markup that fails.
  </p>
  ${
    report.exhibits.length
      ? report.exhibits.map(exhibitCard).join('')
      : `<div class="callout"><p>No machine-detectable failures were found to rank. That is a good result, and it is
         not a clean bill of health — read the coverage note below.</p></div>`
  }
</section>

${
  report.remediation.length
    ? `<section aria-labelledby="fix-h">
        <h2 id="fix-h">Remediation plan</h2>
        <p>Ordered by exposure removed per hour of work. Fixing the first item removes
           ${Math.round((report.remediation[0]?.share ?? 0) * 100)}% of the measured exposure.</p>
        <div class="grid">${report.remediation.slice(0, 8).map(remediationRow).join('')}</div>
      </section>`
    : ''
}

<section aria-labelledby="coverage-h">
  <h2 id="coverage-h">What this scan did not test</h2>
  <p><strong>${esc(coverage.statement)}</strong></p>
  ${coverage.blindSpots
    .map(
      (b) => `<div class="callout callout-warn">
        <h3>${esc(b.title)}</h3>
        <p>${esc(b.detail)}</p>
        ${b.affectedRules.length ? `<p class="form-hint">Checks not run: ${b.affectedRules.map((r) => `<code>${esc(r)}</code>`).join(', ')}</p>` : ''}
      </div>`,
    )
    .join('')}
  ${
    report.needsReviewCount > 0
      ? `<p>${plural(report.needsReviewCount, 'further check')} returned an undecided result and need a person to look.
         Undecided is not the same as passing.</p>`
      : ''
  }
</section>

<section aria-labelledby="law-h">
  <h2 id="law-h">The law applied</h2>
  <div class="table-scroll" tabindex="0" role="region" aria-label="Regimes applied, scrollable">
  <table>
    <caption>Regimes selected for this report, with the standard each requires.</caption>
    <thead><tr><th scope="col">Regime</th><th scope="col">Applies to</th><th scope="col">Standard</th><th scope="col">How a claim starts</th></tr></thead>
    <tbody>
      ${report.regimes
        .map(
          (r) => `<tr>
            <th scope="row"><a href="${esc(siteHref(`/law/${r.id}/`))}">${esc(r.shortName)}</a><br>
              <span class="form-hint">${esc(r.jurisdiction)}</span></th>
            <td>${esc(r.appliesTo)}</td>
            <td>WCAG ${esc(r.standard.wcag)} ${esc(r.standard.level)}</td>
            <td>${esc(r.howClaimsStart)}</td>
          </tr>`,
        )
        .join('')}
    </tbody>
  </table>
  </div>
</section>

<section aria-labelledby="cost-h">
  <h2 id="cost-h">What the market charges</h2>
  <p>
    Published rates for what happens on either side of a complaint. These are market figures,
    not a prediction about this site, and Curbcut does not estimate the odds that anyone will act.
  </p>
  <div class="table-scroll" tabindex="0" role="region" aria-label="Market rates, scrollable">
  <table>
    <thead><tr><th scope="col">Item</th><th scope="col">Reported range</th></tr></thead>
    <tbody>
      ${Object.values(report.marketRates)
        .map(
          (r) => `<tr><th scope="row">${esc(r.label)}</th>
            <td>${esc(money(r.low))} – ${esc(money(r.high))}${'note' in r && r.note ? `<br><span class="form-hint">${esc(r.note)}</span>` : ''}</td></tr>`,
        )
        .join('')}
    </tbody>
  </table>
  </div>
</section>

<section aria-labelledby="sources-h">
  <h2 id="sources-h">Sources</h2>
  <ul>
    ${report.sources.map((s) => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.label)}</a></li>`).join('')}
  </ul>
</section>

<div class="callout callout-legal">
  <h3>Read this before quoting the number</h3>
  <p>${esc(report.disclaimer)}</p>
</div>`;
}
