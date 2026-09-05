import type { Store } from './store.js';
import { TERMINAL_OFFER_STATES, type OfferState } from './offers.js';

/**
 * Scoring suggestions against what actually happened.
 *
 * Two independent sources of truth, kept separate because they answer different
 * questions and one of them is available even if you never trade:
 *
 *   market  — what the spread did over the following window, from stored ticks.
 *             Answers "was the call right?" and needs no trading at all.
 *   filled  — what your own offers actually realised, from the offer log.
 *             Answers "did it work?" and exists only where you acted.
 *
 * Neither is inferred from the other, and a suggestion with no evidence stays
 * unscored rather than being credited with a guess.
 */

export interface Outcome {
  readonly suggestionId: number;
  readonly itemId: number;
  readonly name: string | null;
  readonly createdAt: number;
  readonly predictedBuy: number;
  readonly predictedSell: number;
  readonly predictedNet: number;
  readonly quantity: number;

  /** Best sell price observed in the window after the call. null if no tick landed. */
  readonly marketBestSell: number | null;
  readonly marketNet: number | null;
  readonly marketVerdict: 'achievable' | 'missed' | 'unknown';

  /** Realised from your own completed offers, when you traded it. */
  readonly filledUnits: number | null;
  readonly filledUnitPrice: number | null;
}

/**
 * Score every suggestion old enough to judge.
 *
 * `windowSeconds` is how long a flip is given to work — four hours by default,
 * matching the buy-limit window the position was sized against.
 */
export function scoreOutcomes(store: Store, now: number, windowSeconds: number): Outcome[] {
  const pending = store.db.prepare(`
    SELECT s.id, s.item_id, s.created_at, s.buy_at, s.sell_at, s.quantity,
           COALESCE(i.name, NULL) AS name
    FROM suggestions s LEFT JOIN items i ON i.id = s.item_id
    WHERE s.created_at <= ?
    ORDER BY s.created_at DESC LIMIT 500
  `).all(now - windowSeconds) as Array<Record<string, unknown>>;

  const out: Outcome[] = [];
  for (const s of pending) {
    const id = s['id'] as number;
    const itemId = s['item_id'] as number;
    const createdAt = s['created_at'] as number;
    const buyAt = s['buy_at'] as number;
    const sellAt = s['sell_at'] as number;
    const qty = s['quantity'] as number;
    const windowEnd = createdAt + windowSeconds;

    // What the instant-buy side actually reached during the window.
    const best = store.db.prepare(`
      SELECT MAX(price) AS best FROM price_ticks
      WHERE item_id = ? AND side = 'high' AND source_at BETWEEN ? AND ?
    `).get(itemId, createdAt, windowEnd) as { best: number | null } | undefined;

    const marketBestSell = best === undefined || best.best === null ? null : best.best;
    const marketNet = marketBestSell === null ? null : marketBestSell - buyAt - Math.floor(marketBestSell * 0.02);

    const marketVerdict: Outcome['marketVerdict'] =
      marketBestSell === null ? 'unknown' : marketBestSell >= sellAt ? 'achievable' : 'missed';

    const fill = store.db.prepare(`
      SELECT quantity_sold AS sold, spent FROM ge_offer_events
      WHERE item_id = ? AND state IN ('BOUGHT','SOLD') AND observed_at BETWEEN ? AND ?
        AND quantity_sold > 0
      ORDER BY id DESC LIMIT 1
    `).get(itemId, createdAt, windowEnd) as { sold: number; spent: number } | undefined;

    out.push({
      suggestionId: id,
      itemId,
      name: (s['name'] as string | null),
      createdAt,
      predictedBuy: buyAt,
      predictedSell: sellAt,
      predictedNet: sellAt - buyAt - Math.floor(sellAt * 0.02),
      quantity: qty,
      marketBestSell,
      marketNet,
      marketVerdict,
      filledUnits: fill === undefined ? null : fill.sold,
      filledUnitPrice: fill === undefined ? null : Math.round(fill.spent / fill.sold),
    });

    if (marketNet !== null) {
      store.db.prepare(
        'UPDATE suggestions SET outcome_checked_at=?, outcome_buy=?, outcome_sell=?, outcome_net=? WHERE id=?',
      ).run(now, buyAt, marketBestSell, marketNet, id);
    }
  }
  return out;
}

export interface HitRate {
  readonly scored: number;
  readonly achievable: number;
  readonly missed: number;
  readonly unknown: number;
  /** null until at least one suggestion has been scored — never 0 as a stand-in. */
  readonly hitRate: number | null;
  readonly medianPredictedNet: number | null;
  readonly medianRealisedNet: number | null;
}

export function hitRate(outcomes: readonly Outcome[]): HitRate {
  const achievable = outcomes.filter((o) => o.marketVerdict === 'achievable').length;
  const missed = outcomes.filter((o) => o.marketVerdict === 'missed').length;
  const unknown = outcomes.filter((o) => o.marketVerdict === 'unknown').length;
  const judged = achievable + missed;

  const med = (xs: number[]): number | null => {
    if (xs.length === 0) return null;
    const s = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? Math.round((s[mid - 1]! + s[mid]!) / 2) : s[mid]!;
  };

  return {
    scored: outcomes.length,
    achievable,
    missed,
    unknown,
    hitRate: judged === 0 ? null : achievable / judged,
    medianPredictedNet: med(outcomes.map((o) => o.predictedNet)),
    medianRealisedNet: med(outcomes.filter((o) => o.marketNet !== null).map((o) => o.marketNet as number)),
  };
}

export { TERMINAL_OFFER_STATES, type OfferState };
