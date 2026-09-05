import { buildCandidate } from './candidate.js';
import type { Candidate, FilterConfig, ItemRef, LatestQuote, Rejection } from './types.js';

export interface PipelineInput {
  readonly quotes: readonly LatestQuote[];
  readonly items: ReadonlyMap<number, ItemRef>;
  readonly volumes: ReadonlyMap<number, number>;
  readonly spreadHistory: ReadonlyMap<number, readonly number[]>;
  readonly fetchedAt: number;
  readonly now: number;
}

export interface PipelineResult {
  readonly candidates: readonly Candidate[];
  readonly rejections: readonly Rejection[];
  readonly funnel: Readonly<Record<string, number>>;
}

/**
 * The whole condensation, in one pass, with the funnel counted as it goes.
 *
 * The funnel counts are a product feature, not instrumentation. A flip finder
 * that shows you thirty rows and nothing else gives you no way to notice that it
 * is showing you thirty rows because the feed broke.
 */
export function runPipeline(input: PipelineInput, cfg: FilterConfig, topN: number): PipelineResult {
  const candidates: Candidate[] = [];
  const rejections: Rejection[] = [];
  const funnel: Record<string, number> = { input: input.quotes.length };

  for (const quote of input.quotes) {
    const result = buildCandidate(
      {
        quote,
        item: input.items.get(quote.itemId),
        volume24h: input.volumes.get(quote.itemId),
        spreadHistory: input.spreadHistory.get(quote.itemId) ?? [],
        fetchedAt: input.fetchedAt,
        now: input.now,
      },
      cfg,
    );
    if (result.ok) candidates.push(result.candidate);
    else {
      rejections.push(result.rejection);
      // nofallback-ok: initialising a rejection counter, not substituting a measurement
      funnel[result.rejection.reason] = (funnel[result.rejection.reason] ?? 0) + 1;
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  funnel['survived'] = candidates.length;
  funnel['returned'] = Math.min(topN, candidates.length);
  return { candidates: candidates.slice(0, topN), rejections, funnel };
}

/**
 * Serialise candidates for a model.
 *
 * TSV rather than JSON: same information, roughly a third of the tokens, and no
 * nesting for a reader to get lost in. Every column is already computed — there
 * is no raw price in here that anyone has to do arithmetic on, because a model
 * doing arithmetic is a model producing numbers that came from nowhere.
 */
export function toTsv(candidates: readonly Candidate[]): string {
  const header = [
    'item_id', 'name', 'buy', 'sell', 'net', 'roi_pct', 'vol24h',
    'units', 'limited_by', 'potential', 'capital', 'buy_age_s', 'sell_age_s', 'spread_z',
  ].join('\t');

  const rows = candidates.map((c) => [
    c.item.id,
    c.item.name,
    c.buy,
    c.sell,
    c.netMargin,
    (c.roi * 100).toFixed(2),
    c.volume24h,
    c.tradeableUnits,
    c.limitedBy,
    c.potentialProfit,
    c.capitalRequired,
    c.buyAgeSeconds,
    c.sellAgeSeconds,
    // "unknown" is spelled out rather than left blank, so the model cannot read
    // an empty cell as a zero.
    c.spreadZ === null ? 'unknown' : c.spreadZ.toFixed(2),
  ].join('\t'));

  return [header, ...rows].join('\n');
}
