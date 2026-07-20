import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAdjacency, areNeighbours, trainTimeMultiplier, productionBonusTotal, ADJACENCY_PAIRS,
} from '../../js/systems/building/adjacency.js';

const rect = (instanceId, cx, cy, w = 3, h = 3) => ({ instanceId, cx, cy, w, h });

test('rects one tile apart are neighbours; further apart are not', () => {
  assert.equal(areNeighbours(rect('a', 0, 0), rect('b', 5, 0)), true);
  assert.equal(areNeighbours(rect('a', 0, 0), rect('b', 6, 0)), false);
  assert.equal(areNeighbours(rect('a', 0, 0), rect('b', 0, 5)), true);
  assert.equal(areNeighbours(rect('a', 0, 0), rect('b', 20, 20)), false);
});

test('same-category neighbours each gain a clustering bonus', () => {
  const adj = computeAdjacency([rect('farm_0', 0, 0), rect('farm_1', 4, 0)]);
  assert.equal(adj.get('farm_0').sameCount, 1);
  assert.ok(adj.get('farm_0').cluster > 0);
  assert.equal(adj.get('farm_0').bonus, adj.get('farm_1').bonus);
});

test('isolated buildings earn nothing', () => {
  const adj = computeAdjacency([rect('farm_0', 0, 0), rect('farm_1', 20, 20)]);
  assert.equal(adj.get('farm_0').bonus, 0);
  assert.equal(adj.get('farm_1').bonus, 0);
});

test('clustering is capped so a dense blob cannot run away', () => {
  const many = Array.from({ length: 12 }, (_, i) => rect(`farm_${i}`, (i % 4) * 4, Math.floor(i / 4) * 4));
  const adj = computeAdjacency(many);
  for (const entry of adj.values()) assert.ok(entry.cluster <= 0.20 + 1e-9);
});

test('total bonus never exceeds the hard cap', () => {
  const many = Array.from({ length: 16 }, (_, i) => rect(`house_${i}`, (i % 4) * 4, Math.floor(i / 4) * 4));
  many.push(rect('cafeteria_0', 2, 2));
  const adj = computeAdjacency(many);
  for (const entry of adj.values()) assert.ok(entry.bonus <= 0.30 + 1e-9);
});

test('curated pairs grant a labelled bonus to both sides', () => {
  const adj = computeAdjacency([rect('house_0', 0, 0), rect('cafeteria_0', 4, 0)]);
  const h = adj.get('house_0'), c = adj.get('cafeteria_0');
  assert.equal(h.pairs.length, 1);
  assert.equal(h.pairs[0].label, 'Fed Quarters');
  assert.equal(h.pairs[0].withId, 'cafeteria');
  assert.equal(c.pairs[0].withId, 'house');
  assert.ok(h.bonus > 0 && c.bonus > 0);
});

test('curated pairs are declared symmetrically-usable (no duplicate rules)', () => {
  const seen = new Set();
  for (const p of ADJACENCY_PAIRS) {
    const key = [p.a, p.b].sort().join('|');
    assert.equal(seen.has(key), false, `duplicate pair rule for ${key}`);
    seen.add(key);
  }
});

test('military clustering shortens training; no military means no change', () => {
  assert.equal(trainTimeMultiplier(computeAdjacency([])), 1);
  assert.equal(trainTimeMultiplier(computeAdjacency([rect('farm_0', 0, 0), rect('farm_1', 4, 0)])), 1);
  const mult = trainTimeMultiplier(computeAdjacency([rect('barracks_0', 0, 0), rect('archeryrange_0', 4, 0)]));
  assert.ok(mult < 1 && mult >= 0.75);
});

test('production total only counts production buildings', () => {
  const adj = computeAdjacency([rect('barracks_0', 0, 0), rect('archeryrange_0', 4, 0)]);
  assert.equal(productionBonusTotal(adj), 0);
  const prod = computeAdjacency([rect('farm_0', 0, 0), rect('farm_1', 4, 0)]);
  assert.ok(productionBonusTotal(prod) > 0);
});

test('adjacency is derived from layout — moving a building changes the bonus', () => {
  const near = computeAdjacency([rect('farm_0', 0, 0), rect('farm_1', 4, 0)]);
  const far  = computeAdjacency([rect('farm_0', 0, 0), rect('farm_1', 30, 0)]);
  assert.ok(near.get('farm_0').bonus > far.get('farm_0').bonus);
});
