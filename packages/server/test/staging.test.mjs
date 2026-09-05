import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store, readStagedOrder, STAGED_ORDER_MAX_AGE_S } from '../../ingest/dist/index.js';
import { stageOrder, stagedOrder } from '../dist/api.js';

const NOW = Math.floor(Date.now() / 1000);

/**
 * A store holding one genuinely tradeable item, seeded the way the poller would.
 * Staging validates against the live pipeline, so the fixture has to be real
 * enough to produce a candidate rather than mocked past it.
 */
function seeded() {
  const s = new Store(join(mkdtempSync(join(tmpdir(), 'flip-stage-')), 'test.db'));
  s.upsertItems([{
    id: 573, name: 'Air orb', members: true, buyLimit: 11000,
    highalch: null, value: null, examine: '', icon: '',
  }], NOW);
  s.writeTicks([{ itemId: 573, high: 1505, highTime: NOW - 20, low: 1466, lowTime: NOW - 30 }], NOW);
  s.writeVolumes(new Map([[573, 1_200_000]]), NOW);
  return s;
}

const order = (over = {}) => ({ itemId: 573, side: 'buy', price: 1470, quantity: 100, ...over });

test('a supported order stages, and takes its name from /mapping', () => {
  const s = seeded();
  const r = stageOrder(s, order(), NOW);
  assert.ok(r.ok, r.ok ? '' : r.errors.join('; '));
  assert.equal(r.staged.itemName, 'Air orb');
  assert.equal(r.staged.price, 1470);
  // The spread travels with the order so the client can refuse a stale prefill.
  assert.equal(r.staged.spreadLow, 1466);
  assert.equal(r.staged.spreadHigh, 1505);
  s.close();
});

test('the item name never comes from the request', () => {
  const s = seeded();
  // A caller claiming a different name must not be able to make the client type it.
  const r = stageOrder(s, { ...order(), itemName: 'Twisted bow', name: 'Twisted bow' }, NOW);
  assert.ok(r.ok);
  assert.equal(r.staged.itemName, 'Air orb');
  s.close();
});

test('a price outside the observed spread cannot be staged', () => {
  const s = seeded();
  for (const price of [1, 1465, 1506, 99_999_999]) {
    const r = stageOrder(s, order({ price }), NOW);
    assert.equal(r.ok, false, `price ${price} should be refused`);
    assert.match(r.errors[0], /outside the observed spread/);
  }
  s.close();
});

test('an item the pipeline is not offering cannot be staged', () => {
  const s = seeded();
  const r = stageOrder(s, order({ itemId: 999999 }), NOW);
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /not in the current candidate set/);
  s.close();
});

test('a quantity beyond the permitted units cannot be staged', () => {
  const s = seeded();
  const r = stageOrder(s, order({ quantity: 10_000_000 }), NOW);
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /exceeds the \d+ units permitted/);
  s.close();
});

test('malformed staging requests are refused rather than coerced', () => {
  const s = seeded();
  for (const bad of [
    order({ itemId: '573' }), order({ side: 'hold' }), order({ price: 0 }),
    order({ price: 1470.5 }), order({ quantity: -1 }), null, 'nope',
  ]) {
    assert.equal(stageOrder(s, bad, NOW).ok, false, JSON.stringify(bad));
  }
  s.close();
});

test('a staged order expires rather than being typed into a live offer later', () => {
  const s = seeded();
  assert.ok(stageOrder(s, order(), NOW).ok);
  assert.notEqual(stagedOrder(s, NOW), null);

  // Just inside the window it is still offered; past it, it is simply absent.
  assert.notEqual(readStagedOrder(s, NOW + STAGED_ORDER_MAX_AGE_S - 1, STAGED_ORDER_MAX_AGE_S), null);
  assert.equal(readStagedOrder(s, NOW + STAGED_ORDER_MAX_AGE_S + 1, STAGED_ORDER_MAX_AGE_S), null);
  s.close();
});

test('staging again supersedes the previous order', () => {
  const s = seeded();
  assert.ok(stageOrder(s, order({ price: 1470 }), NOW).ok);
  assert.ok(stageOrder(s, order({ price: 1480 }), NOW).ok);
  assert.equal(stagedOrder(s, NOW).price, 1480);
  assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM staged_order').get().n, 1);
  s.close();
});
