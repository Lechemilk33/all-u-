import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  taxOn, netMargin, TAX_EXEMPT_IDS, TAX_EXEMPT_ITEMS, TAX_CAP_PER_ITEM,
  realisticFill, absorbableUnits, tradeableUnits, spreadZScore, MIN_BASELINE_SAMPLES,
  buildCandidate, score, runPipeline, toTsv, validateSuggestion, DEFAULT_FILTER,
} from '../dist/index.js';

const NON_EXEMPT = 999999;

// ------------------------------------------------------------------- tax

test('tax is 2% of the sale price, floored', () => {
  assert.equal(taxOn(1000, NON_EXEMPT), 20);
  assert.equal(taxOn(1001, NON_EXEMPT), 20);   // 20.02 floors to 20
  assert.equal(taxOn(149, NON_EXEMPT), 2);     // 2.98 floors to 2
});

test('the sub-50gp exemption falls out of the floor and is not hard-coded', () => {
  // Encoding "50" as a constant would break silently on the next rate change;
  // the floor gives the same answer and keeps giving the right one.
  assert.equal(taxOn(49, NON_EXEMPT), 0);
  assert.equal(taxOn(50, NON_EXEMPT), 1);
  for (let p = 0; p < 50; p++) assert.equal(taxOn(p, NON_EXEMPT), 0);
});

test('tax is capped at 5m per item', () => {
  assert.equal(taxOn(250_000_000, NON_EXEMPT), TAX_CAP_PER_ITEM);
  assert.equal(taxOn(900_000_000, NON_EXEMPT), TAX_CAP_PER_ITEM);
  assert.equal(taxOn(249_999_950, NON_EXEMPT), 4_999_999);
});

test('exempt items are charged nothing at any price', () => {
  const bond = TAX_EXEMPT_ITEMS.find((e) => e.name === 'Old school bond');
  assert.ok(bond, 'bond must be in the exempt list');
  assert.equal(taxOn(8_000_000, bond.id), 0);
  assert.equal(taxOn(1, bond.id), 0);
});

test('the exempt list resolved every wiki entry to a real mapping id', () => {
  assert.equal(TAX_EXEMPT_ITEMS.length, 48);
  assert.equal(TAX_EXEMPT_IDS.size, 48);
  for (const e of TAX_EXEMPT_ITEMS) {
    assert.ok(Number.isInteger(e.id) && e.id > 0, `${e.name} has a real id`);
    assert.ok(e.name.length > 0);
  }
});

test('exemption is worth the whole margin on cheap items', () => {
  const tele = TAX_EXEMPT_ITEMS.find((e) => e.name === 'Varrock teleport (tablet)');
  assert.equal(netMargin(580, 591, tele.id), 11);        // exempt: full spread
  assert.equal(netMargin(580, 591, NON_EXEMPT), 11 - 11); // taxed: nothing left
});

test('taxOn refuses nonsense rather than returning a number', () => {
  assert.throws(() => taxOn(NaN, NON_EXEMPT), RangeError);
  assert.throws(() => taxOn(-1, NON_EXEMPT), RangeError);
});

// --------------------------------------------------------------- metrics

test('realistic fill undercuts both legs by one coin', () => {
  assert.deepEqual(realisticFill(100, 110), { buy: 101, sell: 109 });
});

test('absorbable units scale a 24h volume to one 4h window', () => {
  assert.equal(absorbableUnits(2400, 1), 400);      // 4/24 of 2400
  assert.equal(absorbableUnits(2400, 0.25), 100);
  assert.throws(() => absorbableUnits(100, 0), RangeError);
  assert.throws(() => absorbableUnits(100, 1.5), RangeError);
});

