import { netMargin } from './tax.js';

/**
 * The price you can realistically transact at, as opposed to the price the feed
 * last printed.
 *
 * /latest `high` is the last instant-buy and `low` the last instant-sell. A flip
 * buys at the low and sells at the high, which means you are the one providing
 * liquidity on both legs — and every other public flip site reads this same feed
 * and queues at the same two numbers. Undercutting by one coin on each side is
 * what actually gets you to the front of the queue, and on a 3 gp margin it is
 * the difference between a trade and nothing.
 *
 * The quoted spread remains available as the optimistic bound; this is the one
 * we rank on.
 */
export function realisticFill(low: number, high: number): { buy: number; sell: number } {
  return { buy: low + 1, sell: high - 1 };
}

/**
 * How many units the market can plausibly absorb inside one 4-hour buy-limit
 * window.
 *
 * Ranking on `net * buyLimit` is the single most common way to build a flip
 * finder that recommends garbage. The buy limit is a ceiling imposed by Jagex,
 * not a forecast of what will trade. An item with a 13,000 limit that trades
 * 5,000 units a day cannot absorb 13,000 units in four hours, and pricing its
 * potential as though it could puts it at the top of every naive ranking.
 *
 * `capture` is the share of a window's genuine volume you expect to be your own
 * fills. It is a judgement call, not a measurement, so it is a caller-supplied
 * parameter with a deliberately conservative default rather than a constant
 * buried in here.
 */
export function absorbableUnits(volume24h: number, capture: number): number {
  if (!Number.isFinite(volume24h) || volume24h < 0) {
    throw new RangeError(`absorbableUnits: volume24h must be real and non-negative, got ${String(volume24h)}`);
  }
  if (!(capture > 0 && capture <= 1)) {
    throw new RangeError(`absorbableUnits: capture must be in (0, 1], got ${String(capture)}`);
  }
  return Math.floor(volume24h * (4 / 24) * capture);
}

/**
 * Units you can actually commit, given every binding constraint at once:
 * Jagex's 4-hour limit, what the market will absorb, and what you can afford.
 *
 * `cashStack` is only supplied when a client has reported it. When it is absent
 * the affordability term is simply not applied — it is never guessed at, and the
 * caller can tell the difference by whether `limitedBy` says 'cash'.
 */
export function tradeableUnits(args: {
  buyLimit: number | null;
  absorbable: number;
  buyPrice: number;
  cashStack: number | null;
}): { units: number; limitedBy: 'buy-limit' | 'volume' | 'cash' } {
  const { buyLimit, absorbable, buyPrice, cashStack } = args;
  if (!(buyPrice > 0)) throw new RangeError(`tradeableUnits: buyPrice must be positive, got ${String(buyPrice)}`);

  // Volume always binds — there is no case where the market absorbs an
  // unbounded quantity — so it seeds the list and `limitedBy` is never a
  // placeholder. A missing buy limit is reported as such on the item, not
  // laundered into a claim that nothing constrains the position.
  const candidates: Array<{ units: number; by: 'buy-limit' | 'volume' | 'cash' }> = [
    { units: absorbable, by: 'volume' },
  ];
  // 516 of 4,662 mapping entries carry no `limit` field at all. Treating a
  // missing limit as 0 would silently delete a tenth of the market; treating it
  // as Infinity would invent a constraint we have no evidence for. It is simply
  // not a constraint we know about, and `limitedBy` will say so.
  if (buyLimit !== null) candidates.push({ units: buyLimit, by: 'buy-limit' });
  if (cashStack !== null) candidates.push({ units: Math.floor(cashStack / buyPrice), by: 'cash' });

  let best = candidates[0]!;
  for (const c of candidates) if (c.units < best.units) best = c;
  return { units: Math.max(0, best.units), limitedBy: best.by };
}

/** Profit if you fill `units` at the realistic prices. */
export function potentialProfit(buy: number, sell: number, itemId: number, units: number): number {
  return netMargin(buy, sell, itemId) * units;
}

/** Return on the capital the buy leg ties up. */
export function returnOnCapital(buy: number, sell: number, itemId: number): number {
  if (!(buy > 0)) throw new RangeError(`returnOnCapital: buy must be positive, got ${String(buy)}`);
  return netMargin(buy, sell, itemId) / buy;
}

/**
 * How unusual the current spread is against its own recent history, in standard
 * deviations.
 *
 * Returns null — never 0 — when there is not enough history to say. A z-score of
 * 0 means "perfectly normal", which is the opposite of "we don't know", and
 * conflating the two is how a brand-new item with no baseline ends up looking
 * like the safest row on the screen.
 */
export function spreadZScore(currentSpread: number, history: readonly number[]): number | null {
  if (history.length < MIN_BASELINE_SAMPLES) return null;
  const n = history.length;
  let sum = 0;
  for (const h of history) sum += h;
  const mean = sum / n;
  let sq = 0;
  for (const h of history) sq += (h - mean) ** 2;
  const sd = Math.sqrt(sq / n);
  if (sd === 0) return null;
  return (currentSpread - mean) / sd;
}

/** Below this many historical buckets a z-score is noise dressed up as a number. */
export const MIN_BASELINE_SAMPLES = 24;
