import {
  DEFAULT_FILTER, runPipeline, toTsv, validateSuggestion,
  type Candidate, type FilterConfig, type LatestQuote, type RawSuggestion,
} from '@flip/core';
import {
  logSuggestion, readClientState, readSuggestions, writeClientState,
  currentPositions, fillStatistics, parseOfferEvent, writeOfferEvent,
  scoreOutcomes, hitRate,
  type ClientState, type Position, type FillStat, type Outcome, type HitRate,
} from '@flip/ingest';
import type { Store } from '@flip/ingest';

/** How old a client report may be before we stop treating its cash stack as current. */
export const CLIENT_STATE_MAX_AGE_S = 120;

export interface Snapshot {
  readonly candidates: readonly Candidate[];
  readonly funnel: Readonly<Record<string, number>>;
  readonly rejectionSamples: ReadonlyArray<{ name: string | null; reason: string; detail: string }>;
  readonly config: FilterConfig;
  readonly client: ClientState | null;
  readonly feed: FeedHealth;
}

export interface FeedHealth {
  readonly lastLatestPoll: number | null;
  readonly lastLatestOk: boolean | null;
  readonly lastError: string | null;
  readonly tickCount: number;
  readonly itemCount: number;
  readonly spreadPoints: number;
  readonly baselineCoverage: number;
  readonly newestTick: number | null;
}

/**
 * Read the most recent quote per item out of stored ticks.
 *
 * The two legs are reconstructed independently and keep their own timestamps.
 * They are never coalesced into a single "last updated" figure, because the gap
 * between them is the whole point: across the live feed its median is roughly
 * half an hour.
 */
export function latestQuotesFromStore(store: Store): LatestQuote[] {
  const rows = store.db.prepare(`
    SELECT item_id AS itemId, side, price, source_at AS sourceAt
    FROM price_ticks t
    WHERE source_at = (
      SELECT MAX(source_at) FROM price_ticks x WHERE x.item_id = t.item_id AND x.side = t.side
    )
  `).all() as Array<{ itemId: number; side: 'high' | 'low'; price: number; sourceAt: number }>;

  const byItem = new Map<number, { high: number | null; highTime: number | null; low: number | null; lowTime: number | null }>();
  for (const r of rows) {
    let e = byItem.get(r.itemId);
    if (e === undefined) { e = { high: null, highTime: null, low: null, lowTime: null }; byItem.set(r.itemId, e); }
    if (r.side === 'high') { e.high = r.price; e.highTime = r.sourceAt; }
    else { e.low = r.price; e.lowTime = r.sourceAt; }
  }
  return [...byItem].map(([itemId, e]) => ({ itemId, ...e }));
}

export function feedHealth(store: Store): FeedHealth {
  const poll = store.db.prepare(
    "SELECT fetched_at, ok, error FROM poll_log WHERE endpoint='latest' ORDER BY id DESC LIMIT 1",
  ).get() as { fetched_at: number; ok: number; error: string | null } | undefined;
  const s = store.stats();
  const withBaseline = store.db.prepare(
    'SELECT COUNT(*) AS n FROM (SELECT item_id FROM spread_history GROUP BY item_id HAVING COUNT(*) >= 24)',
  ).get() as { n: number } | undefined;
  return {
    lastLatestPoll: poll?.fetched_at ?? null,
    lastLatestOk: poll === undefined ? null : poll.ok === 1,
    lastError: poll?.error ?? null,
    tickCount: s.ticks,
    itemCount: s.items,
    spreadPoints: s.spreadPoints,
    baselineCoverage: withBaseline === undefined ? 0 : withBaseline.n,
    // MIN/MAX over an empty table is 0, which is not a timestamp.
    newestTick: s.newestTick === 0 ? null : s.newestTick,
  };
}

export interface SnapshotOptions {
  readonly minVolume24h?: number;
  readonly captureRate?: number;
  readonly maxStalenessSeconds?: number;
  readonly topN?: number;
  /** When true, size trades against the reported cash stack. Ignored if no client is connected. */
  readonly useCash?: boolean;
}

