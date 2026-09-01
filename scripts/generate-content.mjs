/**
 * Builds the static reference pages.
 *
 * Everything here is generated from the same data the scanner grades against,
 * so a report that cites 1.4.3 links to a page describing exactly the criterion
 * the engine applied. There is no second copy of the facts to drift.
 */

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { page, esc, SITE, makeScrollableRegionsFocusable, href } from './layout.mjs';
import { BASE } from './base.mjs';

import {
  SUCCESS_CRITERIA, criteriaAtLevel, principleName, PRINCIPLES,
  REGIMES, deadlinesFor, daysUntil,
  CRITERION_RISK, riskForCriterion, criterionSlug, BENCHMARK_2026, MARKET_RATES, SOURCES,
  RECIPES, PLATFORMS, recipesForPlatform, recipeFor,
} from '../packages/core/dist/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'packages', 'web', 'pages');
const NOW = new Date();

const written = [];

async function emit(path, html) {
  const file = join(OUT, path.replace(/^\//, ''), 'index.html');
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, makeScrollableRegionsFocusable(html), 'utf8');
  written.push(path);
}

const list = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const olist = (items) => `<ol>${items.map((i) => `<li>${i}</li>`).join('')}</ol>`;
const money = (n) => `$${n.toLocaleString('en-US')}`;

/** Five bars, plus the number in text — never colour alone. */
function riskBar(salience) {
  const bars = Array.from({ length: 5 }, (_, i) => `<span data-on="${i < salience}"></span>`).join('');
  return `<span class="risk-bar band-${salience >= 4 ? 'severe' : salience >= 2 ? 'elevated' : 'low'}" aria-hidden="true">${bars}</span>
    <span class="visually-hidden">Litigation salience ${salience} of 5</span>`;
}

/* ------------------------------------------------------------ WCAG pages */

const scPath = (sc) => `/wcag/${criterionSlug(sc)}/`;

const RULES_BY_SC = (() => {
  const map = new Map();
  for (const r of RECIPES) {
    const sc = {
      'image-alt': '1.1.1', 'color-contrast': '1.4.3', label: '1.3.1', 'link-name': '2.4.4',
      'button-name': '4.1.2', 'html-has-lang': '3.1.1', 'aria-required-attr': '4.1.2',
      bypass: '2.4.1', 'document-title': '2.4.2', 'aria-input-field-name': '4.1.2',
      'frame-title': '4.1.2', 'meta-viewport': '1.4.4',
    }[r.ruleId];
    if (!sc) continue;
    if (!map.has(sc)) map.set(sc, []);
    map.get(sc).push(r);
  }
  return map;
})();

async function wcagPages() {
  const aa = criteriaAtLevel('AA');

  for (const sc of SUCCESS_CRITERIA) {
    const risk = riskForCriterion(sc.num);
    const requiredBy = REGIMES.filter((r) => {
      const rank = { A: 1, AA: 2, AAA: 3 };
      return rank[sc.level] <= rank[r.standard.level] && !sc.obsolete;
    });
    const recipes = RULES_BY_SC.get(sc.num) ?? [];
    const benchmark = {
      '1.4.3': ['low-contrast', 'Low contrast'],
      '1.1.1': ['missing-alt-text', 'Missing alternative text'],
      '1.3.1': ['missing-form-label', 'Missing form labels'],
      '2.4.4': ['empty-link', 'Empty links'],
      '4.1.2': ['empty-button', 'Empty buttons'],
      '3.1.1': ['missing-document-language', 'Missing document language'],
    }[sc.num];

    const prevalence = benchmark
      ? `<div class="callout">
           <h3>How common is it?</h3>
           <p>
             ${esc(benchmark[1])} appeared on
             <strong>${(BENCHMARK_2026.categoryPrevalence[benchmark[0]] * 100).toFixed(1)}%</strong>
             of the one million home pages scanned in the
             <a href="${BENCHMARK_2026.url}" rel="noopener">${esc(BENCHMARK_2026.label)}</a>.
             Six failure categories account for about 96% of all errors found, and this is one of them.
           </p>
         </div>`
      : '';

    const body = `
<h1>WCAG ${esc(sc.num)} — ${esc(sc.name)}</h1>
<div class="meta-row">
  <span class="tag tag-a">Level ${esc(sc.level)}</span>
  <span class="tag">${esc(principleName(sc.principle))}</span>
  <span class="tag">Since WCAG ${esc(sc.since)}</span>
  ${sc.obsolete ? '<span class="tag">Obsolete in WCAG 2.2</span>' : ''}
</div>

${
  sc.obsolete
    ? `<div class="callout callout-warn">
         <h3>This criterion no longer applies</h3>
         <p>WCAG 2.2 marks ${esc(sc.num)} obsolete. Failures of it are not conformance failures,
            and Curbcut does not count them against your score. Tools that still report it are
            inflating your error count.</p>
       </div>`
    : ''
}

<h2>What it requires</h2>
<p>
  ${esc(sc.name)} is a Level ${esc(sc.level)} success criterion under the
  ${esc(principleName(sc.principle))} principle. The normative text and the
  techniques that satisfy it are published by the W3C —
  <a href="${esc(sc.url)}" rel="noopener">read the Understanding document for ${esc(sc.num)}</a>.
</p>

<h2>What a complaint says about it</h2>
<p>${esc(risk.allegation)}</p>
<div class="meta-row">
  <span>Litigation salience: ${riskBar(risk.salience)} <strong>${risk.salience} of 5</strong></span>
</div>
<p class="form-hint">
  Salience is how often this criterion is actually named in accessibility complaints and demand
  letters — not how serious the barrier is. ${
    risk.salience >= 4
      ? 'This one appears in a large share of filed complaints.'
      : risk.salience >= 2
        ? 'This one appears in complaints, but rarely leads them.'
        : 'This one is very rarely pleaded, which is not a reason to leave it broken.'
  }
  Severity: this failure <strong>${
    risk.blocking === 'blocks'
      ? 'can stop a user completing a task'
      : risk.blocking === 'impairs'
        ? 'impairs use without necessarily blocking it'
        : 'degrades the experience'
  }</strong>.
</p>

${prevalence}

${
  requiredBy.length
    ? `<h2>Who is required to meet it</h2>
       <div class="table-scroll"><table>
         <caption>Regimes whose conformance target includes Level ${esc(sc.level)}.</caption>
         <thead><tr><th scope="col">Regime</th><th scope="col">Jurisdiction</th><th scope="col">Requires</th></tr></thead>
         <tbody>${requiredBy
           .map(
             (r) => `<tr><th scope="row"><a href="${href(`/law/${esc(r.id)}/`)}">${esc(r.shortName)}</a></th>
               <td>${esc(r.jurisdiction)}</td><td>WCAG ${esc(r.standard.wcag)} ${esc(r.standard.level)}</td></tr>`,
           )
           .join('')}</tbody>
       </table></div>`
    : ''
}

${
  recipes.length
    ? `<h2>How to fix failures of ${esc(sc.num)}</h2>
       ${recipes
         .map(
           (r) => `<h3>${esc(r.title)}</h3>
             <p>${esc(r.problem)}</p>
             ${olist(r.fix.map(esc))}
             ${
               r.wrong && r.right
                 ? `<h4>Before</h4><pre><code>${esc(r.wrong)}</code></pre>
                    <h4>After</h4><pre><code>${esc(r.right)}</code></pre>`
                 : ''
             }
             <p><a href="${href(`/fix/${esc(r.ruleId)}/`)}">Platform-specific instructions →</a></p>`,
         )
         .join('')}`
    : ''
}

<h2>Can a scanner detect it?</h2>
<p>
  ${
    RULES_BY_SC.has(sc.num)
      ? 'Yes, in part. Automated rules can find the mechanical failures of this criterion — a missing attribute, an insufficient ratio. They cannot judge whether what is there is correct or meaningful, so a passing result is a floor and not a conclusion.'
      : 'Not reliably. No automated rule decides this criterion on its own; it needs a person, usually with assistive technology. A scanner reporting no failures here has not tested it.'
  }
  <a href="${href(`/method/`)}">How Curbcut reports what it did not test →</a>
</p>`;

    await emit(
      scPath(sc),
      page({
        title: `WCAG ${sc.num} ${sc.name} (Level ${sc.level}) — what it requires and how to fix it | Curbcut`,
        description: `WCAG ${sc.num} ${sc.name}, Level ${sc.level}: what the criterion requires, how often it is pleaded in accessibility complaints, which laws require it, and how to fix failures.`,
        path: scPath(sc),
        crumbs: [{ href: '/wcag/', label: 'WCAG 2.2' }, { href: scPath(sc), label: `${sc.num} ${sc.name}` }],
        body,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'TechArticle',
          headline: `WCAG ${sc.num} — ${sc.name}`,
          description: `Level ${sc.level} success criterion under ${principleName(sc.principle)}.`,
          url: `${SITE.origin}${scPath(sc)}`,
        },
      }),
    );
  }

  // Index
  const byPrinciple = PRINCIPLES.map((p) => {
    const rows = SUCCESS_CRITERIA.filter((sc) => sc.principle === p.id);
    return `
<h2 id="p${p.id}">${p.id}. ${esc(p.name)}</h2>
<p>${esc(p.plain)}</p>
<ul class="index-list">
  ${rows
    .map((sc) => {
      const risk = riskForCriterion(sc.num);
      return `<li>
        <span class="index-num">${esc(sc.num)}</span>
        <a href="${href(scPath(sc))}">${esc(sc.name)}</a>
        <span class="tag${sc.level === 'AAA' ? '' : ' tag-a'}">${sc.obsolete ? 'Obsolete' : `Level ${esc(sc.level)}`}${risk.salience >= 4 ? ' · often pleaded' : ''}</span>
      </li>`;
    })
    .join('')}
</ul>`;
  }).join('');

  await emit(
    '/wcag/',
    page({
      title: 'All 87 WCAG 2.2 success criteria, with litigation salience | Curbcut',
      description: `Every WCAG 2.2 success criterion by level and principle, with how often each is actually named in accessibility complaints and which laws require it. ${criteriaAtLevel('AA').length} criteria make up Level AA.`,
      path: '/wcag/',
      crumbs: [{ href: '/wcag/', label: 'WCAG 2.2' }],
      body: `
<h1>WCAG 2.2, all ${SUCCESS_CRITERIA.length} success criteria</h1>
<p class="lede">
  Conformance at Level AA — the target of every regime on this site — means meeting
  <strong>${aa.length} criteria</strong>: ${criteriaAtLevel('A').length} at Level A and
  ${aa.length - criteriaAtLevel('A').length} more at AA. WCAG 2.2 added nine criteria to 2.1
  and marked one, 4.1.1 Parsing, obsolete.
</p>
<div class="callout">
  <p>
    Each criterion below is annotated with its <strong>litigation salience</strong>: how often
    it is actually named in accessibility complaints, as distinct from how serious the barrier
    is. The two are not the same, and confusing them is how remediation budgets get spent in the
    wrong order. <a href="${href(`/method/`)}">How the model works →</a>
  </p>
</div>
${byPrinciple}`,
    }),
  );
}

