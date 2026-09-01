/**
 * Assembles everything into the object a report renders from.
 *
 * Nothing here talks to a network or a DOM: give it findings and a jurisdiction
 * and it produces the whole document. That keeps the same report available to
 * the web app, the extension, the CLI and a PDF export without divergence.
 */

import type { ConformanceLevel } from './wcag.js';
import { deadlinesFor, bindingStandard, regimeById, type Regime, type RegimeId, type UpcomingDeadline } from './regimes.js';
import { buildExhibits, scoreExposure, BAND_LABEL, type Exhibit, type Exposure } from './score.js';
import { describeCoverage, type Coverage, type RenderMode } from './coverage.js';
import { recipeFor, type Recipe } from './remediation.js';
import { MARKET_RATES, SOURCES } from './litigation.js';
import type { Finding } from './findings.js';

export interface ReportInput {
  readonly url: string;
  readonly title: string;
  readonly scannedAt: string;
  readonly engine: string;
  readonly renderMode: RenderMode;
  readonly findings: readonly Finding[];
  readonly needsReview: readonly Finding[];
  readonly regimes: readonly RegimeId[];
  /** Criteria the engine could decide in this mode. */
  readonly testableCriteria: ReadonlySet<string>;
  readonly coverageWarning?: string;
}

export interface RemediationItem {
  readonly rank: number;
  readonly ruleId: string;
  readonly title: string;
  readonly instances: number;
  readonly effort: Recipe['effort'];
  readonly share: number;
  readonly recipe?: Recipe;
  readonly finding: Finding;
}

export interface Report {
  readonly url: string;
  readonly host: string;
  readonly title: string;
  readonly scannedAt: string;
  readonly engine: string;
  readonly standard: { readonly wcag: string; readonly level: ConformanceLevel };
  readonly exposure: Exposure;
  readonly coverage: Coverage;
  readonly exhibits: readonly Exhibit[];
  readonly remediation: readonly RemediationItem[];
  readonly regimes: readonly Regime[];
  readonly deadlines: readonly UpcomingDeadline[];
  readonly needsReviewCount: number;
  readonly headline: string;
  readonly summary: string;
  readonly marketRates: typeof MARKET_RATES;
  readonly sources: typeof SOURCES;
  readonly disclaimer: string;
  readonly coverageWarning?: string;
}

export const DISCLAIMER =
  'Curbcut reports what an automated engine can detect and how those failures map to published law. ' +
  'It is not legal advice, it is not a compliance certificate, and no automated tool — including this one — ' +
  'can establish that a site conforms to WCAG. Passing every check here means the machine-testable failures are gone. ' +
  'It does not mean the site is accessible; that requires testing with people and assistive technology.';

const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

function buildHeadline(exposure: Exposure, host: string): string {
  const { verdict, index, blockingInstances } = exposure;
  if (verdict.conforms && index === 0) {
    return `${host} has no automatically detectable WCAG 2.2 AA failures.`;
  }
  const n = verdict.failedCriteria.length;
  const blocking =
    blockingInstances > 0
      ? ` ${blockingInstances} of them can stop a user completing a task.`
      : '';
  return `${host} fails ${n} WCAG 2.2 Level AA success ${n === 1 ? 'criterion' : 'criteria'} across ${exposure.totalInstances} ${exposure.totalInstances === 1 ? 'element' : 'elements'}.${blocking}`;
}

function buildSummary(exposure: Exposure, regimes: readonly Regime[], deadlines: readonly UpcomingDeadline[]): string {
  const parts: string[] = [];
  parts.push(`Exposure Index ${exposure.index} of 100 — ${BAND_LABEL[exposure.band].toLowerCase()}.`);
  parts.push(exposure.benchmark.summary);

  const top = exposure.scored[0];
  if (top) {
    const pct = Math.round(top.share * 100);
    parts.push(
      `A single rule — ${top.finding.ruleId} — accounts for ${pct}% of the measured exposure, concentrated in ${top.worstRegion === 'unknown' ? 'the page body' : top.worstRegion}.`,
    );
  }

  const live = deadlines.find((d) => !d.passed);
  if (live) {
    parts.push(
      `${live.regime.shortName} requires compliance by ${live.date} for ${live.appliesTo.toLowerCase()} — ${live.daysAway} days from the date of this scan.`,
    );
  } else if (regimes.length > 0) {
    const names = regimes.map((r) => r.shortName).join(', ');
    parts.push(`Regimes applied: ${names}. All applicable deadlines have already passed.`);
  }

  return parts.join(' ');
}

export function buildReport(input: ReportInput): Report {
  const standard = bindingStandard(input.regimes);
  const level = standard.level === 'AAA' ? 'AA' : standard.level;

  const exposure = scoreExposure(input.findings, level);
  const coverage = describeCoverage(input.renderMode, level, input.testableCriteria);
  const exhibits = buildExhibits(exposure, 5);

  const remediation: RemediationItem[] = exposure.scored.map((s, i) => {
    const recipe = recipeFor(s.finding.ruleId);
    return {
      rank: i + 1,
      ruleId: s.finding.ruleId,
      title: recipe?.title ?? s.finding.help,
      instances: s.finding.nodes.length,
      effort: recipe?.effort ?? 'hours',
      share: s.share,
      ...(recipe ? { recipe } : {}),
      finding: s.finding,
    };
  });

  const regimes = input.regimes.map(regimeById).filter((r): r is Regime => !!r);
  const deadlines = deadlinesFor(input.regimes, new Date(input.scannedAt));
  const host = hostOf(input.url);

  return {
    url: input.url,
    host,
    title: input.title,
    scannedAt: input.scannedAt,
    engine: input.engine,
    standard: { wcag: standard.wcag, level },
    exposure,
    coverage,
    exhibits,
    remediation,
    regimes,
    deadlines,
    needsReviewCount: input.needsReview.length,
    headline: buildHeadline(exposure, host),
    summary: buildSummary(exposure, regimes, deadlines),
    marketRates: MARKET_RATES,
    sources: SOURCES,
    disclaimer: DISCLAIMER,
    ...(input.coverageWarning ? { coverageWarning: input.coverageWarning } : {}),
  };
}

/** Regimes that plausibly apply, from a country hint. Never narrows silently. */
export function suggestRegimes(country?: string): RegimeId[] {
  switch ((country ?? 'US').toUpperCase()) {
    case 'US':
      return ['ada-title-iii', 'ada-title-ii'];
    case 'CA':
      return ['aoda', 'aca'];
    case 'GB':
    case 'UK':
      return ['uk-psbar'];
    default:
      return ['eaa'];
  }
}
