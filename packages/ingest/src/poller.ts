import { fetchLatest, fetchMapping, fetchVolumes, userAgent } from './wiki.js';
import { Store } from './store.js';

export interface PollerOptions {
  readonly dbPath: string;
  readonly contact: string;
  /** /latest cadence. The feed itself updates continuously. */
  readonly latestIntervalMs: number;
  /** /volumes and /mapping change slowly; polling them hard is pure waste. */
  readonly volumesIntervalMs: number;
  readonly mappingIntervalMs: number;
}

export const DEFAULT_POLLER: Omit<PollerOptions, 'dbPath' | 'contact'> = {
  latestIntervalMs: 45_000,
  volumesIntervalMs: 15 * 60_000,
  mappingIntervalMs: 24 * 60 * 60_000,
};

/**
 * The ingest loop.
 *
 * Each endpoint runs on its own timer rather than in one combined tick, so a
 * slow /mapping fetch cannot delay a /latest poll. Failures are logged to
 * poll_log and the loop continues: a Wiki outage should degrade the product to
 * "stale, and saying so", never to "dead".
 */
export class Poller {
  private readonly store: Store;
  private readonly ua: string;
  private readonly timers: NodeJS.Timeout[] = [];
  private running = false;

  constructor(private readonly opts: PollerOptions) {
    this.store = new Store(opts.dbPath);
    this.ua = userAgent(opts.contact);
  }

  getStore(): Store { return this.store; }

  async start(): Promise<void> {
    this.running = true;
    await this.pollMapping();
    await this.pollVolumes();
    await this.pollLatest();
    // `running` gates only the scheduled path, so that a poll already in flight
    // when stop() lands does not write afterwards. Direct calls — the verifier,
    // the tests, the /api/poll route — are always allowed to run.
    const scheduled = (fn: () => Promise<void>) => () => { if (this.running) void fn(); };
    this.timers.push(setInterval(scheduled(() => this.pollLatest()), this.opts.latestIntervalMs));
    this.timers.push(setInterval(scheduled(() => this.pollVolumes()), this.opts.volumesIntervalMs));
    this.timers.push(setInterval(scheduled(() => this.pollMapping()), this.opts.mappingIntervalMs));
  }

  stop(): void {
    this.running = false;
    for (const t of this.timers) clearInterval(t);
    this.timers.length = 0;
  }

  async pollLatest(): Promise<void> {
    try {
      const { data, fetchedAt } = await fetchLatest(this.ua);
      const written = this.store.writeTicks(data, fetchedAt);
      this.recordSpreads(data, fetchedAt);
      this.store.logPoll('latest', fetchedAt, data.length, written, true);
    } catch (err) {
      this.store.logPoll('latest', Math.floor(Date.now() / 1000), 0, 0, false, String(err));
    }
  }

  async pollVolumes(): Promise<void> {
    try {
      const { data, fetchedAt } = await fetchVolumes(this.ua);
      this.store.writeVolumes(data, fetchedAt);
      this.store.logPoll('volumes', fetchedAt, data.size, data.size, true);
    } catch (err) {
      this.store.logPoll('volumes', Math.floor(Date.now() / 1000), 0, 0, false, String(err));
    }
  }

  async pollMapping(): Promise<void> {
    try {
      const { data, fetchedAt } = await fetchMapping(this.ua);
      const n = this.store.upsertItems(data, fetchedAt);
      this.store.logPoll('mapping', fetchedAt, data.length, n, true);
    } catch (err) {
      this.store.logPoll('mapping', Math.floor(Date.now() / 1000), 0, 0, false, String(err));
    }
  }

  /**
   * Bank one spread observation per item per hour, for the z-score baseline.
   * Only items with both legs fresh contribute — a spread measured against a
   * stale leg would poison the very baseline used to detect stale legs.
   */
  private recordSpreads(quotes: Awaited<ReturnType<typeof fetchLatest>>['data'], fetchedAt: number): void {
    const bucket = Math.floor(fetchedAt / 3600) * 3600;
    const points: Array<{ itemId: number; bucketAt: number; spread: number }> = [];
    for (const q of quotes) {
      if (q.high === null || q.low === null || q.highTime === null || q.lowTime === null) continue;
      const staleness = fetchedAt - Math.min(q.highTime, q.lowTime);
      if (staleness > 3600) continue;
      points.push({ itemId: q.itemId, bucketAt: bucket, spread: q.high - q.low });
    }
    this.store.writeSpreadPoints(points, 'live');
  }
}
