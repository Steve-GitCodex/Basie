import test from 'node:test';
import assert from 'node:assert/strict';

import { generateStock, priceInResources } from '../../js/systems/trading/traderStock.js';
import { createRng } from '../../js/systems/combat/seededRng.js';
import { TRADER_STOCK_SIZE, TRADER_POOL, RESOURCE_VALUE, findShopEntry } from '../../js/entities/GAME_DATA.js';

const held = { wood: 5000, stone: 3000, iron: 800, money: 9999, food: 0 };

test('stock has 6 distinct itemIds', () => {
  const stock = generateStock({ held, rng: createRng(7).next });
  assert.equal(stock.length, TRADER_STOCK_SIZE);
  assert.equal(new Set(stock.map(s => s.itemId)).size, TRADER_STOCK_SIZE);
  assert.equal(new Set(stock.map(s => s.slotId)).size, TRADER_STOCK_SIZE);
  assert.ok(stock.every(s => s.sold === false));
});

test('costs use only held resources, are multiples of 50, ≥ 50', () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (const slot of generateStock({ held, rng: createRng(seed).next })) {
      const keys = Object.keys(slot.cost);
      assert.ok(keys.length >= 1 && keys.length <= 2);
      for (const k of keys) {
        assert.ok(['wood', 'stone', 'iron'].includes(k), k);
        assert.ok(slot.cost[k] >= 50 && slot.cost[k] % 50 === 0);
      }
    }
  }
});

test('discounts ∈ {0,20,30}', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    for (const s of generateStock({ held, rng: createRng(seed).next })) seen.add(s.discountPct);
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), [0, 20, 30]);
});

test('with held all zero the cost is a single positive wood amount', () => {
  const stock = generateStock({ held: { wood: 0, stone: 0, money: 500 }, rng: createRng(3).next });
  for (const slot of stock) {
    assert.deepEqual(Object.keys(slot.cost), ['wood']);
    assert.ok(slot.cost.wood > 0);
  }
});

test('same seed → same stock', () => {
  assert.deepEqual(
    generateStock({ held, rng: createRng(99).next }),
    generateStock({ held, rng: createRng(99).next }),
  );
});

test('priceInResources rounds up to 50', () => {
  assert.deepEqual(priceInResources(10, { wood: 1 }, createRng(1).next), { wood: 50 });
});

test('every TRADER_POOL entry resolves to a positive worth', () => {
  for (const entry of TRADER_POOL) {
    const worth = entry.worth ?? (findShopEntry(entry.itemId)?.moneyCost ?? 0) * RESOURCE_VALUE.money;
    assert.ok(worth > 0, entry.itemId);
  }
});

test('resource shares never exceed caps where an uncapped split would', () => {
  const caps = { wood: 5000, stone: 5000, food: 5000, water: 5000, iron: 5000 };
  const rich = { wood: 900, stone: 900, food: 900, water: 900, iron: 900, money: 5 };
  for (let seed = 1; seed <= 40; seed++) {
    for (const slot of generateStock({ held: rich, caps, rng: createRng(seed).next })) {
      for (const [res, amount] of Object.entries(slot.cost)) {
        assert.ok(amount <= caps[res], `${res} ${amount}`);
        assert.ok(amount >= 50 && amount % 50 === 0);
      }
    }
  }
  assert.ok(Object.keys(priceInResources(4800, rich, createRng(1).next, { wood: 1500, stone: 1500, food: 1500, water: 1500, iron: 1500 })).length >= 4);
});

test('non-finite or missing caps are unlimited; impossible fits keep a best-effort split', () => {
  const cost = priceInResources(1000, { wood: 5, stone: 5 }, createRng(1).next, { wood: Infinity, stone: null });
  assert.ok(Object.values(cost).every(n => n >= 50));
  const tight = priceInResources(10000, { wood: 5, stone: 5 }, createRng(1).next, { wood: 100, stone: 100 });
  assert.deepEqual(Object.keys(tight).sort(), ['stone', 'wood']);
});

test('a resource bundle is never priced in its own resource', () => {
  const rich = { wood: 9000, stone: 9000, food: 9000, water: 9000, iron: 9000 };
  for (let seed = 1; seed <= 60; seed++) {
    for (const slot of generateStock({ held: rich, rng: createRng(seed).next })) {
      const match = /^res_bundle_(\w+?)_t\d$/.exec(slot.itemId);
      if (match) assert.ok(!(match[1] in slot.cost), `${slot.itemId} priced in ${match[1]}`);
    }
  }
});
