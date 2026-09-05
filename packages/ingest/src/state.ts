import type { Candidate } from '@flip/core';
import type { Store } from './store.js';

/**
 * State reported by the game client, and the suggestion log.
 *
 * Everything here is a mirror of something that actually happened — a plugin
 * reported a cash stack, or a model made a call we recorded. Nothing in this
 * module ever produces a value of its own.
 */

export interface ClientState {
  readonly cashStack: number;
  readonly inventory: ReadonlyArray<{ id: number; quantity: number }>;
  readonly geOffers: ReadonlyArray<{
    slot: number; itemId: number; state: string;
    price: number; totalQuantity: number; quantitySold: number;
    /** Coins actually moved. A buy can fill below the asking price. */
    spent: number;
  }>;
  readonly world: number | null;
  readonly member: boolean;
  readonly reportedAt: number;
}

export function writeClientState(store: Store, s: ClientState): void {
  store.db.prepare(`
    INSERT INTO client_state (id,cash_stack,inventory_json,ge_offers_json,world,member,reported_at)
    VALUES (1,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      cash_stack=excluded.cash_stack, inventory_json=excluded.inventory_json,
      ge_offers_json=excluded.ge_offers_json, world=excluded.world,
      member=excluded.member, reported_at=excluded.reported_at
  `).run(
    s.cashStack, JSON.stringify(s.inventory), JSON.stringify(s.geOffers),
    s.world, s.member ? 1 : 0, s.reportedAt,
  );
}

/**
 * The last state a client reported, or null if none ever has.
 *
 * `maxAgeSeconds` matters: a cash stack from two hours ago is not your cash
 * stack. Stale state is reported as absent rather than as a number, so the
 * ranker falls back to "affordability unknown" instead of sizing trades against
 * money you may have already spent.
 */
export function readClientState(store: Store, now: number, maxAgeSeconds: number): ClientState | null {
  const row = store.db.prepare('SELECT * FROM client_state WHERE id = 1').get() as Record<string, unknown> | undefined;
  if (row === undefined) return null;
  const reportedAt = row['reported_at'] as number;
  if (now - reportedAt > maxAgeSeconds) return null;
  return {
    cashStack: row['cash_stack'] as number,
    inventory: JSON.parse((row['inventory_json'] as string) || '[]'),
    geOffers: JSON.parse((row['ge_offers_json'] as string) || '[]'),
    world: row['world'] as number | null,
    member: (row['member'] as number) === 1,
    reportedAt,
  };
}

export interface LoggedSuggestion {
  readonly itemId: number;
  readonly action: string;
  readonly buyAt: number;
  readonly sellAt: number;
  readonly quantity: number;
  readonly confidence: number;
  readonly reasoning: string;
}

/**
 * Record a suggestion together with the exact candidate row it was made from.
 *
 * Storing the candidate verbatim is what makes the log worth keeping: in two
 * weeks you can ask whether the model's calls beat the ranker's ordering, and
 * answer it against what was genuinely on screen at the time rather than against
 * a reconstruction.
 */
export function logSuggestion(store: Store, s: LoggedSuggestion, shown: Candidate, now: number): number {
  const res = store.db.prepare(`
    INSERT INTO suggestions (created_at,item_id,action,buy_at,sell_at,quantity,confidence,reasoning,candidate_json)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(
    now, s.itemId, s.action, s.buyAt, s.sellAt, s.quantity, s.confidence, s.reasoning,
    JSON.stringify(shown),
  );
  return Number(res.lastInsertRowid);
}

export interface ScoredSuggestion {
  readonly id: number;
  readonly createdAt: number;
  readonly itemId: number;
  readonly name: string;
  readonly action: string;
  readonly predictedNet: number;
  readonly actualNet: number | null;
  readonly checkedAt: number | null;
}

/** Suggestions old enough to score, that have not been scored yet. */
export function pendingOutcomes(store: Store, now: number, afterSeconds: number): Array<{ id: number; itemId: number; createdAt: number }> {
  return store.db.prepare(`
    SELECT id, item_id AS itemId, created_at AS createdAt FROM suggestions
    WHERE outcome_checked_at IS NULL AND created_at <= ?
  `).all(now - afterSeconds) as unknown as Array<{ id: number; itemId: number; createdAt: number }>;
}

export function writeOutcome(store: Store, id: number, now: number, buy: number, sell: number, net: number): void {
  store.db.prepare(
    'UPDATE suggestions SET outcome_checked_at=?, outcome_buy=?, outcome_sell=?, outcome_net=? WHERE id=?',
  ).run(now, buy, sell, net, id);
}

export function readSuggestions(store: Store, limit: number): ScoredSuggestion[] {
  return store.db.prepare(`
    SELECT s.id, s.created_at AS createdAt, s.item_id AS itemId,
           COALESCE(i.name, '(unknown item)') AS name, s.action,
           (s.sell_at - s.buy_at) AS predictedNet,
           s.outcome_net AS actualNet, s.outcome_checked_at AS checkedAt
    FROM suggestions s LEFT JOIN items i ON i.id = s.item_id
    ORDER BY s.created_at DESC LIMIT ?
  `).all(limit) as unknown as ScoredSuggestion[];
}