/* ------------------------------------------------------------- law pages */

async function lawPages() {
  for (const r of REGIMES) {
    const deadlines = deadlinesFor([r.id], NOW);
    const body = `
<h1>${esc(r.name)}</h1>
<div class="meta-row">
  <span class="tag tag-a">${esc(r.jurisdiction)}</span>
  <span class="tag">WCAG ${esc(r.standard.wcag)} Level ${esc(r.standard.level)}</span>
  <span class="tag">${esc({ 'private-litigation': 'Private litigation', regulator: 'Regulator', procurement: 'Procurement', mixed: 'Regulator and litigation' }[r.enforcement])}</span>
</div>

<h2>Who it applies to</h2>
<p>${esc(r.appliesTo)}</p>

<h2>What standard it requires</h2>
<p>
  <strong>WCAG ${esc(r.standard.wcag)} Level ${esc(r.standard.level)}.</strong>
  ${r.standard.note ? esc(r.standard.note) : ''}
</p>

${
  deadlines.length
    ? `<h2>Dates</h2>
       <div class="deadline-strip">
       ${deadlines
         .map(
           (d) => `<div class="deadline${d.passed ? ' deadline-passed' : ''}">
             <p class="deadline-days">${d.passed ? 'Passed' : Math.abs(d.daysAway).toLocaleString('en-US')}</p>
             <p class="deadline-label"><strong>${esc(d.label)}</strong> — ${esc(d.date)}.<br>${esc(d.appliesTo)}</p>
           </div>`,
         )
         .join('')}
       </div>
       <p class="form-hint">Day counts are calculated when the page is opened, not when it was written.</p>`
    : ''
}

<h2>How a claim actually starts</h2>
<p>${esc(r.howClaimsStart)}</p>

<h2>What it costs to be wrong</h2>
<p>${esc(r.exposure)}</p>

<h2>Source</h2>
<p><a href="${esc(r.citation.url)}" rel="noopener">${esc(r.citation.label)}</a> — checked ${esc(r.verifiedOn)}.</p>

<div class="callout callout-legal">
  <h3>This is reference information, not advice</h3>
  <p>
    Curbcut summarises published law so you can check it against the source. It is not legal
    advice, and whether any regime applies to a particular organisation is a question for a
    lawyer who knows the facts.
  </p>
</div>

<h2>Other regimes</h2>
<ul class="index-list">
  ${REGIMES.filter((o) => o.id !== r.id)
    .map(
      (o) => `<li><span class="index-num">${esc(o.territories.join(', '))}</span>
        <a href="${href(`/law/${esc(o.id)}/`)}">${esc(o.name)}</a>
        <span class="tag">WCAG ${esc(o.standard.wcag)} ${esc(o.standard.level)}</span></li>`,
    )
    .join('')}
</ul>`;

    await emit(
      `/law/${r.id}/`,
      page({
        title: `${r.shortName}: who it covers, what it requires, and what it costs | Curbcut`,
        description: `${r.name} — who is covered, the WCAG standard it requires, how a claim starts, the penalties, and the deadlines. With a citation to the source text.`,
        path: `/law/${r.id}/`,
        crumbs: [{ href: '/law/', label: 'The law' }, { href: `/law/${r.id}/`, label: r.shortName }],
        body,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Legislation',
          name: r.name,
          jurisdiction: r.jurisdiction,
          url: `${SITE.origin}/law/${r.id}/`,
        },
      }),
    );
  }

  await emit(
    '/law/',
    page({
      title: 'Web accessibility law by jurisdiction: ADA, EAA, Section 508, AODA | Curbcut',
      description: 'The eight regimes that make web accessibility a legal obligation — who each covers, what standard it requires, how claims start, and what non-compliance costs.',
      path: '/law/',
      crumbs: [{ href: '/law/', label: 'The law' }],
      body: `
<h1>The law that makes this a legal obligation</h1>
<p class="lede">
  Eight regimes decide whether an accessibility failure on your site is a defect or a liability.
  They differ in who they cover, what standard they require, and — most importantly — how a
  claim against you actually begins.
</p>

<div class="table-scroll"><table>
  <caption>Every regime Curbcut grades against.</caption>
  <thead><tr>
    <th scope="col">Regime</th><th scope="col">Covers</th>
    <th scope="col">Requires</th><th scope="col">Enforced by</th>
  </tr></thead>
  <tbody>
  ${REGIMES.map(
    (r) => `<tr>
      <th scope="row"><a href="${href(`/law/${esc(r.id)}/`)}">${esc(r.shortName)}</a><br>
        <span class="form-hint">${esc(r.jurisdiction)}</span></th>
      <td>${esc(r.appliesTo.split('.')[0])}.</td>
      <td>WCAG ${esc(r.standard.wcag)} ${esc(r.standard.level)}</td>
      <td>${esc({ 'private-litigation': 'Private lawsuits', regulator: 'A regulator', procurement: 'Procurement review', mixed: 'Both' }[r.enforcement])}</td>
    </tr>`,
  ).join('')}
  </tbody>
</table></div>

<h2>The pattern worth noticing</h2>
<p>
  Every one of these regimes lands on the same technical target: WCAG Level AA. They disagree
  about the version — 2.0 for Section 508 and AODA, 2.1 almost everywhere else — but the
  criteria added between versions are a small minority of the work. Building to
  <strong>WCAG 2.2 Level AA</strong> satisfies all eight, which is why Curbcut grades against it
  regardless of which regime you select.
</p>

<h2>What differs is how you find out</h2>
<p>
  Under ADA Title III, you find out when a demand letter arrives. Under the EAA, you find out
  when a market surveillance authority responds to a consumer complaint. Under Section 508, you
  find out when you lose a bid. The technical work is nearly the same; the warning you get is
  not.
</p>

<p><a href="${href(`/deadlines/`)}">See which deadlines are still running →</a></p>`,
    }),
  );
}

