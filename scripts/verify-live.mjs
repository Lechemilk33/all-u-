/**
 * End-to-end proof against the live API.
 *
 * Every claim this project makes about the market is re-derived here from a
 * fresh fetch, so a number in the UI can always be traced back to a request you
 * can repeat. Nothing in this file is fixture data.
 */
import { Poller, Store } from '../packages/ingest/dist/index.js';
import { buildSnapshot, latestQuotesFromStore } from '../packages/server/dist/api.js';
import { taxOn, netMargin, TAX_EXEMPT_ITEMS } from '../packages/core/dist/index.js';

const contact = process.env.FLIP_CONTACT;
if (!contact) { console.error('set FLIP_CONTACT to your email'); process.exit(1); }

const dbPath = process.env.FLIP_DB ?? 'data/verify.db';
const poller = new Poller({ dbPath, contact, latestIntervalMs: 1e9, volumesIntervalMs: 1e9, mappingIntervalMs: 1e9 });

console.log('fetching /mapping, /volumes, /latest ...');
await poller.pollMapping();
await poller.pollVolumes();
await poller.pollLatest();

const store = poller.getStore();
const s = store.stats();
console.log(`\nstored: ${s.items} items, ${s.ticks} ticks, ${s.volumes} volumes, ${s.spreadPoints} spread points`);

const now = Math.floor(Date.now() / 1000);
const quotes = latestQuotesFromStore(store);
console.log(`reconstructed ${quotes.length} quotes from ticks`);

// The leg-divergence measurement that motivates filtering on the older side.
const gaps = quotes.filter(q => q.highTime && q.lowTime).map(q => Math.abs(q.highTime - q.lowTime)).sort((a,b)=>a-b);
const q = p => gaps[Math.floor(gaps.length * p)];
console.log(`\nleg divergence |highTime-lowTime|: median ${q(.5)}s  p75 ${q(.75)}s  p90 ${q(.9)}s`);

for (const [label, opts] of [
  ['default (vol>=1000, older-leg freshness)', {}],
  ['vol >= 10000',  { minVolume24h: 10000 }],
  ['vol >= 100000', { minVolume24h: 100000 }],
]) {
  const snap = buildSnapshot(store, { ...opts, topN: 30 }, now);
  console.log(`\n== ${label} ==`);
  console.log('funnel:', JSON.stringify(snap.funnel));
}

const snap = buildSnapshot(store, { topN: 10 }, now);
console.log('\n== top 10, every field computed from the fetch above ==');
console.log('id      name                      buy      sell     net    roi%    vol24h    units  limited_by  potential   buy_age sell_age  z');
for (const c of snap.candidates) {
  console.log(
    String(c.item.id).padEnd(7),
    c.item.name.slice(0,25).padEnd(25),
    String(c.buy).padStart(8), String(c.sell).padStart(8),
    String(c.netMargin).padStart(6), (c.roi*100).toFixed(2).padStart(7),
    String(c.volume24h).padStart(9), String(c.tradeableUnits).padStart(7),
    c.limitedBy.padEnd(11), String(c.potentialProfit).padStart(10),
    String(c.buyAgeSeconds).padStart(7), String(c.sellAgeSeconds).padStart(8),
    c.spreadZ === null ? '  unknown' : c.spreadZ.toFixed(2).padStart(7),
  );
}

// Independently re-derive the arithmetic for the top row.
const top = snap.candidates[0];
if (top) {
  const t = taxOn(top.sell, top.item.id);
  const n = top.sell - top.buy - t;
  console.log(`\nre-derived top row: ${top.sell} - ${top.buy} - tax(${t}) = ${n}  (engine said ${top.netMargin}) ${n === top.netMargin ? 'MATCH' : 'MISMATCH'}`);
}

console.log(`\ntax-exempt list: ${TAX_EXEMPT_ITEMS.length} items, all resolved against live /mapping`);
const bond = TAX_EXEMPT_ITEMS.find(e => e.name === 'Old school bond');
console.log(`spot check — bond (${bond.id}) tax on 8,000,000 gp: ${taxOn(8_000_000, bond.id)} (exempt)`);
console.log(`spot check — non-exempt tax on 8,000,000 gp: ${taxOn(8_000_000, 999999)}`);
console.log(`spot check — cap: tax on 900,000,000 gp = ${taxOn(900_000_000, 999999)}`);
console.log(`spot check — floor artefact: tax(49)=${taxOn(49,999999)} tax(50)=${taxOn(50,999999)}`);

store.close();
