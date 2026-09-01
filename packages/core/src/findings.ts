/**
 * The normalised finding model.
 *
 * axe-core produces rule results against a DOM. Curbcut converts those into
 * findings that carry legal context: which criteria they fail, which regimes
 * care, where on the page they sit, and what a complaint would say about them.
 */

import { criterionFromAxeTag, criterionByNumber, type ConformanceLevel, type SuccessCriterion } from './wcag.js';
import { riskForCriteria, RULE_TO_BENCHMARK, RULE_ALLEGATION, type Blocking, type Salience, type BenchmarkCategory } from './litigation.js';

export type Impact = 'minor' | 'moderate' | 'serious' | 'critical';

/**
 * Where on the page an element sits. Determined at scan time from the element's
 * ancestors, because the same missing label is a different problem in a checkout
 * form than in a footer newsletter box.
 */
export type Region =
  | 'checkout'
  | 'auth'
  | 'form'
  | 'navigation'
  | 'main'
  | 'footer'
  | 'unknown';

export const REGION_WEIGHT: Readonly<Record<Region, number>> = {
  checkout: 2.0,
  auth: 1.8,
  form: 1.5,
  navigation: 1.3,
  main: 1.0,
  footer: 0.6,
  unknown: 1.0,
};

export const REGION_LABEL: Readonly<Record<Region, string>> = {
  checkout: 'Checkout or cart',
  auth: 'Sign-in or account creation',
  form: 'A form',
  navigation: 'Site navigation',
  main: 'Main content',
  footer: 'Footer',
  unknown: 'Elsewhere on the page',
};

export interface FindingNode {
  /** CSS selector path to the element. */
  readonly target: string;
  /** Truncated outer HTML — the evidence a report reproduces. */
  readonly html: string;
  readonly region: Region;
  /** Visible text of or near the element, when there is any. */
  readonly label?: string;
  /** axe's own explanation of why this node failed. */
  readonly reason?: string;
}

/** A single axe rule that failed, with every node that failed it. */
export interface Finding {
  readonly ruleId: string;
  readonly description: string;
  readonly help: string;
  readonly helpUrl: string;
  readonly impact: Impact;
  readonly criteria: readonly SuccessCriterion[];
  /** Highest conformance level touched, i.e. the level at which this bites. */
  readonly level: ConformanceLevel | null;
  readonly salience: Salience;
  readonly blocking: Blocking;
  readonly allegation: string;
  readonly benchmarkCategory?: BenchmarkCategory;
  readonly nodes: readonly FindingNode[];
  /** True where the rule is an axe best practice with no WCAG criterion behind it. */
  readonly bestPracticeOnly: boolean;
}

/** The shape Curbcut needs out of a scanner. Deliberately not axe's own type. */
export interface RawRuleResult {
  readonly id: string;
  readonly description: string;
  readonly help: string;
  readonly helpUrl: string;
  readonly impact?: string | null;
  readonly tags: readonly string[];
  readonly nodes: readonly {
    readonly target: readonly string[];
    readonly html: string;
    readonly failureSummary?: string;
    readonly region?: Region;
    readonly label?: string;
  }[];
}

const IMPACTS: readonly Impact[] = ['minor', 'moderate', 'serious', 'critical'];
const asImpact = (v: string | null | undefined): Impact =>
  IMPACTS.includes(v as Impact) ? (v as Impact) : 'moderate';

const LEVEL_RANK: Record<ConformanceLevel, number> = { A: 1, AA: 2, AAA: 3 };

const MAX_HTML = 400;
const truncate = (s: string, n = MAX_HTML): string =>
  s.length <= n ? s : `${s.slice(0, n - 1)}…`;

/** Collapses axe's multi-line failureSummary into one readable sentence. */
function firstReason(summary: string | undefined): string | undefined {
  if (!summary) return undefined;
  const line = summary
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !/^Fix (any|all) of the following/i.test(l));
  return line ? line.replace(/^[-•]\s*/, '') : undefined;
}

export function toFinding(raw: RawRuleResult): Finding {
  const criteria = [...new Set(raw.tags.map(criterionFromAxeTag).filter((c): c is SuccessCriterion => !!c))]
    .filter((c) => !c.obsolete)
    .sort((a, b) => a.num.localeCompare(b.num, undefined, { numeric: true }));

  const level = criteria.reduce<ConformanceLevel | null>(
    (acc, c) => (acc === null || LEVEL_RANK[c.level] < LEVEL_RANK[acc] ? c.level : acc),
    null,
  );

  const risk = riskForCriteria(criteria.map((c) => c.num));
  const benchmarkCategory = RULE_TO_BENCHMARK[raw.id];
  // The criterion sets the weight; the rule may phrase the allegation better.
  const allegation = RULE_ALLEGATION[raw.id] ?? risk.allegation;

  return {
    ruleId: raw.id,
    description: raw.description,
    help: raw.help,
    helpUrl: raw.helpUrl,
    impact: asImpact(raw.impact),
    criteria,
    level,
    salience: risk.salience,
    blocking: risk.blocking,
    allegation,
    ...(benchmarkCategory ? { benchmarkCategory } : {}),
    bestPracticeOnly: criteria.length === 0,
    nodes: raw.nodes.map((n) => {
      const reason = firstReason(n.failureSummary);
      return {
        target: n.target.join(' '),
        html: truncate(n.html),
        region: n.region ?? 'unknown',
        ...(n.label ? { label: truncate(n.label, 120) } : {}),
        ...(reason ? { reason } : {}),
      };
    }),
  };
}

/** Total failing elements across a set of findings. */
export const instanceCount = (findings: readonly Finding[]): number =>
  findings.reduce((sum, f) => sum + f.nodes.length, 0);

/** Findings that count against a given conformance target. */
export function bindingFindings(
  findings: readonly Finding[],
  level: ConformanceLevel,
): Finding[] {
  const max = LEVEL_RANK[level];
  return findings.filter(
    (f) => f.level !== null && LEVEL_RANK[f.level] <= max,
  );
}

/** Convenience for report copy: "1.1.1 Non-text Content". */
export const criterionLabel = (num: string): string => {
  const sc = criterionByNumber(num);
  return sc ? `${sc.num} ${sc.name}` : num;
};
