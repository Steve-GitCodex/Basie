import test from 'node:test';
import assert from 'node:assert/strict';

import { cafeteriaTotals, cafeteriaTipHtml, emptyText, restockAll } from '../../js/ui/hud/cafeteriaPopover.js';

const stock = (id, food, water, cap = 100) => ({ instanceId: id, level: 1, stock: { food, water }, stockCap: { food: cap, water: cap } });
const stubBm = (stocks, depletion = { drainPerSec: 0, emptyInSec: Infinity }, restock = () => ({ success: true })) => ({
  getCafeteriaStock: () => stocks,
  getCafeteriaDepletion: () => depletion,
  getAutomations: () => ({ cafeteriaRestock: true }),
  restockCafeteria: restock,
});

test('cafeteriaTotals sums instances and uses the lower of food/water ratio', () => {
  const t = cafeteriaTotals(stubBm([stock('a', 10, 80), stock('b', 30, 20)]));
  assert.equal(t.food, 40);
  assert.equal(t.water, 100);
  assert.equal(t.foodCap, 200);
  assert.equal(t.ratio, 0.2);
  assert.equal(t.count, 2);
  assert.equal(t.autoRestock, true);
});

test('cafeteriaTotals without a cafeteria is empty and safe', () => {
  const t = cafeteriaTotals(stubBm([]));
  assert.equal(t.count, 0);
  assert.equal(t.ratio, 0);
});

test('tooltip omits the Empty in row when there is no drain', () => {
  const html = cafeteriaTipHtml(cafeteriaTotals(stubBm([stock('a', 5, 5)])));
  assert.match(html, /Cafeteria supplies/);
  assert.doesNotMatch(html, /Empty in|Infinity|NaN/);
});

test('tooltip and popover agree on Out of supplies and finite durations', () => {
  const out = cafeteriaTotals(stubBm([stock('a', 0, 0)], { drainPerSec: 0.1, emptyInSec: 0 }));
  assert.equal(emptyText(out), 'Out of supplies');
  assert.match(cafeteriaTipHtml(out), /Out of supplies/);
  const soon = cafeteriaTotals(stubBm([stock('a', 6, 6)], { drainPerSec: 0.1, emptyInSec: 60 }));
  assert.equal(emptyText(soon), '1m 00s');
  assert.equal(emptyText(cafeteriaTotals(stubBm([stock('a', 6, 6)]))), null);
});

test('restockAll returns no message when any instance restocked', () => {
  const results = [{ success: false, reason: 'full' }, { success: true }];
  const bm = stubBm([stock('a', 100, 100), stock('b', 0, 0)], undefined, () => results.shift());
  assert.equal(restockAll(bm), '');
});

test('restockAll surfaces the first failure reason when none succeeded', () => {
  const bm = stubBm([stock('a', 100, 100)], undefined, () => ({ success: false, reason: 'Cafeteria stock is already full.' }));
  assert.equal(restockAll(bm), 'Cafeteria stock is already full.');
});
