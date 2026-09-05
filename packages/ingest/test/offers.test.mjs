import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  Store, parseOfferEvent, writeOfferEvent, currentPositions, fillStatistics,
} from '../dist/index.js';

const freshStore = () => new Store(join(mkdtempSync(join(tmpdir(), 'flip-')), 'test.db'));

const T0 = 1_700_000_000;
const offer = (over = {}) => ({
  slot: 0, itemId: 573, state: 'BUYING', price: 1466,
  totalQuantity: 100, quantitySold: 0, spent: 0, ...over,
});

test('a well-formed offer parses with every field intact', () => {
  const e = parseOfferEvent(offer(), T0);
  assert.ok(!('error' in e));
  assert.equal(e.itemId, 573);
  assert.equal(e.state, 'BUYING');
  assert.equal(e.observedAt, T0);
});

test('malformed offers are rejected with a reason, not defaulted', () => {
  const cases = [
    [offer({ state: 'PENDING' }), /not a GrandExchangeOfferState/],
    [offer({ quantitySold: 500 }), /exceeds totalQuantity/],
    [offer({ price: -1 }), /non-negative integers/],
    [offer({ slot: 'one' }), /slot must be/],
    ['not an object', /must be an object/],
  ];
  for (const [input, re] of cases) {
    const r = parseOfferEvent(input, T0);
    assert.ok('error' in r, `should reject: ${JSON.stringify(input)}`);
    assert.match(r.error, re);
  }
});

test('only transitions are stored, so repeats of an unchanged slot are no-ops', () => {
  const s = freshStore();
  const e = parseOfferEvent(offer(), T0);
  assert.equal(writeOfferEvent(s, e), true);
  assert.equal(writeOfferEvent(s, { ...e, observedAt: T0 + 5 }), false, 'identical report must not write');
  assert.equal(writeOfferEvent(s, { ...e, quantitySold: 10, spent: 14_650, observedAt: T0 + 6 }), true);
  const n = s.db.prepare('SELECT COUNT(*) AS n FROM ge_offer_events').get().n;
  assert.equal(n, 2);
  s.close();
});

test('a partially filled offer reports real progress and a realised price', () => {
  const s = freshStore();
  s.upsertItems([{ id: 573, name: 'Air orb', members: true, buyLimit: 11000,
    highalch: null, value: null, examine: '', icon: '' }], T0);

  writeOfferEvent(s, parseOfferEvent(offer(), T0));
  // Filled 40 of 100, and note the fill came in BELOW the 1466 ask.
  writeOfferEvent(s, parseOfferEvent(offer({ quantitySold: 40, spent: 58_400 }), T0 + 120));

  const [p] = currentPositions(s, T0 + 180);
  assert.equal(p.name, 'Air orb');
  assert.equal(p.side, 'buy');
  assert.equal(p.quantityFilled, 40);
  assert.equal(p.fillFraction, 0.4);
  // 58400/40 = 1460, cheaper than the 1466 asked. The ask is not the cost basis.
  assert.equal(p.realisedUnitPrice, 1460);
  assert.notEqual(p.realisedUnitPrice, p.offerPrice);
  assert.equal(p.complete, false);
  assert.equal(p.ageSeconds, 180);
  s.close();
});

test('nothing filled means no realised price, not a price of zero', () => {
  const s = freshStore();
  writeOfferEvent(s, parseOfferEvent(offer(), T0));
  const [p] = currentPositions(s, T0 + 60);
  assert.equal(p.realisedUnitPrice, null);
  assert.equal(p.quantityFilled, 0);
  s.close();
});

test('an offer with no fill progress reports the stall, which is how undercuts surface', () => {
  const s = freshStore();
  writeOfferEvent(s, parseOfferEvent(offer(), T0));
  writeOfferEvent(s, parseOfferEvent(offer({ quantitySold: 5, spent: 7330 }), T0 + 30));

  const [p] = currentPositions(s, T0 + 30 + 1800);
  assert.ok(p.stalledSeconds >= 1800, `expected a long stall, got ${p.stalledSeconds}`);
  assert.equal(p.quantityFilled, 5);
  s.close();
});

test('an empty slot is not a position', () => {
  const s = freshStore();
  writeOfferEvent(s, parseOfferEvent(offer(), T0));
  writeOfferEvent(s, parseOfferEvent(offer({ state: 'EMPTY', price: 0, totalQuantity: 0, itemId: 0 }), T0 + 60));
  assert.equal(currentPositions(s, T0 + 90).length, 0);
  s.close();
});

test('terminal states are marked complete and keep their side', () => {
  const s = freshStore();
  for (const [state, side] of [['BOUGHT', 'buy'], ['SOLD', 'sell'],
    ['CANCELLED_BUY', 'buy'], ['CANCELLED_SELL', 'sell']]) {
    const st = freshStore();
    writeOfferEvent(st, parseOfferEvent(offer({ state, quantitySold: 100, spent: 146_600 }), T0));
    const [p] = currentPositions(st, T0 + 10);
    assert.equal(p.complete, true, state);
    assert.equal(p.side, side, state);
    st.close();
  }
  s.close();
});

test('time-to-fill is measured from your own completed offers', () => {
  const s = freshStore();
  s.upsertItems([{ id: 573, name: 'Air orb', members: true, buyLimit: 11000,
    highalch: null, value: null, examine: '', icon: '' }], T0);

  // Two complete buy cycles in the same slot, 600s and 300s to fill.
  writeOfferEvent(s, parseOfferEvent(offer(), T0));
  writeOfferEvent(s, parseOfferEvent(offer({ state: 'BOUGHT', quantitySold: 100, spent: 146_000 }), T0 + 600));
  writeOfferEvent(s, parseOfferEvent(offer({ state: 'EMPTY', itemId: 0, price: 0, totalQuantity: 0 }), T0 + 610));
  writeOfferEvent(s, parseOfferEvent(offer(), T0 + 700));
  writeOfferEvent(s, parseOfferEvent(offer({ state: 'BOUGHT', quantitySold: 100, spent: 148_000 }), T0 + 1000));

  const stats = fillStatistics(s, T0 - 1);
  const airOrb = stats.find((f) => f.itemId === 573 && f.side === 'buy');
  assert.ok(airOrb, 'expected a buy-side stat for Air orb');
  assert.equal(airOrb.completedOffers, 2);
  assert.equal(airOrb.medianSecondsToFill, 450);   // mean of 600 and 300
  assert.equal(airOrb.medianRealisedPrice, 1470);  // mean of 1460 and 1480
  s.close();
});

test('an item you have never completed yields no stat rather than an estimate', () => {
  const s = freshStore();
  writeOfferEvent(s, parseOfferEvent(offer(), T0));
  assert.equal(fillStatistics(s, T0 - 1).length, 0);
  s.close();
});
