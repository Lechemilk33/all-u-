/**
 * Stands in for the RuneLite plugin during development.
 *
 * This posts the same payloads the plugin posts, so the tracking chain and the
 * positions UI can be exercised without a game client attached. It is a
 * development harness, not a data source: it takes its item ids and prices from
 * the live candidate set rather than inventing them, and it writes only through
 * the same public endpoint the plugin uses.
 */
const BASE = process.env.FLIP_URL ?? 'http://127.0.0.1:8787';

const post = async (body) => {
  const res = await fetch(`${BASE}/api/client-state`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  return res.json();
};

const snap = await (await fetch(`${BASE}/api/candidates?minVol=100000&top=4`)).json();
if (snap.candidates.length < 3) {
  console.error('not enough live candidates to simulate against');
  process.exit(1);
}
const [a, b, c] = snap.candidates;
console.log('simulating offers against live candidates:');
for (const x of [a, b, c]) console.log(`  ${x.item.name} (#${x.item.id}) buy ${x.buy} sell ${x.sell}`);

const CASH = 50_000_000;
const qty = (x) => Math.min(x.tradeableUnits, 500);

const frame = (offers) => post({ cashStack: CASH, inventory: [], geOffers: offers, world: 330, member: true });

// A buy offer opening, filling in two steps below the ask, then completing.
const buying = (x, sold, spent, state = 'BUYING') => ({
  slot: 0, itemId: x.item.id, state, price: x.buy,
  totalQuantity: qty(x), quantitySold: sold, spent,
});
// A sell offer that fills fully.
const selling = (x, sold, spent, state = 'SELLING') => ({
  slot: 1, itemId: x.item.id, state, price: x.sell,
  totalQuantity: qty(x), quantitySold: sold, spent,
});
// A third offer that opens and then never progresses — the undercut case.
const stalled = (x) => ({
  slot: 2, itemId: x.item.id, state: 'BUYING', price: x.buy,
  totalQuantity: qty(x), quantitySold: Math.floor(qty(x) * 0.12),
  spent: Math.floor(qty(x) * 0.12 * (x.buy - 2)),
});

const nA = qty(a), nB = qty(b);
const steps = [
  [buying(a, 0, 0), stalled(c)],
  [buying(a, Math.floor(nA * 0.35), Math.floor(nA * 0.35 * (a.buy - 3))), stalled(c)],
  [buying(a, nA, nA * (a.buy - 2), 'BOUGHT'), stalled(c)],
  [buying(a, nA, nA * (a.buy - 2), 'BOUGHT'), selling(b, 0, 0), stalled(c)],
  [buying(a, nA, nA * (a.buy - 2), 'BOUGHT'), selling(b, nB, nB * b.sell, 'SOLD'), stalled(c)],
];

for (const [i, offers] of steps.entries()) {
  const r = await frame(offers);
  console.log(`  step ${i + 1}: ${r.offerEvents} new offer event(s)`);
  await new Promise((r2) => setTimeout(r2, 350));
}

const view = await (await fetch(`${BASE}/api/positions`)).json();
console.log(`\nconnected: ${view.connected}`);
console.log(`positions: ${view.positions.length}, fill stats: ${view.fills.length}`);
for (const p of view.positions) {
  console.log(`  slot ${p.slot}  ${String(p.name).padEnd(24)} ${p.state.padEnd(8)} ` +
    `${p.quantityFilled}/${p.totalQuantity}  ask=${p.offerPrice}  realised=${p.realisedUnitPrice ?? 'none'}  ` +
    `stalled=${p.stalledSeconds}s`);
}
for (const f of view.fills) {
  console.log(`  fill stat: ${f.name} ${f.side} n=${f.completedOffers} median=${f.medianSecondsToFill}s @ ${f.medianRealisedPrice}gp`);
}