test('position size takes the tightest of limit, volume and cash', () => {
  const base = { buyLimit: 1000, absorbable: 500, buyPrice: 10, cashStack: null };
  assert.deepEqual(tradeableUnits(base), { units: 500, limitedBy: 'volume' });
  assert.deepEqual(tradeableUnits({ ...base, absorbable: 5000 }), { units: 1000, limitedBy: 'buy-limit' });
  assert.deepEqual(tradeableUnits({ ...base, absorbable: 5000, cashStack: 3000 }), { units: 300, limitedBy: 'cash' });
});

test('a missing buy limit is not a constraint and never reads as unlimited', () => {
  // Volume always binds, so limitedBy always names something real.
  const r = tradeableUnits({ buyLimit: null, absorbable: 700, buyPrice: 5, cashStack: null });
  assert.deepEqual(r, { units: 700, limitedBy: 'volume' });
});

test('no cash report means the affordability limit is simply not applied', () => {
  const r = tradeableUnits({ buyLimit: 100, absorbable: 100, buyPrice: 1_000_000_000, cashStack: null });
  assert.equal(r.units, 100);
  assert.notEqual(r.limitedBy, 'cash');
});

// ------------------------------------------------------------- z-scores

test('a z-score is null, never zero, below the sample threshold', () => {
  assert.equal(spreadZScore(10, []), null);
  assert.equal(spreadZScore(10, new Array(MIN_BASELINE_SAMPLES - 1).fill(5)), null);
});

test('a z-score is null when the baseline has no variance', () => {
  assert.equal(spreadZScore(10, new Array(50).fill(5)), null);
});

test('a z-score is computed once there is enough history', () => {
  const history = [...new Array(30)].map((_, i) => 10 + (i % 5));
  const z = spreadZScore(30, history);
  assert.ok(typeof z === 'number' && z > 1, `expected a wide positive z, got ${z}`);
});

// ------------------------------------------------------------ candidates

const ITEM = {
  id: 4151, name: 'Abyssal whip', members: true, buyLimit: 70,
  highalch: 72000, value: 120001, examine: 'A weapon from the abyss.', icon: '',
};
const NOW = 1_700_000_000;

const input = (over = {}) => ({
  quote: { itemId: 4151, high: 1_600_000, highTime: NOW - 30, low: 1_550_000, lowTime: NOW - 40 },
  item: ITEM, volume24h: 12000, spreadHistory: [], fetchedAt: NOW, now: NOW, ...over,
});

test('a healthy quote becomes a candidate with every field computed', () => {
  const r = buildCandidate(input(), DEFAULT_FILTER);
  assert.ok(r.ok, r.ok ? '' : r.rejection.detail);
  const c = r.candidate;
  assert.equal(c.buy, 1_550_001);
  assert.equal(c.sell, 1_599_999);
  assert.equal(c.netMargin, 1_599_999 - 1_550_001 - Math.floor(1_599_999 * 0.02));
  assert.equal(c.spreadZ, null, 'no baseline yet');
  assert.ok(c.sources.observations.length >= 4);
  for (const v of [c.roi, c.potentialProfit, c.capitalRequired, c.score]) {
    assert.ok(Number.isFinite(v));
  }
});

test('staleness is judged on the OLDER leg, not the newer one', () => {
  // Fresh buy leg, 40-minute-old sell leg. Testing the newer leg would admit
  // this row; across the live feed that shape is the median case, not an edge.
  const r = buildCandidate(
    input({ quote: { itemId: 4151, high: 1_600_000, highTime: NOW - 2400, low: 1_550_000, lowTime: NOW - 5 } }),
    DEFAULT_FILTER,
  );
  assert.equal(r.ok, false);
  assert.equal(r.rejection.reason, 'stale');
  assert.match(r.rejection.detail, /older leg is 2400s/);
});