export function buildSnapshot(store: Store, opts: SnapshotOptions, now: number): Snapshot {
  const client = readClientState(store, now, CLIENT_STATE_MAX_AGE_S);

  const config: FilterConfig = {
    ...DEFAULT_FILTER,
    minVolume24h: opts.minVolume24h ?? DEFAULT_FILTER.minVolume24h,
    captureRate: opts.captureRate ?? DEFAULT_FILTER.captureRate,
    maxStalenessSeconds: opts.maxStalenessSeconds ?? DEFAULT_FILTER.maxStalenessSeconds,
    // Cash sizing only applies when a live client actually reported a stack.
    // There is no default bankroll and no way to configure a fictional one.
    cashStack: opts.useCash === true && client !== null ? client.cashStack : null,
  };

  const result = runPipeline(
    {
      quotes: latestQuotesFromStore(store),
      items: store.readItems(),
      volumes: store.readVolumes(),
      spreadHistory: store.readSpreadHistory(now - 7 * 24 * 3600),
      fetchedAt: now,
      now,
    },
    config,
    opts.topN ?? 30, // nofallback-ok: page size, a configuration default, not market data
  );

  return {
    candidates: result.candidates,
    funnel: result.funnel,
    // A sample of what was thrown away, so an empty table is diagnosable rather
    // than merely disappointing.
    rejectionSamples: result.rejections.slice(0, 40).map((r) => ({ name: r.name, reason: r.reason, detail: r.detail })),
    config,
    client,
    feed: feedHealth(store),
  };
}

export function snapshotTsv(snapshot: Snapshot): string {
  return toTsv(snapshot.candidates);
}

/** Accept a model suggestion only if it survives validation against the offered set. */
export function acceptSuggestion(
  store: Store, raw: RawSuggestion, offered: readonly Candidate[], now: number,
): { ok: true; id: number } | { ok: false; errors: readonly string[] } {
  const v = validateSuggestion(raw, offered);
  if (!v.ok) return { ok: false, errors: v.errors };
  const id = logSuggestion(store, {
    itemId: v.suggestion.itemId, action: v.suggestion.action, buyAt: v.suggestion.buyAt,
    sellAt: v.suggestion.sellAt, quantity: v.suggestion.quantity,
    confidence: v.suggestion.confidence, reasoning: v.suggestion.reasoning,
  }, v.candidate, now);
  return { ok: true, id };
}

export function parseClientState(body: unknown, now: number): ClientState | { error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'body must be an object' };
  const b = body as Record<string, unknown>;
  const cash = b['cashStack'];
  if (typeof cash !== 'number' || !Number.isInteger(cash) || cash < 0) {
    return { error: 'cashStack must be a non-negative integer' };
  }
  const inv = Array.isArray(b['inventory']) ? b['inventory'] as ClientState['inventory'] : [];
  const offers = Array.isArray(b['geOffers']) ? b['geOffers'] as ClientState['geOffers'] : [];
  return {
    cashStack: cash,
    inventory: inv,
    geOffers: offers,
    world: typeof b['world'] === 'number' ? b['world'] : null,
    member: b['member'] === true,
    reportedAt: now,
  };
}

/**
 * Record the offer events carried by a client report.
 *
 * The plugin reports on every GrandExchangeOfferChanged as well as on its
 * timer, so most of these are identical to the previous report for that slot;
 * writeOfferEvent keeps only transitions. Returns how many were genuinely new.
 */
export function recordOffers(store: Store, offers: ClientState['geOffers'], now: number): number {
  let written = 0;
  for (const o of offers) {
    const parsed = parseOfferEvent(o, now);
    // A malformed offer is skipped rather than stored with defaults; the rest of
    // the report is still worth keeping.
    if ('error' in parsed) continue;
    if (writeOfferEvent(store, parsed)) written++;
  }
  return written;
}

export interface PositionsView {
  readonly positions: readonly Position[];
  readonly fills: readonly FillStat[];
  readonly connected: boolean;
}

export function positionsView(store: Store, now: number): PositionsView {
  return {
    positions: currentPositions(store, now),
    fills: fillStatistics(store, now - 30 * 24 * 3600),
    connected: readClientState(store, now, CLIENT_STATE_MAX_AGE_S) !== null,
  };
}

export interface OutcomesView {
  readonly outcomes: readonly Outcome[];
  readonly summary: HitRate;
}

export function outcomesView(store: Store, now: number, windowSeconds: number): OutcomesView {
  const outcomes = scoreOutcomes(store, now, windowSeconds);
  return { outcomes, summary: hitRate(outcomes) };
}

export { readSuggestions, writeClientState, readClientState, currentPositions, fillStatistics };
