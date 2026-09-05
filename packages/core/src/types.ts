import type { Sources } from './provenance.js';

/** Static reference data, straight from /mapping. */
export interface ItemRef {
  readonly id: number;
  readonly name: string;
  readonly members: boolean;
  /** null when /mapping carries no `limit` field for this item — 516 of them do not. */
  readonly buyLimit: number | null;
  readonly highalch: number | null;
  readonly value: number | null;
  readonly examine: string;
  readonly icon: string;
}

/** One /latest row. Either side may be absent; neither is ever inferred. */
export interface LatestQuote {
  readonly itemId: number;
  /** Last instant-buy price, and when that trade was reported. */
  readonly high: number | null;
  readonly highTime: number | null;
  /** Last instant-sell price, and when that trade was reported. */
  readonly low: number | null;
  readonly lowTime: number | null;
}

/** A fully computed, fully sourced flip candidate. Every field is a real number. */
export interface Candidate {
  readonly item: ItemRef;

  /** Quoted spread, exactly as the feed reported it. */
  readonly quotedBuy: number;
  readonly quotedSell: number;
  /** Prices we actually rank on: quoted, undercut by one coin per leg. */
  readonly buy: number;
  readonly sell: number;

  readonly netMargin: number;
  readonly roi: number;
  readonly volume24h: number;
  readonly absorbable: number;
  readonly tradeableUnits: number;
  readonly limitedBy: 'buy-limit' | 'volume' | 'cash';
  readonly potentialProfit: number;
  readonly capitalRequired: number;

  /** Age of each leg, separately. These are different facts and are never merged. */
  readonly buyAgeSeconds: number;
  readonly sellAgeSeconds: number;
  /** The age that governs staleness: the older of the two legs. */
  readonly stalenessSeconds: number;

  /** null when there is not enough baseline history to compute one honestly. */
  readonly spreadZ: number | null;
  readonly baselineSamples: number;

  readonly score: number;
  readonly sources: Sources;
}

/** Why an item did not become a candidate. Every rejection carries one. */
export type RejectionReason =
  | 'no-buy-side'
  | 'no-sell-side'
  | 'no-mapping-entry'
  | 'no-volume-data'
  | 'stale'
  | 'negative-after-tax'
  | 'below-volume-floor'
  | 'unaffordable'
  | 'malformed';

export interface Rejection {
  readonly itemId: number;
  readonly name: string | null;
  readonly reason: RejectionReason;
  readonly detail: string;
}

export interface FilterConfig {
  /** Max age, in seconds, of the OLDER leg. See candidate.ts for why. */
  readonly maxStalenessSeconds: number;
  readonly minVolume24h: number;
  /** Share of a 4h window's volume you expect to capture. */
  readonly captureRate: number;
  /** Your cash stack, if a client has reported one. Never guessed. */
  readonly cashStack: number | null;
  /** Drop candidates you could not buy at least this many units of. */
  readonly minUnits: number;
}

export const DEFAULT_FILTER: FilterConfig = {
  maxStalenessSeconds: 600,
  minVolume24h: 1000,
  captureRate: 0.2,
  cashStack: null,
  minUnits: 1,
};
