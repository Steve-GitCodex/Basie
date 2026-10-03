import test from 'node:test';
import assert from 'node:assert/strict';

import { RESOURCE_VALUE, EXCHANGE_SPREAD, SHOP_CONFIG, INVENTORY_ITEMS } from '../../js/entities/GAME_DATA.js';
import { quote, addPressure } from '../../js/systems/trading/exchangeRates.js';

const RESOURCES = Object.keys(RESOURCE_VALUE);

test('quote wood→iron 3100 at pressure 1 gives floor(3100×1/3.5×0.85) = 752', () => {
  assert.equal(quote({ give: 'wood', get: 'iron', amount: 3100 }).gain, 752);
});

test('every round trip a→b→a returns less than the start amount', () => {
  for (const a of RESOURCES) {
    for (const b of RESOURCES) {
      if (a === b) continue;
      const mid = quote({ give: a, get: b, amount: 10_000 }).gain;
      const back = quote({ give: b, get: a, amount: mid }).gain;
      assert.ok(back < 10_000, `${a}→${b}→${a} returned ${back}`);
    }
  }
});

test('for every Supply resource bundle, selling money-worth then rebuying returns < 1×', () => {
  const category = SHOP_CONFIG.supply.find(c => c.id === 'resources');
  const priced = category.items.filter(entry => entry.moneyCost);
  assert.ok(priced.length >= 5);
  for (const entry of priced) {
    const grants = INVENTORY_ITEMS[entry.itemId].grants;
    for (const [resource, amount] of Object.entries(grants)) {
      const ratio = amount / entry.moneyCost * RESOURCE_VALUE[resource] / RESOURCE_VALUE.money * (1 - EXCHANGE_SPREAD);
      assert.ok(ratio < 1, `${entry.entryId} ratio ${ratio}`);
    }
  }
});

test('pressure doubles the cost and caps at 2', () => {
  const base = quote({ give: 'wood', get: 'stone', amount: 1000 }).gain;
  const pressured = quote({ give: 'wood', get: 'stone', amount: 1000, pressure: 2 }).gain;
  assert.equal(pressured, Math.floor(base / 2));
  assert.equal(addPressure(1.99, 'iron', 100_000), 2);
});

test('addPressure adds 2% per 1000 worth', () => {
  assert.equal(addPressure(1, 'wood', 1000), 1.02);
});

test('same resource / zero / fractional / unknown amount throws RangeError', () => {
  assert.throws(() => quote({ give: 'wood', get: 'wood', amount: 10 }), RangeError);
  assert.throws(() => quote({ give: 'wood', get: 'stone', amount: 0 }), RangeError);
  assert.throws(() => quote({ give: 'wood', get: 'stone', amount: 1.5 }), RangeError);
  assert.throws(() => quote({ give: 'wood', get: 'gold', amount: 10 }), RangeError);
});
