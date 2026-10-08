import test from 'node:test';
import assert from 'node:assert/strict';
import { BuffManager } from '../../js/systems/BuffManager.js';
import { eventBus } from '../../js/core/EventBus.js';

test('activate stores one boost for the item stat', () => {
  const bm = new BuffManager();
  const r = bm.activate('buff_prod_sm');
  assert.equal(r.success, true);
  assert.equal(r.replaced, null);
  assert.equal(bm.getBoosts().length, 1);
  assert.equal(bm.getBoosts()[0].stat, 'production.all');
  assert.equal(bm.multiplierFor('production.all'), 0.25);
});

test('activating the same stat replaces and returns the previous boost', () => {
  const bm = new BuffManager();
  bm.activate('buff_prod_lg');
  const r = bm.activate('buff_prod_sm');
  assert.equal(r.replaced.itemId, 'buff_prod_lg');
  assert.equal(bm.getBoosts().length, 1);
  assert.equal(bm.multiplierFor('production.all'), 0.25);
});

test('previewActivate reports the running boost without mutating', () => {
  const bm = new BuffManager();
  bm.activate('buff_prod_lg');
  const p = bm.previewActivate('buff_prod_sm');
  assert.equal(p.current.itemId, 'buff_prod_lg');
  assert.deepEqual(p.incoming, { value: 0.25, durationMs: 3600000 });
  assert.equal(bm.getBoosts()[0].itemId, 'buff_prod_lg');
});

test('activate rejects a non-buff item', () => {
  assert.equal(new BuffManager().activate('res_bundle_wood_t1').success, false);
});

test('update drops expired boosts and emits buff:expired then buffs:changed', () => {
  const bm = new BuffManager();
  bm.activate('buff_prod_sm');
  bm._boosts[0].endsAt = Date.now() - 1;
  const seen = [];
  const off1 = eventBus.on('buff:expired', e => seen.push(['expired', e.itemId]));
  const off2 = eventBus.on('buffs:changed', () => seen.push(['changed']));
  bm.update(0.05);
  off1?.(); off2?.();
  assert.deepEqual(seen, [['expired', 'buff_prod_sm'], ['changed']]);
  assert.equal(bm.multiplierFor('production.all'), 0);
});

test('deserialize drops expired, unknown, malformed and duplicate-stat boosts', () => {
  const now = Date.now();
  const bm = new BuffManager();
  bm.deserialize({ boosts: [
    { itemId: 'buff_prod_sm', stat: 'production.all', value: 0.25, startedAt: now, endsAt: now + 1000 },
    { itemId: 'buff_prod_lg', stat: 'production.all', value: 0.5,  startedAt: now, endsAt: now + 9000 },
    { itemId: 'buff_prod_sm', stat: 'production.all', value: 0.25, startedAt: now, endsAt: now - 1 },
    { itemId: 'nope',         stat: 'production.all', value: 0.25, startedAt: now, endsAt: now + 1000 },
    { itemId: 'buff_prod_sm', stat: 'production.all', value: 'x',  startedAt: now, endsAt: now + 1000 },
  ] });
  assert.equal(bm.getBoosts().length, 1);
  assert.equal(bm.getBoosts()[0].itemId, 'buff_prod_lg');
});

test('serialize round-trips', () => {
  const a = new BuffManager();
  a.activate('buff_prod_sm');
  const b = new BuffManager();
  b.deserialize(a.serialize());
  assert.deepEqual(b.serialize(), a.serialize());
});
