import type { Store } from './store.js';

/**
 * Order tracking.
 *
 * This is the half of "manage my orders" that is actually available. Jagex's
 * rules prohibit software that sends actions to the server on your behalf, and
 * RuneLite's GrandExchangeOffer is six getters with no setters — so placing and
 * cancelling stay manual. Watching is not merely permitted, it is what the
 * plugin API is for, and it yields data the price feed cannot:
 *
 *   - time to fill, per item, at a given distance from the market price
 *   - the true cost basis, since a buy offer can fill below what you asked
 *   - whether an offer has stalled because someone undercut you
 *   - realised profit, which is the only honest way to score a suggestion
 */

/** The seven states a GE slot can be in, per net.runelite.api.GrandExchangeOfferState. */
export type OfferState =
  | 'EMPTY' | 'BUYING' | 'BOUGHT' | 'SELLING' | 'SOLD'
  | 'CANCELLED_BUY' | 'CANCELLED_SELL';

const TERMINAL: ReadonlySet<OfferState> = new Set(['BOUGHT', 'SOLD', 'CANCELLED_BUY', 'CANCELLED_SELL']);
const ACTIVE: ReadonlySet<OfferState> = new Set(['BUYING', 'SELLING']);

export interface OfferEvent {
  readonly slot: number;
  readonly itemId: number;
  readonly state: OfferState;
  readonly price: number;
  readonly totalQuantity: number;
  readonly quantitySold: number;
  readonly spent: number;
  readonly observedAt: number;
}

export function parseOfferEvent(raw: unknown, now: number): OfferEvent | { error: string } {
  if (typeof raw !== 'object' || raw === null) return { error: 'offer must be an object' };
  const o = raw as Record<string, unknown>;
  const int = (k: string): number | null => {
    const v = o[k];
    return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
  };
  const slot = int('slot'), itemId = int('itemId'), price = int('price');
  const total = int('totalQuantity'), sold = int('quantitySold'), spent = int('spent');
  const state = o['state'];

  if (slot === null) return { error: 'slot must be a non-negative integer' };
  if (itemId === null) return { error: 'itemId must be a non-negative integer' };
  if (price === null || total === null || sold === null || spent === null) {
    return { error: 'price, totalQuantity, quantitySold and spent must be non-negative integers' };
  }
  if (typeof state !== 'string' || !isOfferState(state)) {
    return { error: `state ${JSON.stringify(state)} is not a GrandExchangeOfferState` };
  }
  if (sold > total) return { error: `quantitySold ${sold} exceeds totalQuantity ${total}` };

  return { slot, itemId, state, price, totalQuantity: total, quantitySold: sold, spent, observedAt: now };
}

function isOfferState(s: string): s is OfferState {
  return ['EMPTY', 'BUYING', 'BOUGHT', 'SELLING', 'SOLD', 'CANCELLED_BUY', 'CANCELLED_SELL'].includes(s);
}

/**
 * Record an offer event, but only if it differs from the slot's last one.
 *
 * The client re-reports every slot on login and on each server tick that
 * touches the exchange, so most reports are identical to the one before.
 * Writing only transitions keeps the log a record of what happened rather than
 * a record of how often we asked.
 */
