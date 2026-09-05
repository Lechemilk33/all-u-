import type { Store } from './store.js';

/**
 * Staged orders — the handoff between the finder and the game client.
 *
 * The plugin reads the staged order and prefills the Grand Exchange search box
 * and price input with it. That is a write into client state, and it is worth
 * being precise about why it is permitted where synthesised input is not:
 *
 *   - It sets client variables and re-runs the client's own scripts through the
 *     RuneLite plugin API, inside the approved client. No OS-level mouse or
 *     keyboard event is generated, which is the thing Jagex's 2017 mouse-keys
 *     ruling prohibits.
 *   - It adds no menu entries, so nothing new causes an action to be sent to the
 *     server — the category the Third Party Client Guidelines name explicitly.
 *   - You still click the slot and click Confirm. Those are the server actions,
 *     and they stay yours.
 *
 * The no-fabrication rule follows the price all the way into the game: a staged
 * price is validated against the observed spread at staging time, and the spread
 * travels with it so a prefill can be refused once it goes stale.
 */

export interface StagedOrder {
  readonly itemId: number;
  readonly itemName: string;
  readonly side: 'buy' | 'sell';
  readonly price: number;
  readonly quantity: number;
  readonly spreadLow: number;
  readonly spreadHigh: number;
  readonly stagedAt: number;
}

export function writeStagedOrder(store: Store, o: StagedOrder): void {
  store.db.prepare(`
    INSERT INTO staged_order (id,item_id,item_name,side,price,quantity,spread_low,spread_high,staged_at)
    VALUES (1,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      item_id=excluded.item_id, item_name=excluded.item_name, side=excluded.side,
      price=excluded.price, quantity=excluded.quantity,
      spread_low=excluded.spread_low, spread_high=excluded.spread_high, staged_at=excluded.staged_at
  `).run(o.itemId, o.itemName, o.side, o.price, o.quantity, o.spreadLow, o.spreadHigh, o.stagedAt);
}

/**
 * The live staged order, or null.
 *
 * `maxAgeSeconds` matters as much here as it does for the cash stack: a price
 * staged forty minutes ago is not a price you want typed into a live offer. An
 * expired order is reported as absent, so the plugin prefills nothing rather
 * than prefilling something wrong.
 */
export function readStagedOrder(store: Store, now: number, maxAgeSeconds: number): StagedOrder | null {
  const row = store.db.prepare('SELECT * FROM staged_order WHERE id = 1').get() as Record<string, unknown> | undefined;
  if (row === undefined) return null;
  const stagedAt = row['staged_at'] as number;
  if (now - stagedAt > maxAgeSeconds) return null;
  return {
    itemId: row['item_id'] as number,
    itemName: row['item_name'] as string,
    side: row['side'] as 'buy' | 'sell',
    price: row['price'] as number,
    quantity: row['quantity'] as number,
    spreadLow: row['spread_low'] as number,
    spreadHigh: row['spread_high'] as number,
    stagedAt,
  };
}

export function clearStagedOrder(store: Store): void {
  store.db.prepare('DELETE FROM staged_order WHERE id = 1').run();
}

/** How long a staged order stays live before the plugin stops offering it. */
export const STAGED_ORDER_MAX_AGE_S = 900;
