import test from 'node:test';
import assert from 'node:assert/strict';

import { heroBuildModifiers } from '../../js/systems/building/heroBuildModifiers.js';

const { applyBuildSpeed, applyCostReduction } = heroBuildModifiers;

test('applyBuildSpeed 100s at 0.25 → 80', () => {
  assert.equal(applyBuildSpeed(100, 0.25), 80);
});

test('applyBuildSpeed keeps 0 at 0', () => {
  assert.equal(applyBuildSpeed(0, 0.5), 0);
});

test('applyBuildSpeed never goes below 1 for a positive time', () => {
  assert.equal(applyBuildSpeed(1, 5), 1);
});

test('applyBuildSpeed returns input unchanged when speed is not positive', () => {
  assert.equal(applyBuildSpeed(60, 0), 60);
  assert.equal(applyBuildSpeed(60, undefined), 60);
});

test('applyCostReduction rounds each amount up', () => {
  assert.deepEqual(applyCostReduction({ wood: 101 }, 0.25), { wood: 76 });
});

test('applyCostReduction at 0 returns an equal copy, not the same object', () => {
  const cost = { wood: 10, stone: 5 };
  const out = applyCostReduction(cost, 0);
  assert.deepEqual(out, cost);
  assert.notEqual(out, cost);
});