export function writeOfferEvent(store: Store, e: OfferEvent): boolean {
  const last = store.db.prepare(
    'SELECT item_id, state, price, total_quantity, quantity_sold, spent FROM ge_offer_events WHERE slot = ? ORDER BY id DESC LIMIT 1',
  ).get(e.slot) as Record<string, unknown> | undefined;

  if (last !== undefined
    && last['item_id'] === e.itemId && last['state'] === e.state
    && last['price'] === e.price && last['total_quantity'] === e.totalQuantity
    && last['quantity_sold'] === e.quantitySold && last['spent'] === e.spent) {
    return false;
  }

  store.db.prepare(`
    INSERT INTO ge_offer_events (slot,item_id,state,price,total_quantity,quantity_sold,spent,observed_at)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(e.slot, e.itemId, e.state, e.price, e.totalQuantity, e.quantitySold, e.spent, e.observedAt);
  return true;
}

export interface Position {
  readonly slot: number;
  readonly itemId: number;
  readonly name: string | null;
  readonly side: 'buy' | 'sell';
  readonly state: OfferState;
  readonly offerPrice: number;
  readonly totalQuantity: number;
  readonly quantityFilled: number;
  readonly fillFraction: number;
  readonly spent: number;
  /** spent / quantityFilled — the price you actually got, not the one you asked for. */
  readonly realisedUnitPrice: number | null;
  readonly openedAt: number;
  readonly lastChangeAt: number;
  readonly ageSeconds: number;
  /** Seconds with no fill progress. A large value on a partial offer means undercut. */
  readonly stalledSeconds: number;
  readonly complete: boolean;
}

/**
 * Reconstruct the current state of each slot from the event log.
 *
 * A position runs from the first non-EMPTY event in a slot through to its
 * terminal state. Slots are reused, so the boundary is found by walking back
 * from the newest event until the item or the run of states changes.
 */
export function currentPositions(store: Store, now: number): Position[] {
  const slots = store.db.prepare('SELECT DISTINCT slot FROM ge_offer_events').all() as Array<{ slot: number }>;
  const out: Position[] = [];

  for (const { slot } of slots) {
    const events = store.db.prepare(
      'SELECT * FROM ge_offer_events WHERE slot = ? ORDER BY id DESC LIMIT 200',
    ).all(slot) as Array<Record<string, unknown>>;
    if (events.length === 0) continue;

    const newest = events[0]!;
    const state = newest['state'] as OfferState;
    if (state === 'EMPTY') continue;

    const itemId = newest['item_id'] as number;

    // Walk back through this slot's run of events for the same item to find when
    // the offer was opened. A different item, or an EMPTY, ends the run.
    let openedAt = newest['observed_at'] as number;
    let firstFillAt: number | null = null;
    let lastProgressAt = newest['observed_at'] as number;
    let lastSold = newest['quantity_sold'] as number;

    for (const ev of events) {
      if (ev['item_id'] !== itemId || ev['state'] === 'EMPTY') break;
      openedAt = ev['observed_at'] as number;
      const sold = ev['quantity_sold'] as number;
      if (sold !== lastSold) {
        lastProgressAt = Math.max(lastProgressAt, ev['observed_at'] as number);
      }
      if (sold > 0) firstFillAt = ev['observed_at'] as number;
      lastSold = sold;
    }

    const filled = newest['quantity_sold'] as number;
    const total = newest['total_quantity'] as number;
    const spent = newest['spent'] as number;
    const name = store.db.prepare('SELECT name FROM items WHERE id = ?').get(itemId) as { name: string } | undefined;

    out.push({
      slot,
      itemId,
      name: name === undefined ? null : name.name,
      side: state === 'SELLING' || state === 'SOLD' || state === 'CANCELLED_SELL' ? 'sell' : 'buy',
      state,
      offerPrice: newest['price'] as number,
      totalQuantity: total,
      quantityFilled: filled,
      fillFraction: total === 0 ? 0 : filled / total,
      spent,
      // Undefined until something fills. Reporting 0 would read as "free".
      realisedUnitPrice: filled === 0 ? null : Math.round(spent / filled),
      openedAt,
      lastChangeAt: newest['observed_at'] as number,
      ageSeconds: now - openedAt,
      stalledSeconds: now - lastProgressAt,
      complete: TERMINAL.has(state),
    });
    void firstFillAt;
  }

  out.sort((a, b) => a.slot - b.slot);
  return out;
}

export interface FillStat {
  readonly itemId: number;
  readonly name: string | null;
  readonly side: 'buy' | 'sell';
  readonly completedOffers: number;
  readonly medianSecondsToFill: number;
  readonly medianRealisedPrice: number;
}

/**
 * How long your offers have historically taken to fill, per item and side.
 *
 * This is the measurement the ranker cannot get from the price feed, and the
 * one that turns "the margin is 9 gp" into "the margin is 9 gp and it clears in
 * eleven minutes". It reports only what has actually completed — an item you
 * have never traded returns no row rather than an estimate.
 */
export function fillStatistics(store: Store, sinceSeconds: number): FillStat[] {
  const rows = store.db.prepare(`
    SELECT slot, item_id, state, price, total_quantity, quantity_sold, spent, observed_at
    FROM ge_offer_events WHERE observed_at >= ? ORDER BY slot, id
  `).all(sinceSeconds) as Array<Record<string, unknown>>;

  // Group into completed runs per slot, then measure each.
  const runs = new Map<string, { start: number; end: number; sold: number; spent: number; side: 'buy' | 'sell' }>();
  const open = new Map<number, { itemId: number; start: number }>();

  for (const r of rows) {
    const slot = r['slot'] as number;
    const itemId = r['item_id'] as number;
    const state = r['state'] as OfferState;
    const at = r['observed_at'] as number;

    if (state === 'EMPTY') { open.delete(slot); continue; }
    const cur = open.get(slot);
    if (cur === undefined || cur.itemId !== itemId) open.set(slot, { itemId, start: at });

    if (TERMINAL.has(state)) {
      const started = open.get(slot);
      const sold = r['quantity_sold'] as number;
      if (started !== undefined && sold > 0) {
        const side: 'buy' | 'sell' = state === 'SOLD' || state === 'CANCELLED_SELL' ? 'sell' : 'buy';
        runs.set(`${slot}:${at}:${itemId}`, {
          start: started.start, end: at, sold, spent: r['spent'] as number, side,
        });
      }
      open.delete(slot);
    }
  }

  const grouped = new Map<string, { itemId: number; side: 'buy' | 'sell'; durations: number[]; prices: number[] }>();
  for (const [key, run] of runs) {
    const itemId = Number(key.split(':')[2]);
    const gk = `${itemId}:${run.side}`;
    let g = grouped.get(gk);
    if (g === undefined) { g = { itemId, side: run.side, durations: [], prices: [] }; grouped.set(gk, g); }
    g.durations.push(run.end - run.start);
    g.prices.push(Math.round(run.spent / run.sold));
  }

  const median = (xs: number[]): number => {
    const s = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? Math.round((s[mid - 1]! + s[mid]!) / 2) : s[mid]!;
  };

  const out: FillStat[] = [];
  for (const g of grouped.values()) {
    const name = store.db.prepare('SELECT name FROM items WHERE id = ?').get(g.itemId) as { name: string } | undefined;
    out.push({
      itemId: g.itemId,
      name: name === undefined ? null : name.name,
      side: g.side,
      completedOffers: g.durations.length,
      medianSecondsToFill: median(g.durations),
      medianRealisedPrice: median(g.prices),
    });
  }
  out.sort((a, b) => b.completedOffers - a.completedOffers);
  return out;
}

export { ACTIVE as ACTIVE_OFFER_STATES, TERMINAL as TERMINAL_OFFER_STATES };
