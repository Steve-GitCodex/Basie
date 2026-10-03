import test from 'node:test';
import assert from 'node:assert/strict';

import { eventBus } from '../../js/core/EventBus.js';
import { ResourceManager } from '../../js/systems/ResourceManager.js';
import { InventoryManager } from '../../js/systems/InventoryManager.js';
import { ShopManager } from '../../js/systems/ShopManager.js';
import { SHOP_CONFIG } from '../../js/entities/GAME_DATA.js';

function build({ money = 0, diamond = 0, buildSlot = false, researchSlot = false, automations = {} } = {}) {
  const rm = new ResourceManager();
  rm._resources.money.amount = money;
  rm._resources.diamond.amount = diamond;
  rm._resources.diamond.cap = Infinity;
  const inventory = new InventoryManager();
  const bm = { isShopBuildSlotBought: () => buildSlot, getAutomations: () => automations };
  const tech = { isShopResearchSlotBought: () => researchSlot };
  return { rm, inventory, shop: new ShopManager({ rm, inventory, bm, tech }) };
}

const supplyEntry = SHOP_CONFIG.supply.flatMap(c => c.items).find(e => typeof e.moneyCost === 'number' && e.itemId);

test('buy spends money and adds one item to inventory', () => {
  const { rm, inventory, shop } = build({ money: supplyEntry.moneyCost + 5 });
  const r = shop.buy(supplyEntry.entryId);
  assert.deepEqual(r, { success: true, itemId: supplyEntry.itemId });
  assert.equal(rm._resources.money.amount, 5);
  assert.equal(inventory.getQuantity(supplyEntry.itemId), 1);
});

test('buy rejects when unaffordable and spends nothing', () => {
  const { rm, inventory, shop } = build({ money: supplyEntry.moneyCost - 1 });
  const r = shop.buy(supplyEntry.entryId);
  assert.equal(r.success, false);
  assert.equal(rm._resources.money.amount, supplyEntry.moneyCost - 1);
  assert.equal(inventory.getQuantity(supplyEntry.itemId), 0);
});

test('buy rejects build_queue_expansion when the slot is already bought and spends nothing', () => {
  const { rm, shop } = build({ diamond: 5000, buildSlot: true });
  const r = shop.buy('build_queue_expansion');
  assert.equal(r.success, false);
  assert.equal(rm._resources.diamond.amount, 5000);
});

test('buy rejects cafeteria_automation when cafeteriaRestock is active', () => {
  const { rm, shop } = build({ diamond: 5000, automations: { cafeteriaRestock: true } });
  const r = shop.buy('cafeteria_automation');
  assert.equal(r.success, false);
  assert.equal(rm._resources.diamond.amount, 5000);
});

test('buy of a slot unlock spends diamonds, grants the bonus and emits slot:purchased', () => {
  const { rm, shop } = build({ diamond: 1000 });
  const seen = [];
  const off = eventBus.on('slot:purchased', d => seen.push(d));
  try {
    assert.equal(shop.buy('build_queue_expansion').success, true);
  } finally { off(); }
  assert.deepEqual(seen, [{ slotType: 'build' }]);
  assert.equal(rm._resources.diamond.amount, 1000 - 800 + 20);
});

test('buyPack adds the pack diamonds and does not count toward VIP', () => {
  const { rm, shop } = build();
  const spent = [];
  const off = eventBus.on('resources:spent', c => spent.push(c));
  try {
    assert.deepEqual(shop.buyPack('diamonds_100'), { success: true, diamonds: 100 });
  } finally { off(); }
  assert.equal(rm._resources.diamond.amount, 100);
  assert.deepEqual(spent, []);
});

test('buyPack rejects an unknown pack', () => {
  assert.equal(build().shop.buyPack('nope').success, false);
});

test('entryState reports purchased for an owned slot unlock', () => {
  const { shop } = build({ diamond: 5000, buildSlot: true });
  const s = shop.entryState('build_queue_expansion');
  assert.equal(s.status, 'purchased');
  assert.equal(s.canAfford, false);
  assert.deepEqual(s.cost, { diamond: 800 });
});

