/**
 * The Exposure Index.
 *
 * An error count is not a risk measure. Ten missing labels on a checkout form
 * and ten low-contrast captions in a footer produce the same number and wildly
 * different legal outcomes. The index weights each finding by:
 *
 *   salience  how often the criterion is actually pleaded            (0–5)
 *   blocking  whether it stops a user finishing a task               (1–3)
 *   region    where on the page it sits, checkout worst              (0.6–2.0)
 *   volume    how many elements fail, with diminishing returns       (1 + ln n)
 *
 * The weighted total is passed through a saturating curve so the index stays in
 * 0–100 and so the difference between a bad site and a catastrophic one does not
 * swamp the difference between a clean site and a bad one.
 *
 * The index is a triage tool. It is not a compliance determination, and
 * `verdict` — which is a straight WCAG conformance test — is reported alongside
 * it precisely so the two are never confused.
 */

import type { ConformanceLevel } from './wcag.js';
import { REGION_WEIGHT, bindingFindings, instanceCount, type Finding, type Region } from './findings.js';
import { BENCHMARK_2026 } from './litigation.js';

const BLOCKING_WEIGHT = { degrades: 1, impairs: 2, blocks: 3 } as const;

/**
 * Calibration constant for the saturating curve. Chosen so that a page carrying
 * the WebAIM Million median failure profile — low contrast and missing alt text
 * at typical volumes, in main content — lands in the mid-50s, leaving headroom
 * above it for sites with blocking failures in checkout.
 */
const SATURATION_K = 260;

export type Band = 'clean' | 'low' | 'elevated' | 'high' | 'severe';

export interface ScoredFinding {
  readonly finding: Finding;
  /** This finding's contribution to the raw weighted total. */
  readonly weight: number;
  /** Share of total exposure, 0–1. */
  readonly share: number;
  /** Worst region any failing node sits in. */
  readonly worstRegion: Region;
}

export interface Verdict {
  readonly target: ConformanceLevel;
  /** False if any criterion at or below the target level fails. */
  readonly conforms: boolean;
  readonly failedCriteria: readonly string[];
  readonly statement: string;
}

export interface Exposure {
  /** 0–100. Higher means more legal exposure. */
  readonly index: number;
  readonly band: Band;
  readonly raw: number;
  readonly totalInstances: number;
  readonly blockingInstances: number;
  readonly scored: readonly ScoredFinding[];
  readonly verdict: Verdict;
  readonly benchmark: {
    /** Errors on this page versus the WebAIM Million mean. */
    readonly meanErrorsPerPage: number;
    readonly ratioToMean: number;
    readonly summary: string;
  };
}

export const BAND_LABEL: Readonly<Record<Band, string>> = {
  clean: 'No detectable exposure',
  low: 'Low',
  elevated: 'Elevated',
  high: 'High',
  severe: 'Severe',
};

export function bandFor(index: number): Band {
  if (index <= 0) return 'clean';
  if (index < 20) return 'low';
  if (index < 45) return 'elevated';
  if (index < 70) return 'high';
  return 'severe';
}

function worstRegionOf(finding: Finding): Region {
  let worst: Region = 'unknown';
  let best = -1;
  for (const n of finding.nodes) {
    const w = REGION_WEIGHT[n.region];
    if (w > best) {
      best = w;
      worst = n.region;
    }
  }
  return worst;
}

/** Volume term. One failure counts once; a hundred count about 5.6 times, not 100. */
const volume = (n: number): number => (n <= 0 ? 0 : 1 + Math.log(n));

export function weighFinding(finding: Finding): number {
  if (finding.salience === 0) return 0;
  const byRegion = new Map<Region, number>();
  for (const n of finding.nodes) byRegion.set(n.region, (byRegion.get(n.region) ?? 0) + 1);

  let total = 0;
  for (const [region, count] of byRegion) {
    total += finding.salience * BLOCKING_WEIGHT[finding.blocking] * REGION_WEIGHT[region] * volume(count);
  }
  return total;
}

