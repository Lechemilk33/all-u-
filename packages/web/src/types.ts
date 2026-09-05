export interface ItemRef {
  id: number; name: string; members: boolean; buyLimit: number | null;
  highalch: number | null; value: number | null; examine: string; icon: string;
}

export interface Candidate {
  item: ItemRef;
  quotedBuy: number; quotedSell: number; buy: number; sell: number;
  netMargin: number; roi: number; volume24h: number; absorbable: number;
  tradeableUnits: number; limitedBy: 'buy-limit' | 'volume' | 'cash';
  potentialProfit: number; capitalRequired: number;
  buyAgeSeconds: number; sellAgeSeconds: number; stalenessSeconds: number;
  spreadZ: number | null; baselineSamples: number; score: number;
  sources: { observations: Array<{ endpoint: string; fetchedAt: number; sourceAt: number }>; derivedBy: string[] };
}

export interface FeedHealth {
  lastLatestPoll: number | null; lastLatestOk: boolean | null; lastError: string | null;
  tickCount: number; itemCount: number; spreadPoints: number;
  baselineCoverage: number; newestTick: number | null;
}

export interface ClientState {
  cashStack: number;
  inventory: Array<{ id: number; quantity: number }>;
  geOffers: Array<{ slot: number; itemId: number; state: string; price: number; totalQuantity: number; quantitySold: number }>;
  world: number | null; member: boolean; reportedAt: number;
}

export interface Snapshot {
  candidates: Candidate[];
  funnel: Record<string, number>;
  rejectionSamples: Array<{ name: string | null; reason: string; detail: string }>;
  config: { minVolume24h: number; captureRate: number; maxStalenessSeconds: number; cashStack: number | null };
  client: ClientState | null;
  feed: FeedHealth;
}

export interface ItemDetail {
  item: Record<string, unknown> | null;
  ticks: Array<{ side: 'high' | 'low'; price: number; sourceAt: number }>;
  spreads: Array<{ bucketAt: number; spread: number; origin: string }>;
  volume: { volume24h: number; fetchedAt: number } | null;
}
