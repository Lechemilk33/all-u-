/**
 * Seed spread baselines from /timeseries so the z-score means something on day
 * one instead of reading "unknown" for a week.
 */
import { Store, backfillSpreadBaselines } from '../packages/ingest/dist/index.js';

const contact = process.env.FLIP_CONTACT;
if (!contact) { console.error('set FLIP_CONTACT to your email'); process.exit(1); }

const store = new Store(process.env.FLIP_DB ?? 'data/flip.db');
const maxItems = Number(process.env.FLIP_BACKFILL_ITEMS ?? 400);
const delayMs = Number(process.env.FLIP_BACKFILL_DELAY ?? 120);

console.log(`backfilling 1h spread history for the ${maxItems} highest-volume items...`);
const t0 = Date.now();
const res = await backfillSpreadBaselines(store, contact, {
  maxItems, delayMs,
  onProgress: (done, total, name) => {
    if (done % 25 === 0 || done === total) {
      process.stdout.write(`\r  ${done}/${total}  ${name.slice(0, 28).padEnd(28)}`);
    }
  },
});
console.log(`\ndone in ${((Date.now() - t0) / 1000).toFixed(0)}s — ${res.points} baseline points, ${res.failures} failures`);

const covered = store.db.prepare(
  'SELECT COUNT(*) AS n FROM (SELECT item_id FROM spread_history GROUP BY item_id HAVING COUNT(*) >= 24)'
).get();
console.log(`items with a usable baseline (>=24 buckets): ${covered.n}`);
store.close();