/* ------------------------------------------------------------- fix pages */

async function fixPages() {
  for (const r of RECIPES) {
    const platforms = PLATFORMS.filter((p) => r.platformNotes[p.id]);
    const body = `
<h1>${esc(r.title)}</h1>
<div class="meta-row">
  <span class="tag tag-a">${esc(r.ruleId)}</span>
  <span class="tag">${esc({ minutes: 'Minutes to fix', hours: 'Hours to fix', days: 'Days to fix' }[r.effort])}</span>
</div>

<h2>What is wrong</h2>
<p>${esc(r.problem)}</p>

<h2>Who it affects</h2>
<p>${esc(r.impact)}</p>

<h2>How to fix it</h2>
${olist(r.fix.map(esc))}

${
  r.wrong && r.right
    ? `<h3>Before</h3><pre><code>${esc(r.wrong)}</code></pre>
       <h3>After</h3><pre><code>${esc(r.right)}</code></pre>`
    : ''
}

<h2>Mistakes that create a second failure</h2>
${list(r.pitfalls.map(esc))}

<h2>On your platform</h2>
${platforms
  .map(
    (p) => `<h3 id="${esc(p.id)}">${esc(p.name)}</h3>
      <p>${esc(r.platformNotes[p.id])}</p>
      <p class="form-hint">Where to make the change: ${esc(p.editSurface)}.</p>`,
  )
  .join('')}

<h2>Other fixes</h2>
<ul class="index-list">
  ${RECIPES.filter((o) => o.ruleId !== r.ruleId)
    .slice(0, 8)
    .map(
      (o) => `<li><span class="index-num">${esc(o.ruleId.slice(0, 12))}</span>
        <a href="${href(`/fix/${esc(o.ruleId)}/`)}">${esc(o.title)}</a>
        <span class="tag">${esc(o.effort)}</span></li>`,
    )
    .join('')}
</ul>`;

    await emit(
      `/fix/${r.ruleId}/`,
      page({
        title: `${r.title}: how to fix it on any platform | Curbcut`,
        description: `${r.problem} How to fix it, what not to do, and platform-specific instructions for ${platforms.map((p) => p.name).join(', ')}.`,
        path: `/fix/${r.ruleId}/`,
        crumbs: [{ href: '/fix/', label: 'Fix guides' }, { href: `/fix/${r.ruleId}/`, label: r.title }],
        body,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'HowTo',
          name: r.title,
          description: r.problem,
          step: r.fix.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s })),
        },
      }),
    );
  }

  for (const p of PLATFORMS) {
    const recipes = recipesForPlatform(p.id);
    if (recipes.length === 0) continue;
    const body = `
<h1>Fixing accessibility failures on ${esc(p.name)}</h1>
<p class="lede">
  The ${recipes.length} failures below are the ones an automated scan finds most often, with the
  ${esc(p.name)} specifics for each — where the setting lives, which defaults cause the problem,
  and what breaks when you fix it the obvious way.
</p>
<p class="form-hint">Where you make these changes: ${esc(p.editSurface)}.</p>

${recipes
  .map(
    (r) => `
<h2 id="${esc(r.ruleId)}">${esc(r.title)}</h2>
<p>${esc(r.problem)}</p>
<div class="callout">
  <h3>On ${esc(p.name)}</h3>
  <p>${esc(r.platformNotes[p.id])}</p>
</div>
${
  r.wrong && r.right
    ? `<pre><code>${esc(r.right)}</code></pre>`
    : ''
}
<p><a href="${href(`/fix/${esc(r.ruleId)}/`)}">Full guide to ${esc(r.title.toLowerCase())} →</a></p>`,
  )
  .join('')}`;

    await emit(
      `/fix/${p.id}/`,
      page({
        title: `${p.name} accessibility fixes: the ${recipes.length} failures scanners find most | Curbcut`,
        description: `Platform-specific instructions for fixing the most common WCAG failures on ${p.name} — where each setting lives and which defaults cause the problem.`,
        path: `/fix/${p.id}/`,
        crumbs: [{ href: '/fix/', label: 'Fix guides' }, { href: `/fix/${p.id}/`, label: p.name }],
        body,
      }),
    );
  }

  await emit(
    '/fix/',
    page({
      title: 'Accessibility fix guides by failure and by platform | Curbcut',
      description: 'How to fix the WCAG failures automated scanners find most often, with platform-specific instructions for Shopify, WordPress, Webflow, Squarespace, Wix, React and Drupal.',
      path: '/fix/',
      crumbs: [{ href: '/fix/', label: 'Fix guides' }],
      body: `
<h1>Fix guides</h1>
<p class="lede">
  Six failure categories account for about 96% of all errors found across the top million home
  pages. They are not obscure edge cases — they are the basics, and they have topped the list
  for seven consecutive years.
</p>

<h2>By failure</h2>
<ul class="index-list">
  ${RECIPES.map(
    (r) => `<li><span class="index-num">${esc({ minutes: 'mins', hours: 'hrs', days: 'days' }[r.effort])}</span>
      <a href="${href(`/fix/${esc(r.ruleId)}/`)}">${esc(r.title)}</a>
      <span class="tag">${esc(r.ruleId)}</span></li>`,
  ).join('')}
</ul>

<h2>By platform</h2>
<ul class="index-list">
  ${PLATFORMS.filter((p) => recipesForPlatform(p.id).length > 0)
    .map(
      (p) => `<li><span class="index-num">${recipesForPlatform(p.id).length}</span>
        <a href="${href(`/fix/${esc(p.id)}/`)}">${esc(p.name)}</a>
        <span class="tag">guides</span></li>`,
    )
    .join('')}
</ul>

<h2>The six that matter most</h2>
<div class="table-scroll"><table>
  <caption>Share of home pages exhibiting each category — ${esc(BENCHMARK_2026.label)}.</caption>
  <thead><tr><th scope="col">Failure</th><th scope="col">Share of home pages</th></tr></thead>
  <tbody>
  ${Object.entries(BENCHMARK_2026.categoryPrevalence)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([k, v]) => `<tr><th scope="row">${esc(k.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()))}</th>
        <td>${(v * 100).toFixed(1)}%</td></tr>`,
    )
    .join('')}
  </tbody>
</table></div>`,
    }),
  );
}

