import EXEMPT from './tax-exempt.json' with { type: 'json' };

/**
 * Grand Exchange tax.
 *
 * Rate is 2%, raised from 1% on 29 May 2025. Charged to the seller, floored to
 * whole coins, capped at 5,000,000 gp per item.
 * Source: https://oldschool.runescape.wiki/w/Grand_Exchange
 *
 * Deliberately absent: a hard-coded "no tax below 50 gp" branch. That threshold
 * is not a rule, it is an artefact of the floor — floor(49 * 0.02) is already 0.
 * Under the old 1% rate the same artefact sat at 100 gp. Encoding 50 as a
 * constant would silently produce wrong margins the next time Jagex touches the
 * rate; deriving it from the floor cannot.
 */
export const TAX_RATE = 0.02;
export const TAX_CAP_PER_ITEM = 5_000_000;

/**
 * Item ids exempt from the tax, resolved by exact name against a live
 * /mapping response rather than transcribed by hand. The resolver hard-fails on
 * any unresolved name, so this file cannot silently lose an entry.
 * Exemption is worth the whole margin on cheap high-volume items, so a missing
 * id here reads as a losing flip rather than as a bug.
 */
export const TAX_EXEMPT_IDS: ReadonlySet<number> = new Set(EXEMPT.map((e) => e.id));

export const TAX_EXEMPT_ITEMS: ReadonlyArray<{ id: number; name: string; listedAs: string }> = EXEMPT;

/** Tax charged on selling one unit at `price`. Always a whole number of coins. */
export function taxOn(price: number, itemId: number): number {
  if (!Number.isFinite(price) || price < 0) {
    throw new RangeError(`taxOn: price must be a real non-negative number, got ${String(price)}`);
  }
  if (TAX_EXEMPT_IDS.has(itemId)) return 0;
  return Math.min(Math.floor(price * TAX_RATE), TAX_CAP_PER_ITEM);
}

/**
 * Net profit per unit on a completed round trip.
 * `sell` and `buy` are the prices you actually transact at, not the quoted
 * spread — see `realisticFill` in metrics.ts for why those differ.
 */
export function netMargin(buy: number, sell: number, itemId: number): number {
  return sell - buy - taxOn(sell, itemId);
}