test('every missing input yields a reason, never a default', () => {
  const cases = [
    [{ item: undefined }, 'no-mapping-entry'],
    [{ volume24h: undefined }, 'no-volume-data'],
    [{ quote: { itemId: 1, high: 100, highTime: NOW, low: null, lowTime: null } }, 'no-sell-side'],
    [{ quote: { itemId: 1, high: null, highTime: null, low: 100, lowTime: NOW } }, 'no-buy-side'],
  ];
  for (const [over, reason] of cases) {
    const r = buildCandidate(input(over), DEFAULT_FILTER);
    assert.equal(r.ok, false, `${reason} should reject`);
    assert.equal(r.rejection.reason, reason);
    assert.ok(r.rejection.detail.length > 0, 'rejection must explain itself');
  }
});

test('a spread that does not survive tax is rejected', () => {
  const r = buildCandidate(
    input({ quote: { itemId: 4151, high: 1001, highTime: NOW, low: 1000, lowTime: NOW } }),
    DEFAULT_FILTER,
  );
  assert.equal(r.ok, false);
  assert.equal(r.rejection.reason, 'negative-after-tax');
});

test('cash sizing can reject a flip you cannot afford', () => {
  const r = buildCandidate(input(), { ...DEFAULT_FILTER, cashStack: 1000, minUnits: 1 });
  assert.equal(r.ok, false);
  assert.equal(r.rejection.reason, 'unaffordable');
});

test('secondary signals can only ever push a row down the ranking', () => {
  const best = { pot: 1e6, roi: 0.05, volume24h: 1e6, stalenessSeconds: 0, spreadZ: 0 };
  const top = score(best);
  for (const worse of [
    { ...best, stalenessSeconds: 600 },
    { ...best, volume24h: 100 },
    { ...best, spreadZ: 5 },
    { ...best, spreadZ: null },
    { ...best, roi: 3 },
  ]) {
    assert.ok(score(worse) <= top, `penalty raised the score: ${JSON.stringify(worse)}`);
  }
});

// --------------------------------------------------------------- pipeline

test('the pipeline counts its own funnel', () => {
  const quotes = [
    { itemId: 4151, high: 1_600_000, highTime: NOW - 10, low: 1_550_000, lowTime: NOW - 20 },
    { itemId: 4151 + 1, high: 100, highTime: NOW - 99999, low: 90, lowTime: NOW - 5 },
  ];
  const r = runPipeline({
    quotes,
    items: new Map([[4151, ITEM], [4152, { ...ITEM, id: 4152 }]]),
    volumes: new Map([[4151, 12000], [4152, 12000]]),
    spreadHistory: new Map(), fetchedAt: NOW, now: NOW,
  }, DEFAULT_FILTER, 10);
  assert.equal(r.funnel.input, 2);
  assert.equal(r.funnel.survived, 1);
  assert.equal(r.funnel.stale, 1);
  assert.equal(r.rejections.length, 1);
});

test('TSV spells out an absent z-score so it cannot read as zero', () => {
  const r = buildCandidate(input(), DEFAULT_FILTER);
  const tsv = toTsv([r.candidate]);
  const [header, row] = tsv.split('\n');
  assert.ok(header.startsWith('item_id\tname\t'));
  assert.ok(row.endsWith('\tunknown'), `expected trailing "unknown", got: ${row}`);
});

// ------------------------------------------------------------- membership

const F2P_ITEM = { ...ITEM, id: 1381, name: 'Staff of air', members: false };

test('a free world filter drops members items with a reason', () => {
  const r = buildCandidate(input(), { ...DEFAULT_FILTER, membership: 'f2p' });
  assert.equal(r.ok, false);
  assert.equal(r.rejection.reason, 'members-only');
  assert.match(r.rejection.detail, /cannot be traded on a free world/);
});

test('a free world filter keeps free-to-play items', () => {
  const r = buildCandidate(
    input({ item: F2P_ITEM, quote: { itemId: 1381, high: 1_600_000, highTime: NOW - 30, low: 1_550_000, lowTime: NOW - 40 } }),
    { ...DEFAULT_FILTER, membership: 'f2p' },
  );
  assert.ok(r.ok, r.ok ? '' : r.rejection.detail);
  assert.equal(r.candidate.item.members, false);
});