/* --------------------------------------------------------- other pages */

async function deadlinePage() {
  const all = deadlinesFor(REGIMES.map((r) => r.id), NOW);
  const live = all.filter((d) => !d.passed);
  const passed = all.filter((d) => d.passed);

  await emit(
    '/deadlines/',
    page({
      title: 'Web accessibility compliance deadlines, and who each one covers | Curbcut',
      description: 'Every statutory web accessibility deadline still running — ADA Title II, the European Accessibility Act, AODA — with who each covers and how long is left.',
      path: '/deadlines/',
      crumbs: [{ href: '/deadlines/', label: 'Deadlines' }],
      body: `
<h1>Deadlines</h1>
<p class="lede">
  Most accessibility obligations have no deadline: they are simply in force, and you discover
  that when a complaint arrives. A few have hard dates written into a rule, and those dates
  are the ones budgets get approved against.
</p>

<h2>Still running</h2>
${
  live.length
    ? `<div class="deadline-strip">${live
        .map(
          (d) => `<div class="deadline">
            <p class="deadline-days"><span data-deadline="${esc(d.date)}">${Math.abs(d.daysAway).toLocaleString('en-US')}</span></p>
            <p class="deadline-label"><strong><a href="${href(`/law/${esc(d.regime.id)}/`)}">${esc(d.regime.shortName)}</a></strong>
              — ${esc(d.label)}, ${esc(d.date)}.<br>${esc(d.appliesTo)}</p>
          </div>`,
        )
        .join('')}</div>`
    : '<p>No dated deadlines remain in the future across the regimes tracked here.</p>'
}

<h2>Already in force</h2>
<div class="deadline-strip">${passed
  .map(
    (d) => `<div class="deadline deadline-passed">
      <p class="deadline-days">Passed</p>
      <p class="deadline-label"><strong><a href="${href(`/law/${esc(d.regime.id)}/`)}">${esc(d.regime.shortName)}</a></strong>
        — was due ${esc(d.date)}.<br>${esc(d.appliesTo)}</p>
    </div>`,
  )
  .join('')}</div>

<h2>What "already in force" means in practice</h2>
<p>
  A passed deadline is not a closed matter. It means the obligation is live now and the grace
  period is over — the position an enforcement action starts from, rather than one it has to
  argue its way to. For ADA Title II, entities that missed 24 April 2026 are non-compliant
  today, and plaintiffs have begun moving into public-entity claims accordingly.
</p>

<h2>The regimes with no date at all</h2>
<p>
  ADA Title III — the one that produces the most litigation by a wide margin — has no deadline
  and no codified technical standard. There is nothing to count down to. Roughly 8,667 ADA
  lawsuits were filed in 2025 with more than 5,000 targeting websites, and e-commerce drew about
  70% of them. The absence of a date is not the absence of urgency.
</p>

<p><a href="${href(`/law/`)}">Compare all eight regimes →</a></p>`,
    }),
  );
}

