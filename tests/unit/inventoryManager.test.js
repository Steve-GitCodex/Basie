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

test('useItem on a recruitment_scroll fails gracefully against a real HeroManager (rollScroll retired)', () => {
  const inv = new InventoryManager();
  inv.addItem('scroll_common', 1);
  inv.setHeroManager({ hasItem: () => true });

  const r = inv.useItem('scroll_common');
  assert.equal(r.success, false);
  assert.match(r.reason, /retired/);
});

test('every INVENTORY_ITEMS resource_bundle grants keys that addItem can round-trip', () => {
  const inv = new InventoryManager();
  for (const item of Object.values(INVENTORY_ITEMS)) {
    if (item.type !== 'resource_bundle') continue;
    assert.ok(inv.addItem(item.id, 1), `addItem should succeed for declared item '${item.id}'`);
  }
});

// ── Review finding 2: xp_card must be a spendable item, not a dead currency ──

test('useItem on an xp_card delegates to HeroManager.applyXPCard and consumes one card', () => {
  const inv = new InventoryManager();
  inv.addItem('xpcard_epic', 1);
  let calledWith = null;
  inv.setHeroManager({
    hasItem: () => true,
    applyXPCard: (itemId, heroId) => { calledWith = { itemId, heroId }; return { success: true, xpAmount: 2500 }; },
  });

  const r = inv.useItem('xpcard_epic', { heroId: 'warlord' });
  assert.equal(r.success, true);
  assert.deepEqual(calledWith, { itemId: 'xpcard_epic', heroId: 'warlord' });
});

test('useItem on an xp_card fails without a target hero', () => {
  const inv = new InventoryManager();
  inv.addItem('xpcard_normal', 1);
  inv.setHeroManager({ hasItem: () => true, applyXPCard: () => ({ success: true }) });

  const r = inv.useItem('xpcard_normal');
  assert.equal(r.success, false);
});

// ── Review finding 4: renamed universal card ids must not silently drop legacy holdings ──

test('deserialize migrates legacy card_common/card_rare holdings onto the renamed ids', () => {
  const inv = new InventoryManager();
  inv.deserialize({ items: { card_common: 3, card_rare: 2 } });
  assert.equal(inv.getQuantity('card_normal'), 3);
  assert.equal(inv.getQuantity('card_epic'), 2);
  assert.equal(inv.getQuantity('card_common'), 0);
  assert.equal(inv.getQuantity('card_rare'), 0);
});

test('deserialize folds a legacy alias id onto an already-held new-id quantity', () => {
  const inv = new InventoryManager();
  inv.deserialize({ items: { card_normal: 1, card_common: 4 } });
  assert.equal(inv.getQuantity('card_normal'), 5);
});

// ── Task 5: legacy scroll ids fold onto recruit tokens ──────────────────────

test('legacy scroll ids fold onto recruit tokens on load', () => {
  const im = new InventoryManager();
  im.deserialize({ items: { scroll_common: 2, scroll_rare: 1, scroll_legendary: 3 } });
  assert.equal(im.getQuantity('token_normal'), 2);
  assert.equal(im.getQuantity('token_epic'), 1);
  assert.equal(im.getQuantity('token_legendary'), 3);
  assert.equal(im.getQuantity('scroll_common'), 0, 'no scroll survives the load');
});

test('scroll→token folding is idempotent across a save/load round trip', () => {
  const first = new InventoryManager();
  first.deserialize({ items: { scroll_rare: 1 } });

  const second = new InventoryManager();
  second.deserialize(first.serialize());
  assert.equal(second.getQuantity('token_epic'), 1, 're-loading must not re-convert or double');
});

test('a fresh save is unaffected by the alias', () => {
  const im = new InventoryManager();
  im.deserialize({ items: { token_epic: 1 } });
  assert.equal(im.getQuantity('token_epic'), 1);
});

test('welcome-mail starter grant item ids resolve in INVENTORY_ITEMS', () => {
  assert.ok(INVENTORY_ITEMS.token_normal, 'token_normal must be a known item');
  assert.ok(INVENTORY_ITEMS.token_epic, 'token_epic must be a known item');
});
