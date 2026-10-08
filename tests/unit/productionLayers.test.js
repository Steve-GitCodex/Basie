import test from 'node:test';
import assert from 'node:assert/strict';
import { productionLayers, layerMultiplier } from '../../js/systems/resource/productionLayers.js';

const noInputs = { techBonuses: {}, worldBuffs: [], hqBonus: 0, boost: null, vipPct: 0, difficultyMult: 1, eventModifiers: [] };

test('layerMultiplier adds within a layer and multiplies across', () => {
  const m = layerMultiplier([
    { kind: 'tech',  entries: [{ pct: 0.1 }] },
    { kind: 'world', entries: [{ pct: 0.1 }, { pct: 0.05 }] },
    { kind: 'item',  entries: [{ pct: 0.5 }] },
  ]);
  assert.ok(Math.abs(m - 1.1 * 1.15 * 1.5) < 1e-9);
});

test('layerMultiplier compounds event entries like the live pipeline', () => {
  const m = layerMultiplier([{ kind: 'event', entries: [{ pct: 1 }, { pct: 0.5 }] }]);
  assert.ok(Math.abs(m - 2 * 1.5) < 1e-9);
});

test('productionLayers omits empty layers and keeps pipeline order', () => {
  const layers = productionLayers('wood', { ...noInputs, techBonuses: { woodBonus: 0.1 }, hqBonus: 0.05,
    boost: { pct: 0.5, label: 'Production Boost (Major)', endsAt: 123 } });
  assert.deepEqual(layers.map(l => l.kind), ['tech', 'hq', 'item']);
  assert.equal(layers[2].entries[0].endsAt, 123);
});

test('food has no tech layer', () => {
  assert.equal(productionLayers('food', { ...noInputs, techBonuses: { woodBonus: 0.1 } }).length, 0);
});