async function methodPage() {
  await emit(
    '/method/',
    page({
      title: 'How the Exposure Index works, and what it deliberately cannot tell you | Curbcut',
      description: 'The scoring model behind Curbcut: litigation salience, blocking severity, page region and volume — plus an explicit account of what automated testing cannot decide.',
      path: '/method/',
      crumbs: [{ href: '/method/', label: 'Method' }],
      body: `
<h1>How the score works</h1>
<p class="lede">
  Curbcut produces two numbers and they mean different things. The <strong>verdict</strong> is a
  straight conformance test: does the page fail any WCAG criterion at the target level? The
  <strong>Exposure Index</strong> is a triage tool: of the failures present, which ones carry
  legal risk and in what order should they be fixed?
</p>

<h2>Why an error count is not a risk measure</h2>
<p>
  Ten missing labels in a checkout form and ten low-contrast captions in a footer produce the
  same error count and wildly different outcomes. Any tool that reports only a total is asking
  you to do the triage yourself, from a list sorted by nothing in particular.
</p>

<h2>The four factors</h2>
<div class="table-scroll"><table>
  <caption>Every finding is weighted by all four.</caption>
  <thead><tr><th scope="col">Factor</th><th scope="col">What it captures</th></tr></thead>
  <tbody>
    <tr><th scope="row">Litigation salience</th>
      <td>How often the criterion is actually named in complaints and demand letters. A handful lead almost every complaint — missing alternative text above all. Most are never pleaded at all.</td></tr>
    <tr><th scope="row">Blocking severity</th>
      <td>Whether the failure stops a user finishing a task, merely impairs use, or degrades the experience. This is the fact pattern that decides cases.</td></tr>
    <tr><th scope="row">Page region</th>
      <td>Where the failing element sits. Checkout carries the most weight, then sign-in, then any other form, then navigation and body content. A footer carries the least.</td></tr>
    <tr><th scope="row">Volume</th>
      <td>How many elements fail, with sharply diminishing returns. A hundred identical contrast errors from one bad colour token is one afternoon of work, not a hundred times the risk.</td></tr>
  </tbody>
</table></div>

<p>
  The weighted total is mapped onto 0–100 through a curve that flattens at the top, so the gap
  between a bad site and a catastrophic one does not swamp the gap between a clean site and a
  bad one. It is calibrated against the median failure profile in the
  <a href="${BENCHMARK_2026.url}" rel="noopener">${esc(BENCHMARK_2026.label)}</a> — about
  ${BENCHMARK_2026.meanErrorsPerPage} errors per page, mostly contrast and missing alt text —
  which lands in the mid-50s. That is the reference point for every score you see.
</p>

<h2>What the index is not</h2>
<p>
  It is not a probability that you will be sued, and Curbcut does not estimate one. Whether
  anyone acts depends on your sector, your revenue, your jurisdiction and who happens to visit
  — none of which a page scan can see. The index ranks <em>your own findings against each
  other</em>. That is a genuinely useful thing and it is the only thing it does.
</p>

<h2>What automated testing cannot decide</h2>
<p>
  Automation reaches roughly a third of the WCAG success criteria. It can establish that an
  image has alt text; it cannot establish that the alt text is right. It can find a heading; it
  cannot tell whether the heading describes what follows. Every Curbcut report states which
  checks did not run, in the same type size as the score.
</p>
<div class="callout callout-warn">
  <h3>Why we are insistent about this</h3>
  <p>
    In 2025 the US Federal Trade Commission fined an accessibility overlay vendor $1 million over
    claims that its automated product delivered compliance. In the first half of that same year,
    22.6% of web accessibility lawsuits targeted sites that already had an overlay installed. The
    market is full of numbers designed to make buyers feel finished. A scan that flatters you is
    worth less than nothing, because it is the input to a decision to stop working.
  </p>
</div>

<h2>Render modes</h2>
<p>
  How the page is obtained changes what can be tested, so the mode travels with the result:
</p>
${list([
  '<strong>Static HTML</strong> — the markup a server sent, with no layout. Colour and size cannot be computed at all, so contrast is not tested. Any tool reporting a clean contrast result from markup alone has not tested it.',
  '<strong>Rendered HTML</strong> — the same markup with its real stylesheets and layout applied. Contrast becomes measurable. Anything the page&rsquo;s own scripts would have built is still missing.',
  '<strong>Live page</strong> — the page exactly as a visitor receives it, including menus, modals, cart drawers and validation messages. This is what the extension and the bookmarklet test, and it is the only complete picture.',
])}

<h2>Where your data goes</h2>
<p>
  Nowhere. The analysis runs inside your own browser: the page is never uploaded, the results
  are never stored, and there is no account to create. With the extension or the bookmarklet,
  no part of the page you are auditing leaves your machine at all.
</p>

<h2>Sources</h2>
${list(SOURCES.map((s) => `<a href="${esc(s.url)}" rel="noopener">${esc(s.label)}</a>`))}

<h2>What the market charges</h2>
<div class="table-scroll"><table>
  <thead><tr><th scope="col">Item</th><th scope="col">Reported range</th></tr></thead>
  <tbody>
  ${Object.values(MARKET_RATES)
    .map(
      (r) => `<tr><th scope="row">${esc(r.label)}</th><td>${esc(money(r.low))} – ${esc(money(r.high))}${
        r.note ? `<br><span class="form-hint">${esc(r.note)}</span>` : ''
      }</td></tr>`,
    )
    .join('')}
  </tbody>
</table></div>`,
    }),
  );
}

