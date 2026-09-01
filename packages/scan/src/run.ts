/**
 * Runs axe-core against a document and returns Curbcut findings.
 *
 * The same code path serves the browser (extension, bookmarklet, and the web
 * app's sandboxed iframe) and Node via jsdom, because the only thing either
 * needs is a Document and the axe global.
 */

import { toFinding, type Finding, type RawRuleResult, type Region } from '@curbcut/core';
import { regionOf, resolveTarget, visibleLabelOf } from './enrich.js';

/** The subset of the axe API Curbcut uses. Kept structural to avoid a hard dep. */
export interface AxeLike {
  getRules?(): { ruleId: string; tags: string[] }[];
  run(
    context: unknown,
    options: unknown,
  ): Promise<{
    violations: RawAxeResult[];
    incomplete: RawAxeResult[];
    passes: RawAxeResult[];
    inapplicable: RawAxeResult[];
    testEngine?: { name: string; version: string };
  }>;
}

interface RawAxeResult {
  id: string;
  description: string;
  help: string;
  helpUrl: string;
  impact?: string | null;
  tags: string[];
  nodes: { target: unknown[]; html: string; failureSummary?: string }[];
}

export interface ScanOptions {
  /** WCAG level to test against. AA is what every regime Curbcut tracks requires. */
  readonly level?: 'A' | 'AA' | 'AAA';
  /** Include axe best-practice rules that no regime requires. Off by default. */
  readonly includeBestPractice?: boolean;
  /** Page URL, used to disambiguate checkout and sign-in pages. */
  readonly url?: string;
}

export interface ScanResult {
  readonly url: string;
  readonly scannedAt: string;
  readonly engine: string;
  readonly findings: readonly Finding[];
  /** Rules axe could not decide — usually contrast over an image. Worth review. */
  readonly needsReview: readonly Finding[];
  readonly passedRules: number;
  readonly title: string;
  readonly lang: string | null;
  /**
   * Every rule the engine carries, with its WCAG tags. Coverage must be
   * computed from what the engine *can* decide, not from the rules that
   * happened to produce a result on this page — otherwise a clean page
   * reports near-zero coverage, which is exactly backwards.
   */
  readonly engineRules: readonly { readonly ruleId: string; readonly tags: readonly string[] }[];
}

function tagsFor(level: 'A' | 'AA' | 'AAA', bestPractice: boolean): string[] {
  const base = ['wcag2a', 'wcag21a', 'wcag22a'];
  if (level === 'AA' || level === 'AAA') base.push('wcag2aa', 'wcag21aa', 'wcag22aa');
  if (level === 'AAA') base.push('wcag2aaa', 'wcag21aaa');
  if (bestPractice) base.push('best-practice');
  return base;
}

/** Attaches page-position context to each failing node before scoring. */
function enrichNodes(
  doc: Document,
  result: RawAxeResult,
  url: string | undefined,
): RawRuleResult {
  return {
    id: result.id,
    description: result.description,
    help: result.help,
    helpUrl: result.helpUrl,
    impact: result.impact ?? null,
    tags: result.tags,
    nodes: result.nodes.map((n) => {
      const el = resolveTarget(doc, n.target);
      const region: Region = el ? regionOf(el, url) : 'unknown';
      const label = el ? visibleLabelOf(el) : undefined;
      return {
        target: n.target.flat(Infinity).filter((t): t is string => typeof t === 'string'),
        html: n.html,
        ...(n.failureSummary ? { failureSummary: n.failureSummary } : {}),
        region,
        ...(label ? { label } : {}),
      };
    }),
  };
}

export async function scanDocument(
  axe: AxeLike,
  doc: Document,
  options: ScanOptions = {},
): Promise<ScanResult> {
  const { level = 'AA', includeBestPractice = false, url } = options;

  const results = await axe.run(doc, {
    runOnly: { type: 'tag', values: tagsFor(level, includeBestPractice) },
    resultTypes: ['violations', 'incomplete'],
    elementRef: false,
  });

  const findings = results.violations.map((v) => toFinding(enrichNodes(doc, v, url)));
  const needsReview = results.incomplete.map((v) => toFinding(enrichNodes(doc, v, url)));

  return {
    url: url ?? doc.location?.href ?? '',
    scannedAt: new Date().toISOString(),
    engine: results.testEngine ? `${results.testEngine.name} ${results.testEngine.version}` : 'axe-core',
    findings,
    needsReview,
    passedRules: results.passes?.length ?? 0,
    title: doc.title ?? '',
    lang: doc.documentElement?.getAttribute('lang') ?? null,
    engineRules: axe.getRules?.() ?? [],
  };
}