function buildVerdict(findings: readonly Finding[], target: ConformanceLevel): Verdict {
  const binding = bindingFindings(findings, target);
  const failedCriteria = [
    ...new Set(binding.flatMap((f) => f.criteria.filter((c) => c.level === 'A' || c.level === target).map((c) => c.num))),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const conforms = failedCriteria.length === 0;
  return {
    target,
    conforms,
    failedCriteria,
    statement: conforms
      ? `No automatically detectable failures of WCAG 2.2 Level ${target}. Automated testing covers roughly a third of the success criteria, so this is not a conformance claim.`
      : `Fails WCAG 2.2 Level ${target} on ${failedCriteria.length} success ${failedCriteria.length === 1 ? 'criterion' : 'criteria'}.`,
  };
}

export function scoreExposure(
  findings: readonly Finding[],
  target: ConformanceLevel = 'AA',
): Exposure {
  const relevant = findings.filter((f) => !f.bestPracticeOnly);

  const weighted = relevant
    .map((finding) => ({ finding, weight: weighFinding(finding), worstRegion: worstRegionOf(finding) }))
    .filter((s) => s.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  const raw = weighted.reduce((sum, s) => sum + s.weight, 0);
  const scored: ScoredFinding[] = weighted.map((s) => ({
    ...s,
    share: raw > 0 ? s.weight / raw : 0,
  }));

  const index = raw <= 0 ? 0 : Math.round(100 * (1 - Math.exp(-raw / SATURATION_K)));
  const totalInstances = instanceCount(relevant);
  const blockingInstances = instanceCount(relevant.filter((f) => f.blocking === 'blocks'));

  const ratioToMean = totalInstances / BENCHMARK_2026.meanErrorsPerPage;

  return {
    index,
    band: bandFor(index),
    raw: Math.round(raw * 10) / 10,
    totalInstances,
    blockingInstances,
    scored,
    verdict: buildVerdict(relevant, target),
    benchmark: {
      meanErrorsPerPage: BENCHMARK_2026.meanErrorsPerPage,
      ratioToMean: Math.round(ratioToMean * 100) / 100,
      summary: benchmarkSummary(totalInstances, ratioToMean),
    },
  };
}

function benchmarkSummary(instances: number, ratio: number): string {
  const mean = BENCHMARK_2026.meanErrorsPerPage;
  if (instances === 0) {
    return `No detectable failures, against an average of ${mean} per home page across the top million domains.`;
  }
  if (ratio < 0.5) {
    return `${instances} detectable failures, well under the ${mean} average across the top million home pages.`;
  }
  if (ratio <= 1.2) {
    return `${instances} detectable failures, about the ${mean} average across the top million home pages. Average is not a safe harbour: 95.9% of those pages fail too.`;
  }
  return `${instances} detectable failures — ${ratio.toFixed(1)}× the ${mean} average across the top million home pages.`;
}

/**
 * The findings a complaint would actually reproduce: highest weight first, one
 * entry per rule, each with a concrete failing element to point at.
 */
export interface Exhibit {
  readonly rank: number;
  readonly finding: Finding;
  readonly node: Finding['nodes'][number];
  readonly instances: number;
  readonly share: number;
  readonly why: string;
}

export function buildExhibits(exposure: Exposure, limit = 5): Exhibit[] {
  const out: Exhibit[] = [];
  for (const s of exposure.scored) {
    if (out.length >= limit) break;
    const node =
      [...s.finding.nodes].sort((a, b) => REGION_WEIGHT[b.region] - REGION_WEIGHT[a.region])[0];
    if (!node) continue;
    out.push({
      rank: out.length + 1,
      finding: s.finding,
      node,
      instances: s.finding.nodes.length,
      share: s.share,
      why: s.finding.allegation,
    });
  }
  return out;
}