async function extensionPage() {
  await emit(
    '/extension/',
    page({
      title: 'The Curbcut browser extension — audit any page, including behind a login | Curbcut',
      description: 'A Chrome extension that audits the page you are on against WCAG 2.2 and ranks failures by legal exposure. Works on sites whose Content-Security-Policy blocks other tools. Nothing leaves your browser.',
      path: '/extension/',
      crumbs: [{ href: '/extension/', label: 'Extension' }],
      body: `
<h1>The browser extension</h1>
<p class="lede">
  One click audits the page in front of you — in its real state, after its own
  JavaScript has run, behind whatever login you are already signed in to. Nothing
  is fetched, nothing is uploaded, and no server is involved at any point.
</p>

<div class="callout">
  <h2 style="font-size:1rem;margin-bottom:.35rem">Install</h2>
  <ol>
    <li><a href="${href('/curbcut-extension.zip')}" download>Download the extension</a> and unzip it.</li>
    <li>Open <code>chrome://extensions</code> and turn on <strong>Developer mode</strong>, top right.</li>
    <li>Click <strong>Load unpacked</strong> and select the unzipped folder.</li>
    <li>Open any page and click the Curbcut icon, or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>A</kbd>.</li>
  </ol>
  <p class="form-hint">
    Works in Chrome, Edge, Brave, Arc and any other Chromium browser.
  </p>
</div>

<h2>Why an extension rather than a web page</h2>
<p>
  A web page cannot read another site's HTML — browsers forbid it — so every
  online scanner has to route your URL through a server it controls. That server
  sees an anonymous, logged-out, unscripted copy of your site, which is not the
  site your customers use.
</p>
<p>An extension has none of those limits:</p>
${list([
  '<strong>It sees the real page.</strong> Menus, modals, cart drawers, validation messages and anything else built at runtime are present to be tested. On a client-rendered site, a fetched copy is an empty shell.',
  '<strong>It works behind a login.</strong> Account areas, admin panels, members&rsquo; portals, and a checkout with items actually in it — which is where the failures that cost money live.',
  '<strong>It works where other tools cannot.</strong> A site with a strict Content-Security-Policy blocks injected scripts outright, which stops every bookmarklet. Extension code runs in an isolated world that the page&rsquo;s policy does not govern.',
  '<strong>It reaches localhost and staging.</strong> Nothing has to be publicly reachable for the extension to audit it.',
  '<strong>Nothing leaves your machine.</strong> Not a policy promise — there is no network call in it that carries page content.',
])}

<h2>Permissions</h2>
<p>
  The extension asks for <code>activeTab</code>, which grants access to a single
  tab and only at the moment you click the icon. That is why the install page
  carries no &ldquo;read all your data on every website&rdquo; warning: it cannot
  read anything until you ask it to, and only the page you asked about.
</p>

<h2>What it reports</h2>
<p>
  The same analysis as the rest of Curbcut: 105 checks against WCAG 2.2 Level AA,
  ranked by <a href="${href('/method/')}">legal exposure</a> rather than error
  count, with the findings a complaint would actually reproduce listed first and
  an explicit statement of what could not be tested.
</p>

<h2>If you would rather not install anything</h2>
<p>
  The <a href="${href('/bookmarklet/')}">bookmarklet</a> does the same audit with
  no install at all — drag one link to your bookmarks bar. It cannot run on sites
  with a strict Content-Security-Policy, which is the one thing the extension
  adds.
</p>`,
    }),
  );
}