test('a members filter drops free-to-play items', () => {
  const r = buildCandidate(
    input({ item: F2P_ITEM, quote: { itemId: 1381, high: 1_600_000, highTime: NOW - 30, low: 1_550_000, lowTime: NOW - 40 } }),
    { ...DEFAULT_FILTER, membership: 'members' },
  );
  assert.equal(r.ok, false);
  assert.equal(r.rejection.reason, 'f2p-only');
});

test('the default keeps both, so nothing is hidden unless asked', () => {
  assert.equal(DEFAULT_FILTER.membership, 'any');
  assert.ok(buildCandidate(input(), DEFAULT_FILTER).ok);
  assert.ok(buildCandidate(
    input({ item: F2P_ITEM, quote: { itemId: 1381, high: 1_600_000, highTime: NOW - 30, low: 1_550_000, lowTime: NOW - 40 } }),
    DEFAULT_FILTER,
  ).ok);
});

test('membership is judged before pricing, so the reason is the useful one', () => {
  // A members item that is also stale should report the membership rejection:
  // on a free world it is not a flip at all, stale or not.
  const r = buildCandidate(
    input({ quote: { itemId: 4151, high: 1_600_000, highTime: NOW - 99999, low: 1_550_000, lowTime: NOW - 5 } }),
    { ...DEFAULT_FILTER, membership: 'f2p' },
  );
  assert.equal(r.ok, false);
  assert.equal(r.rejection.reason, 'members-only');
});

// -------------------------------------------------------------- validator

const offered = (() => {
  const r = buildCandidate(input(), DEFAULT_FILTER);
  assert.ok(r.ok);
  return [r.candidate];
})();

const good = {
  item_id: 4151, action: 'buy', buy_at: 1_560_000, sell_at: 1_590_000,
  qty: 70, confidence: 0.7, reasoning: 'deep book, both legs fresh',
};

test('a suggestion inside the offered row is accepted', () => {
  const v = validateSuggestion(good, offered);
  assert.ok(v.ok, v.ok ? '' : v.errors.join('; '));
  assert.equal(v.suggestion.itemId, 4151);
});

test('an item the model was never offered is refused', () => {
  const v = validateSuggestion({ ...good, item_id: 12345 }, offered);
  assert.equal(v.ok, false);
  assert.match(v.errors[0], /not in the candidate set/);
});

test('a name that disagrees with /mapping is refused', () => {
  // This is the check that catches a table calling id 21326 "Nature impling jar"
  // when the feed says it is "Amethyst arrow".
  const v = validateSuggestion({ ...good, name: 'Nature impling jar' }, offered);
  assert.equal(v.ok, false);
  assert.match(v.errors[0], /does not match \/mapping name/);
});

test('prices outside the observed spread are refused', () => {
  const v = validateSuggestion({ ...good, buy_at: 1, sell_at: 99_999_999 }, offered);
  assert.equal(v.ok, false);
  assert.equal(v.errors.length, 2);
  for (const e of v.errors) assert.match(e, /outside the observed spread/);
});

test('a quantity beyond the permitted units is refused', () => {
  const v = validateSuggestion({ ...good, qty: 10_000_000 }, offered);
  assert.equal(v.ok, false);
  assert.match(v.errors[0], /exceeds the \d+ units permitted/);
});

test('malformed and missing fields are refused, not coerced', () => {
  for (const bad of [
    { ...good, item_id: '4151' },
    { ...good, action: 'yolo' },
    { ...good, confidence: 5 },
    { ...good, buy_at: 'cheap' },
    { ...good, reasoning: '' },
    {},
  ]) {
    assert.equal(validateSuggestion(bad, offered).ok, false, JSON.stringify(bad));
  }
});

test('sell must exceed buy', () => {
  const v = validateSuggestion({ ...good, buy_at: 1_590_000, sell_at: 1_560_000 }, offered);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /must exceed buy_at/.test(e)));
});
