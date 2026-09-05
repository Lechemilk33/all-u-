import type { ItemRef, LatestQuote } from '@flip/core';

const BASE = 'https://prices.runescape.wiki/api/v1/osrs';

/**
 * The API pre-emptively rejects default client user agents — curl/*,
 * python-requests, Java/*, Apache-HttpClient and friends all get a 403 before
 * any rate limiting is considered. A descriptive agent naming the project and a
 * contact address gets a 200. This is the single most common way to lose an
 * afternoon to this API, so it is set once here and nowhere else.
 */
export function userAgent(contact: string): string {
  if (!contact.includes('@') && !contact.startsWith('http')) {
    throw new Error('userAgent: contact must be an email address or URL so the Wiki can reach you');
  }
  return `osrs-flip-finder/0.1 - ${contact}`;
}

export interface FetchResult<T> {
  readonly data: T;
  /** Unix seconds at which we performed the fetch. */
  readonly fetchedAt: number;
}

export class WikiApiError extends Error {
  constructor(readonly status: number, readonly endpoint: string, message: string) {
    super(message);
    this.name = 'WikiApiError';
  }
}

async function get<T>(path: string, ua: string, attempt = 0): Promise<FetchResult<T>> {
  const url = `${BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'User-Agent': ua, Accept: 'application/json' } });
  } catch (cause) {
    if (attempt < 3) return backoff(path, ua, attempt);
    throw new WikiApiError(0, path, `network failure after 4 attempts: ${String(cause)}`);
  }
  if (res.status === 403) {
    throw new WikiApiError(403, path, `403 — the User-Agent "${ua}" was rejected. It must name the project and a contact.`);
  }
  // 429 and 5xx are transient; anything else is a real error and retrying it
  // just delays the report.
  if (res.status === 429 || res.status >= 500) {
    if (attempt < 3) return backoff(path, ua, attempt);
    throw new WikiApiError(res.status, path, `${res.status} after 4 attempts`);
  }
  if (!res.ok) throw new WikiApiError(res.status, path, `unexpected status ${res.status}`);
  return { data: (await res.json()) as T, fetchedAt: Math.floor(Date.now() / 1000) };
}

function backoff<T>(path: string, ua: string, attempt: number): Promise<FetchResult<T>> {
  const wait = 2 ** (attempt + 1) * 1000;
  return new Promise((resolve) => setTimeout(resolve, wait)).then(() => get<T>(path, ua, attempt + 1));
}

interface RawMapping {
  id: number; name: string; members: boolean; limit?: number;
  highalch?: number; lowalch?: number; value?: number; examine?: string; icon?: string;
}
interface RawLatest { data: Record<string, { high: number | null; highTime: number | null; low: number | null; lowTime: number | null }> }
interface RawVolumes { data: Record<string, number> }
interface RawTimeseries {
  data: Array<{ timestamp: number; avgHighPrice: number | null; avgLowPrice: number | null;
                highPriceVolume: number; lowPriceVolume: number }>;
}

export async function fetchMapping(ua: string): Promise<FetchResult<ItemRef[]>> {
  const { data, fetchedAt } = await get<RawMapping[]>('/mapping', ua);
  const items = data.map((m): ItemRef => ({
    id: m.id,
    name: m.name,
    members: m.members,
    // Absent means "we have no evidence of a limit", which is not the same as
    // zero and not the same as unlimited. It stays null all the way through.
    buyLimit: typeof m.limit === 'number' ? m.limit : null,
    highalch: typeof m.highalch === 'number' ? m.highalch : null,
    value: typeof m.value === 'number' ? m.value : null,
    examine: m.examine ?? '',
    icon: m.icon ?? '',
  }));
  return { data: items, fetchedAt };
}

export async function fetchLatest(ua: string): Promise<FetchResult<LatestQuote[]>> {
  const { data, fetchedAt } = await get<RawLatest>('/latest', ua);
  const quotes = Object.entries(data.data).map(([id, d]): LatestQuote => ({
    itemId: Number(id),
    high: d.high, highTime: d.highTime, low: d.low, lowTime: d.lowTime,
  }));
  return { data: quotes, fetchedAt };
}

export async function fetchVolumes(ua: string): Promise<FetchResult<Map<number, number>>> {
  const { data, fetchedAt } = await get<RawVolumes>('/volumes', ua);
  const map = new Map<number, number>();
  for (const [id, v] of Object.entries(data.data)) if (typeof v === 'number') map.set(Number(id), v);
  return { data: map, fetchedAt };
}

export type Timestep = '5m' | '1h' | '6h' | '24h';

/**
 * Per-item history, capped by the API at 365 points. At 1h that is 15 days,
 * which is what the 7-day spread baseline is seeded from on a cold start —
 * otherwise every z-score reads "unknown" for the first week.
 */
export async function fetchTimeseries(
  ua: string, itemId: number, timestep: Timestep,
): Promise<FetchResult<Array<{ timestamp: number; high: number | null; low: number | null }>>> {
  const { data, fetchedAt } = await get<RawTimeseries>(`/timeseries?id=${itemId}&timestep=${timestep}`, ua);
  return {
    fetchedAt,
    data: data.data.map((p) => ({ timestamp: p.timestamp, high: p.avgHighPrice, low: p.avgLowPrice })),
  };
}