async function bookmarkletPage() {
  // Kept in sync by the build: see scripts/build-bookmarklet.mjs
  await emit(
    '/bookmarklet/',
    page({
      title: 'The Curbcut bookmarklet — scan any page, including behind a login | Curbcut',
      description: 'Drag one link to your bookmarks bar and audit the page in front of you, including pages behind a login and interfaces that only exist after JavaScript runs. Nothing leaves your machine.',
      path: '/bookmarklet/',
      crumbs: [{ href: '/bookmarklet/', label: 'Bookmarklet' }],
      body: `
<h1>The bookmarklet</h1>
<p class="lede">
  The web scanner fetches a page from the outside, which means it sees what an anonymous visitor
  sees. That misses a great deal: anything behind a login, anything in a cart or a checkout flow
  with state, and every menu, modal and validation message that only exists once JavaScript has
  run.
</p>
<p>
  The bookmarklet audits <strong>the page already open in front of you</strong>, in its real
  state. Nothing is fetched, nothing is uploaded, and no proxy is involved.
</p>

<div class="callout" id="install">
  <h2 style="font-size:1rem;margin-bottom:.35rem">Install</h2>
  <p>
    Drag this link to your bookmarks bar. On mobile, or with the bar hidden, create a bookmark
    of any page and replace its address with the code below.
  </p>
  <p><a class="btn" id="bookmarklet-link" href="/bookmarklet.js" style="text-decoration:none">Curbcut audit</a></p>
  <p class="form-hint">
    Your browser may not let you drag a link that runs code; if the drag does nothing, use the
    manual method.
  </p>
</div>

<h2>What it does</h2>
${olist([
  'Loads the axe-core engine into the current page.',
  'Runs the WCAG 2.2 Level AA checks against the live DOM, exactly as it stands.',
  'Classifies each failing element by page region — checkout, sign-in, form, navigation, main, footer.',
  'Prints a ranked summary to the browser console and opens the full report.',
])}

<h2>What it can see that the web scanner cannot</h2>
${list([
  'Pages behind a login — an account area, an admin panel, a members&rsquo; portal.',
  'A cart or checkout with items actually in it, which is where the failures that matter live.',
  'Menus, modals, drawers, tooltips and toasts that exist only after a script builds them.',
  'Client-rendered applications, where the served HTML is an empty shell.',
  'Local development, staging environments and anything on a private network.',
])}

<h2>Privacy</h2>
<p>
  The bookmarklet runs entirely in your browser. The page content is never sent anywhere —
  not to Curbcut, not to anyone. That is a property of how it works rather than a policy
  promise: there is no network call in it that carries page data.
</p>

<h2>Manual install</h2>
<p>Create a new bookmark and paste this as its address:</p>
<pre><code id="bookmarklet-code">Loading…</code></pre>
<script type="module" src="/src/bookmarklet-page.ts"></script>`,
    }),
  );
}

/* ------------------------------------------------------------ sitemap */

async function sitemap() {
  const urls = ['/', ...written].sort();
  const prefix = BASE === '/' ? '' : BASE.replace(/\/$/, '');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE.origin}${prefix}${u}</loc></url>`).join('\n')}
</urlset>
`;
  await writeFile(join(HERE, '..', 'packages', 'web', 'public', 'sitemap.xml'), xml, 'utf8');

  await writeFile(
    join(HERE, '..', 'packages', 'web', 'public', 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE.origin}${prefix}/sitemap.xml\n`,
    'utf8',
  );
}

/* --------------------------------------------------------------- main */

await rm(OUT, { recursive: true, force: true });
await wcagPages();
await lawPages();
await fixPages();
await deadlinePage();
await methodPage();
await extensionPage();
await bookmarkletPage();
await sitemap();

console.log(`Generated ${written.length} pages`);
const byType = written.reduce((acc, p) => {
  const key = p.split('/')[1] || 'root';
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});
for (const [k, v] of Object.entries(byType).sort((a, b) => b[1] - a[1])) console.log(`  /${k}/ ${v}`);
