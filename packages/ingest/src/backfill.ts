import { fetchTimeseries, userAgent } from './wiki.js';
import type { Store } from './store.js';

/**
 * Seed the spread baseline from per-item history.
 *
 * Without this, every z-score reads "unknown" until the poller has banked a
 * week of live observations — which means the anomaly signal, one of the few
 * things that actually distinguishes a stale quote from an opportunity, is
 * missing for exactly the period when you are most likely to be experimenting.
 *
 * /timeseries returns at most 365 points, so a 1h timestep covers ~15 days. One
 * call per item, rate limited, run once. Items are visited in descending volume
 * order so that if it is interrupted, the items you would actually trade have
 * baselines and the tail does not.
 */
export async function backfillSpreadBaselines(
  store: Store,
  contact: string,
  opts: { maxItems: number; delayMs: number; onProgress?: (done: number, total: number, name: string) => void },
): Promise<{ items: number; points: number; failures: number }> {
  const ua = userAgent(contact);
  const targets = store.db.prepare(`
    SELECT v.item_id AS id, COALESCE(i.name,'?') AS name
    FROM volumes v LEFT JOIN items i ON i.id = v.item_id
    ORDER BY v.volume_24h DESC LIMIT ?
  `).all(opts.maxItems) as Array<{ id: number; name: string }>;

  let points = 0, failures = 0, done = 0;
  for (const t of targets) {
    try {
      const { data } = await fetchTimeseries(ua, t.id, '1h');
      const rows: Array<{ itemId: number; bucketAt: number; spread: number }> = [];
      for (const p of data) {
        // A bucket missing either side has no spread. It is skipped, not
        // interpolated — an invented baseline point is worse than a short one.
        if (p.high === null || p.low === null) continue;
        rows.push({ itemId: t.id, bucketAt: p.timestamp, spread: p.high - p.low });
      }
      points += store.writeSpreadPoints(rows, 'backfill');
    } catch {
      failures++;
    }
    done++;
    opts.onProgress?.(done, targets.length, t.name);
    if (opts.delayMs > 0) await new Promise((r) => setTimeout(r, opts.delayMs));
  }
  return { items: targets.length, points, failures };
}
