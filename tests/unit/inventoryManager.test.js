import test from 'node:test';
import assert from 'node:assert/strict';

import { InventoryManager } from '../../js/systems/InventoryManager.js';
import { INVENTORY_ITEMS } from '../../js/entities/GAME_DATA.js';

function silenceWarnings(fn) {
  const original = console.warn;
  console.warn = () => {};
  try { return fn(); } finally { console.warn = original; }
}

test('addItem returns true and stores the item for a known id', () => {
  const inv = new InventoryManager();
  const ok = inv.addItem('res_bundle_wood_t1', 3);
  assert.equal(ok, true);
  assert.equal(inv.getQuantity('res_bundle_wood_t1'), 3);
});

test('addItem returns false and grants nothing for an unknown id', () => {
  const inv = new InventoryManager();
  const ok = silenceWarnings(() => inv.addItem('res_bundle_wood_sm', 1));
  assert.equal(ok, false);
  assert.equal(inv.getQuantity('res_bundle_wood_sm'), 0);
});

test('useItem on a recruitment_scroll reports failure when the roll fails to grant', () => {
  const inv = new InventoryManager();
  inv.addItem('scroll_common', 1);
  inv.setHeroManager({
    hasItem: () => true,
    rollScroll: () => ({ outcome: 'resource', scrollTier: 'common', grantFailed: true, reason: 'boom' }),
  });

  const r = inv.useItem('scroll_common');
  assert.equal(r.success, false);
  assert.equal(r.reason, 'boom');
});

test('useItem on a recruitment_scroll reports success when the roll grants a reward', () => {
  const inv = new InventoryManager();
  inv.addItem('scroll_common', 1);
  inv.setHeroManager({
    hasItem: () => true,
    rollScroll: () => ({ outcome: 'resource', scrollTier: 'common', itemId: 'res_bundle_wood_t1' }),
  });

  const r = inv.useItem('scroll_common');
  assert.equal(r.success, true);
  assert.equal(r.gachaResult.itemId, 'res_bundle_wood_t1');
});

test('every INVENTORY_ITEMS resource_bundle grants keys that addItem can round-trip', () => {
  const inv = new InventoryManager();
  for (const item of Object.values(INVENTORY_ITEMS)) {
    if (item.type !== 'resource_bundle') continue;
    assert.ok(inv.addItem(item.id, 1), `addItem should succeed for declared item '${item.id}'`);
  }
});
