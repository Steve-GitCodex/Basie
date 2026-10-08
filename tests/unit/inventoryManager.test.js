import test from 'node:test';
import assert from 'node:assert/strict';

import { InventoryManager } from '../../js/systems/InventoryManager.js';
import { INVENTORY_ITEMS } from '../../js/entities/GAME_DATA.js';
import { eventBus } from '../../js/core/EventBus.js';

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

test('useItem on an xp_card awards its xpValue through HeroManager.awardHeroXP and consumes one card', () => {
  const inv = new InventoryManager();
  inv.addItem('xpcard_epic', 1);
  let calledWith = null;
  inv.setHeroManager({
    awardHeroXP: (heroId, xp) => { calledWith = { heroId, xp }; return { success: true }; },
  });

  const r = inv.useItem('xpcard_epic', { heroId: 'warlord' });
  assert.equal(r.success, true);
  assert.deepEqual(calledWith, { heroId: 'warlord', xp: INVENTORY_ITEMS.xpcard_epic.xpValue });
  assert.equal(inv.getQuantity('xpcard_epic'), 0);
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

test('useItem on a buff activates it through BuffManager and consumes one', () => {
  const inv = new InventoryManager();
  const calls = [];
  inv.setBuffManager({ activate: id => { calls.push(id); return { success: true, replaced: null }; } });
  inv.addItem('buff_prod_sm', 2);
  const r = inv.useItem('buff_prod_sm');
  assert.equal(r.success, true);
  assert.deepEqual(calls, ['buff_prod_sm']);
  assert.equal(inv.getQuantity('buff_prod_sm'), 1);
});

test('useItem on a buff keeps the item when activation fails', () => {
  const inv = new InventoryManager();
  inv.setBuffManager({ activate: () => ({ success: false, reason: 'x' }) });
  inv.addItem('buff_prod_sm', 1);
  assert.equal(inv.useItem('buff_prod_sm').success, false);
  assert.equal(inv.getQuantity('buff_prod_sm'), 1);
});

function rmStub({ amount = 0, cap = 1000, mult = 1 } = {}) {
  const res = { wood: { amount, cap } };
  return {
    res,
    getSnapshot: () => ({ wood: { ...res.wood } }),
    isSandbox: () => mult === 10,
    add(r) { for (const [k, v] of Object.entries(r)) res[k].amount = Math.min(res[k].cap, res[k].amount + v * mult); },
  };
}

test('useItem qty>1 on a resource bundle grants once and emits one inventory:updated', () => {
  const inv = new InventoryManager();
  inv.setResourceManager(rmStub({ cap: 1e6 }));
  inv.addItem('res_bundle_wood_t1', 5);
  let events = 0;
  const off = eventBus.on('inventory:updated', () => events++);
  const r = inv.useItem('res_bundle_wood_t1', { qty: 3 });
  off();
  assert.equal(r.success, true);
  assert.deepEqual(r.grants, { wood: 600 });
  assert.deepEqual(r.lost, {});
  assert.equal(inv.getQuantity('res_bundle_wood_t1'), 2);
  assert.equal(events, 1);
});

test('useItem reports the over-cap amount as lost', () => {
  const inv = new InventoryManager();
  inv.setResourceManager(rmStub({ amount: 900, cap: 1000 }));
  inv.addItem('res_bundle_wood_t1', 2);
  const r = inv.useItem('res_bundle_wood_t1', { qty: 2 });
  assert.deepEqual(r.grants, { wood: 100 });
  assert.deepEqual(r.lost, { wood: 300 });
});

test('previewUse matches useItem and does not mutate', () => {
  const inv = new InventoryManager();
  const rm = rmStub({ amount: 900, cap: 1000 });
  inv.setResourceManager(rm);
  inv.addItem('res_bundle_wood_t1', 2);
  const p = inv.previewUse('res_bundle_wood_t1', { qty: 2 });
  assert.deepEqual([p.grants, p.lost], [{ wood: 100 }, { wood: 300 }]);
  assert.equal(inv.getQuantity('res_bundle_wood_t1'), 2);
  assert.equal(rm.res.wood.amount, 900);
});

test('qty is clamped to owned and to 1 for non-batchable types', () => {
  const inv = new InventoryManager();
  inv.setResourceManager(rmStub({ cap: 1e6 }));
  inv.addItem('res_bundle_wood_t1', 2);
  assert.equal(inv.useItem('res_bundle_wood_t1', { qty: 9 }).success, false);
  inv.addItem('buff_prod_sm', 3);
  assert.equal(inv.previewUse('buff_prod_sm', { qty: 3 }).qty, 1);
});

test('xp_card batch awards the total once', () => {
  const inv = new InventoryManager();
  const calls = [];
  inv.setHeroManager({ awardHeroXP: (h, xp) => { calls.push([h, xp]); return { success: true }; } });
  inv.addItem('xpcard_normal', 3);
  const per = INVENTORY_ITEMS.xpcard_normal.xpValue;
  const r = inv.useItem('xpcard_normal', { qty: 3, heroId: 'paladin' });
  assert.equal(r.xpAmount, per * 3);
  assert.deepEqual(calls, [['paladin', per * 3]]);
  assert.equal(inv.getQuantity('xpcard_normal'), 0);
});

test('sandbox x10 grants and lost amounts are reported as received', () => {
  const inv = new InventoryManager();
  inv.setResourceManager(rmStub({ amount: 0, cap: 3000, mult: 10 }));
  inv.addItem('res_bundle_wood_t1', 2);
  const r = inv.useItem('res_bundle_wood_t1', { qty: 2 });
  assert.deepEqual(r.grants, { wood: 3000 });
  assert.deepEqual(r.lost, { wood: 1000 });
});

test('a full store reports everything lost and nothing negative', () => {
  const inv = new InventoryManager();
  inv.setResourceManager(rmStub({ amount: 1200, cap: 1000 }));
  inv.addItem('res_bundle_wood_t1', 1);
  const p = inv.previewUse('res_bundle_wood_t1');
  assert.deepEqual([p.grants, p.lost], [{ wood: 0 }, { wood: 200 }]);
});

test('hero_fragment batch uses xpValue default 50 per unit', () => {
  const inv = new InventoryManager();
  const calls = [];
  inv.setHeroManager({ awardHeroXP: (h, xp) => { calls.push([h, xp]); return { success: true }; } });
  inv.addItem('fragment_warlord', 2);
  const per = INVENTORY_ITEMS.fragment_warlord.xpValue ?? 50;
  const r = inv.useItem('fragment_warlord', { qty: 2, heroId: 'warlord' });
  assert.equal(r.xpAmount, per * 2);
  assert.deepEqual(calls, [['warlord', per * 2]]);
});

test('xp use keeps the items when the hero award fails', () => {
  const inv = new InventoryManager();
  inv.setHeroManager({ awardHeroXP: () => ({ success: false, reason: 'Hero not in roster.' }) });
  inv.addItem('xpcard_normal', 2);
  const r = inv.useItem('xpcard_normal', { qty: 2, heroId: 'nobody' });
  assert.equal(r.success, false);
  assert.equal(inv.getQuantity('xpcard_normal'), 2);
});

test('hero_fragment XP use is rejected for a hero other than its target', () => {
  const inv = new InventoryManager();
  inv.addItem('fragment_warlord', 2);
  let called = false;
  inv.setHeroManager({ awardHeroXP: () => { called = true; return { success: true, gained: 50 }; } });

  const r = inv.useItem('fragment_warlord', { heroId: 'kaelenthorne' });
  assert.equal(r.success, false);
  assert.equal(called, false);
  assert.equal(inv.getQuantity('fragment_warlord'), 2);

  const ok = inv.useItem('fragment_warlord', { heroId: 'warlord' });
  assert.equal(ok.success, true);
  assert.equal(inv.getQuantity('fragment_warlord'), 1);
});

test('XP items are kept when the hero gains nothing (level cap)', () => {
  const inv = new InventoryManager();
  inv.addItem('xpcard_epic', 2);
  inv.setHeroManager({ awardHeroXP: () => ({ success: true, gained: 0 }) });

  const r = inv.useItem('xpcard_epic', { heroId: 'warlord', qty: 2 });
  assert.equal(r.success, false);
  assert.match(r.reason, /max level/i);
  assert.equal(inv.getQuantity('xpcard_epic'), 2);
});