test('entryState reports active for a running automation and available otherwise', () => {
  assert.equal(build({ automations: { cafeteriaRestock: true } }).shop.entryState('cafeteria_automation').status, 'active');
  const s = build({ money: supplyEntry.moneyCost }).shop.entryState(supplyEntry.entryId);
  assert.equal(s.status, 'available');
  assert.equal(s.canAfford, true);
});

test('serialize round-trips and garbage deserializes to the seed', () => {
  const { shop } = build();
  assert.deepEqual(shop.serialize(), { crateClaimedDay: null });
  shop.deserialize({ crateClaimedDay: '2026-10-02' });
  assert.equal(shop.serialize().crateClaimedDay, '2026-10-02');
  shop.deserialize({ crateClaimedDay: 5 });
  assert.equal(shop.serialize().crateClaimedDay, null);
});

function buildCrate({ hq = 2, day = { value: '2026-10-02' }, rng = () => 0.99 } = {}) {
  const rm = new ResourceManager();
  const inventory = new InventoryManager();
  const bm = { getHQLevel: () => hq, getAutomations: () => ({}) };
  const shop = new ShopManager({ rm, inventory, bm, tech: {}, today: () => day.value, rng });
  return { rm, inventory, shop, day };
}

test('claimCrate succeeds once per UTC day and grants the roll', () => {
  const { rm, shop } = buildCrate();
  const before = rm.getSnapshot().money.amount;
  const events = [];
  const off = eventBus.on('shop:crateClaimed', (e) => events.push(e));
  const r = shop.claimCrate();
  off();
  assert.equal(r.success, true);
  assert.equal(r.result.kind, 'money');
  assert.equal(events.length, 1);
  assert.ok(rm.getSnapshot().money.amount > before);
});

test('claimCrate fails again same day, succeeds after today() advances', () => {
  const { shop, day } = buildCrate();
  assert.equal(shop.claimCrate().success, true);
  assert.deepEqual(shop.claimCrate(), { success: false, reason: 'claimed' });
  day.value = '2026-10-03';
  assert.equal(shop.claimCrate().success, true);
});

test('crateStatus.ready flips when today() changes', () => {
  const { shop, day } = buildCrate();
  assert.equal(shop.crateStatus().ready, true);
  shop.claimCrate();
  assert.equal(shop.crateStatus().ready, false);
  day.value = '2026-10-03';
  assert.equal(shop.crateStatus().ready, true);
  assert.ok(shop.crateStatus().msUntilReset > 0);
});

test('claimCrate puts item rolls into inventory', () => {
  const { inventory, shop } = buildCrate({ rng: () => 0.8 });
  const r = shop.claimCrate();
  assert.equal(r.result.kind, 'xp');
  assert.equal(inventory.getQuantity(r.result.itemId), 1);
});

test('crate claimed day round-trips and garbage deserializes to null', () => {
  const { shop } = buildCrate();
  shop.claimCrate();
  const saved = shop.serialize();
  assert.equal(saved.crateClaimedDay, '2026-10-02');
  for (const bad of [{ crateClaimedDay: 5 }, { crateClaimedDay: 'yesterday' }, {}, null]) {
    shop.deserialize(bad);
    assert.equal(shop.serialize().crateClaimedDay, null);
  }
  shop.deserialize(saved);
  assert.equal(shop.serialize().crateClaimedDay, '2026-10-02');
});

function fillResources(rm, except) {
  for (const key of ['wood', 'stone', 'food', 'water', 'iron']) {
    const res = rm._resources[key];
    res.cap = 1000;
    res.amount = key === except ? 0 : 1000;
  }
}

test('claimCrate with every resource at cap but one picks that one and applies it', () => {
  const { rm, shop } = buildCrate({ hq: 1, rng: () => 0 });
  fillResources(rm, 'stone');
  const r = shop.claimCrate();
  assert.deepEqual(Object.keys(r.result.grants), ['stone']);
  assert.equal(rm.getSnapshot().stone.amount, r.result.applied.stone);
  assert.equal(r.result.applied.stone, 300);
});

test('claimCrate with all resources at cap reports applied below granted', () => {
  const { rm, shop } = buildCrate({ hq: 1, rng: () => 0 });
  fillResources(rm, null);
  const r = shop.claimCrate();
  assert.equal(r.result.kind, 'resources');
  assert.equal(r.result.applied.wood, 0);
  assert.ok(r.result.applied.wood < r.result.grants.wood);
});
