import test from 'node:test';
import assert from 'node:assert/strict';

import { TABS, TAB_OF_TYPE, ACTION_OF_TYPE, bucket, tileTag } from '../../js/ui/inventory/inventoryTabs.js';
import { INVENTORY_ITEMS } from '../../js/entities/GAME_DATA.js';

test('every catalogue item type maps to exactly one non-All tab', () => {
  const types = new Set(Object.values(INVENTORY_ITEMS).map(i => i.type));
  for (const t of types) {
    const tabs = TABS.filter(tab => tab.types?.includes(t));
    assert.equal(tabs.length, 1, t);
    assert.equal(TAB_OF_TYPE[t], tabs[0].id);
    assert.ok(ACTION_OF_TYPE[t], t);
  }
});

test('tab order is fixed', () => {
  assert.deepEqual(TABS.map(t => t.id), ['all', 'resources', 'speedups', 'boosts', 'heroes', 'other']);
});

test('bucket sorts by rarity desc then name and skips zero quantity', () => {
  const b = bucket([
    { id: 'a', type: 'resource_bundle', rarity: 'common', name: 'B', quantity: 1 },
    { id: 'b', type: 'resource_bundle', rarity: 'legendary', name: 'Z', quantity: 1 },
    { id: 'c', type: 'resource_bundle', rarity: 'common', name: 'A', quantity: 1 },
    { id: 'd', type: 'resource_bundle', rarity: 'rare', name: 'Q', quantity: 0 },
  ]);
  assert.deepEqual(b.resources.map(i => i.id), ['b', 'c', 'a']);
  assert.equal(b.all.length, 3);
});

test('tileTag', () => {
  assert.equal(tileTag({ id: 'res_bundle_wood_t3', type: 'resource_bundle' }), 'T3');
  assert.equal(tileTag({ type: 'speed_boost', skipSeconds: 3600 }), '1h');
  assert.equal(tileTag({ type: 'speed_boost', skipSeconds: 999999 }), '∞');
  assert.equal(tileTag({ type: 'speed_boost', skipSeconds: 300 }), '5m');
  assert.equal(tileTag({ type: 'speed_boost', skipSeconds: 900 }), '15m');
  assert.equal(tileTag({ type: 'speed_boost', skipSeconds: 28800 }), '8h');
  assert.equal(tileTag({ type: 'buff' }), '');
  assert.equal(tileTag({ type: 'speed_boost' }), '');
});

test('action routing table', () => {
  assert.equal(ACTION_OF_TYPE.resource_bundle, 'use');
  assert.equal(ACTION_OF_TYPE.xp_card, 'hero');
  assert.equal(ACTION_OF_TYPE.speed_boost, 'speedup');
  assert.equal(ACTION_OF_TYPE.buff, 'boost');
  assert.equal(ACTION_OF_TYPE.tier_shard, 'recruit');
  assert.equal(ACTION_OF_TYPE.automation, 'none');
});

test('bucket breaks rarity ties by tier: bundles by _tN, speedups by skipSeconds', () => {
  const b = bucket([
    { id: 'res_bundle_wood_t2', type: 'resource_bundle', rarity: 'common', name: 'A Medium', quantity: 1 },
    { id: 'res_bundle_wood_t1', type: 'resource_bundle', rarity: 'common', name: 'Z Small', quantity: 1 },
    { id: 'h', type: 'speed_boost', rarity: 'rare', name: 'A 1h', skipSeconds: 3600, quantity: 1 },
    { id: 'm5', type: 'speed_boost', rarity: 'rare', name: 'B 5m', skipSeconds: 300, quantity: 1 },
    { id: 'm15', type: 'speed_boost', rarity: 'rare', name: 'C 15m', skipSeconds: 900, quantity: 1 },
  ]);
  assert.deepEqual(b.resources.map(i => i.id), ['res_bundle_wood_t1', 'res_bundle_wood_t2']);
  assert.deepEqual(b.speedups.map(i => i.id), ['m5', 'm15', 'h']);
});
