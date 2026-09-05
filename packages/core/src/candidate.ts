import { netMargin } from './tax.js';
import {
  absorbableUnits, potentialProfit, realisticFill, returnOnCapital,
  spreadZScore, tradeableUnits, MIN_BASELINE_SAMPLES,
} from './metrics.js';
import { assertAllFinite, observe, ProvenanceError, sources } from './provenance.js';
import type { Candidate, FilterConfig, ItemRef, LatestQuote, Rejection } from './types.js';

export interface BuildInput {
  readonly quote: LatestQuote;
  readonly item: ItemRef | undefined;
  readonly volume24h: number | undefined;
  /** Historical spreads for the z-score baseline. Empty is fine; it yields null. */
  readonly spreadHistory: readonly number[];
  readonly fetchedAt: number;
  readonly now: number;
}

export type BuildResult =
  | { ok: true; candidate: Candidate }
  | { ok: false; rejection: Rejection };

/**
 * Turn one raw quote into a candidate, or say exactly why it cannot be one.
 *
 * There is no path through this function that fills a gap with a default. Every
 * `undefined` input produces a rejection carrying a reason, and those rejections
 * are surfaced in the UI rather than dropped, so a pipeline that quietly stops
 * producing rows is visible instead of merely empty.
 */
export function buildCandidate(input: BuildInput, cfg: FilterConfig): BuildResult {
  const { quote, item, volume24h, spreadHistory, fetchedAt, now } = input;
  const id = quote.itemId;

  const reject = (reason: Rejection['reason'], detail: string): BuildResult => ({
    ok: false,
    rejection: { itemId: id, name: item?.name ?? null, reason, detail },
  });

  if (item === undefined) return reject('no-mapping-entry', `item ${id} is in /latest but not in /mapping`);
  if (quote.low === null || quote.lowTime === null) return reject('no-sell-side', 'no instant-sell price has been reported');
  if (quote.high === null || quote.highTime === null) return reject('no-buy-side', 'no instant-buy price has been reported');
  if (volume24h === undefined) return reject('no-volume-data', `item ${id} is absent from /volumes`);

  const buyAgeSeconds = now - quote.lowTime;
  const sellAgeSeconds = now - quote.highTime;

  // Staleness is governed by the OLDER leg, not the newer one.
  //
  // Across the live feed the median gap between highTime and lowTime is ~36
  // minutes, and the 90th percentile is over two days. Testing only the fresher
  // leg therefore admits, as the *typical* case, a "spread" computed between a
  // current price and a half-hour-old one — which is not a spread, it is two
  // unrelated facts subtracted from each other. Filtering on the older leg is
  // what makes the number mean what it claims to mean.
  const stalenessSeconds = Math.max(buyAgeSeconds, sellAgeSeconds);
  if (stalenessSeconds > cfg.maxStalenessSeconds) {
    return reject('stale', `older leg is ${stalenessSeconds}s old (limit ${cfg.maxStalenessSeconds}s)`);
  }

  const quotedBuy = quote.low;
  const quotedSell = quote.high;
  const { buy, sell } = realisticFill(quotedBuy, quotedSell);
  if (buy <= 0 || sell <= 0) return reject('malformed', `non-positive fill price buy=${buy} sell=${sell}`);

  const net = netMargin(buy, sell, id);
  if (net <= 0) return reject('negative-after-tax', `net ${net} gp per unit at realistic fill prices`);

  if (volume24h < cfg.minVolume24h) {
    return reject('below-volume-floor', `${volume24h} traded in 24h (floor ${cfg.minVolume24h})`);
  }

  const absorbable = absorbableUnits(volume24h, cfg.captureRate);
  const { units, limitedBy } = tradeableUnits({
    buyLimit: item.buyLimit, absorbable, buyPrice: buy, cashStack: cfg.cashStack,
  });
  if (units < cfg.minUnits) {
    const why = limitedBy === 'cash'
      ? `cash stack affords ${units} units at ${buy} gp`
      : `only ${units} units tradeable (limited by ${limitedBy})`;
    return reject(limitedBy === 'cash' ? 'unaffordable' : 'below-volume-floor', why);
  }

  const spreadZ = spreadZScore(quotedSell - quotedBuy, spreadHistory);
  const roi = returnOnCapital(buy, sell, id);
  const pot = potentialProfit(buy, sell, id, units);
  const capitalRequired = buy * units;

  try {
    assertAllFinite(`candidate[${id}]`, {
      quotedBuy, quotedSell, buy, sell, netMargin: net, roi, volume24h,
      absorbable, tradeableUnits: units, potentialProfit: pot, capitalRequired,
      buyAgeSeconds, sellAgeSeconds, stalenessSeconds,
    });
  } catch (err) {
    if (err instanceof ProvenanceError) return reject('malformed', err.message);
    throw err;
  }

  const obs = sources(
    [
      observe('latest', fetchedAt, quote.lowTime),
      observe('latest', fetchedAt, quote.highTime),
      observe('volumes', fetchedAt, fetchedAt),
      observe('mapping', fetchedAt, fetchedAt),
    ],
    ['realisticFill', 'netMargin', 'absorbableUnits', 'tradeableUnits', 'score'],
  );

  const candidate: Candidate = {
    item, quotedBuy, quotedSell, buy, sell,
    netMargin: net, roi, volume24h, absorbable,
    tradeableUnits: units, limitedBy, potentialProfit: pot, capitalRequired,
    buyAgeSeconds, sellAgeSeconds, stalenessSeconds,
    spreadZ, baselineSamples: spreadHistory.length,
    score: score({ pot, roi, volume24h, stalenessSeconds, spreadZ }),
    sources: obs,
  };
  return { ok: true, candidate };
}

/**
 * Risk-adjusted ranking score.
 *
 * Deliberately boring: profit potential is the base, and everything else is a
 * multiplicative penalty in [0,1]. A penalty can only ever push a row down, so
 * no combination of secondary signals can promote a fundamentally bad flip —
 * which is the failure mode that produces confident-looking garbage at the top
 * of the table.
 */
export function score(a: {
  pot: number; roi: number; volume24h: number; stalenessSeconds: number; spreadZ: number | null;
}): number {
  const base = Math.log10(Math.max(a.pot, 1));

  // Fresher is better, decaying smoothly rather than at a cliff.
  const freshness = 1 / (1 + a.stalenessSeconds / 300);

  // Thin books are unreliable regardless of headline margin.
  const liquidity = Math.min(1, Math.log10(Math.max(a.volume24h, 1)) / 5);

  // An abnormally wide spread is usually a stale or manipulated quote rather
  // than free money. Unknown (null) is penalised like a mild anomaly, because
  // "we have no baseline" is a reason for less confidence, not neutrality.
  const anomaly = a.spreadZ === null ? 0.75 : 1 / (1 + Math.max(0, Math.abs(a.spreadZ) - 1) / 2);

  // Very high ROI on a cheap item is the classic stale-quote signature.
  const roiSanity = a.roi > 1 ? 0.5 : 1;

  return base * freshness * liquidity * anomaly * roiSanity;
}

export { MIN_BASELINE_SAMPLES };
