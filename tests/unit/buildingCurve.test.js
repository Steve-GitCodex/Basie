import test from 'node:test';
import assert from 'node:assert/strict';

import { costFactor, timeFactor, prodFactor, levelCap, eraAt, upgradeCost } from '../../js/systems/building/buildingCurve.js';
import { BUILDINGS_CONFIG } from '../../js/entities/GAME_DATA.js';

test('costFactor anchors', () => {
  assert.equal(costFactor(1), 1);
  assert.ok(Math.abs(costFactor(10) - 1.65 ** 9) < 1e-9);
  assert.ok(Math.abs(costFactor(20) / costFactor(10) - 1.45 ** 10) < 1e-6);
  assert.ok(Math.abs(costFactor(30) / costFactor(20) - 1.30 ** 10) < 1e-6);
});

test('HQ 1-10 cost equals today scaleCost exactly', () => {
  const hq = BUILDINGS_CONFIG.townhall;
  for (let lvl = 0; lvl < 10; lvl++) for (const [r, b] of Object.entries(hq.baseCost))
    assert.equal(upgradeCost(hq, lvl)[r], Math.floor(b * 1.65 ** lvl));
});

test('timeFactor is linear to 10 then banded', () => {
  assert.equal(timeFactor(7), 7);
  assert.ok(Math.abs(timeFactor(20) - 10 * 1.35 ** 10) < 1e-6);
  assert.ok(Math.abs(timeFactor(30) - 10 * 1.35 ** 10 * 1.2 ** 10) < 1e-6);
});

test('prodFactor', () => {
  assert.equal(prodFactor(10), 10);
  assert.ok(Math.abs(prodFactor(20) - 10 * 1.09 ** 10) < 1e-9);
});

test('levelCap proportional and exempt', () => {
  assert.equal(levelCap({ maxLevel: 30 }, 7), 7);
  assert.equal(levelCap({ maxLevel: 20 }, 3), 2);
  assert.equal(levelCap({ maxLevel: 10 }, 1), 1);
  assert.equal(levelCap({ maxLevel: 3, capRule: 'none' }, 1), 3);
});

test('eraAt boundaries', () => {
  assert.deepEqual([1, 2, 3, 4, 8, 9, 25, 26, 30].map(eraAt), [1, 2, 2, 3, 4, 5, 9, 10, 10]);
});

test('curves are monotonic to 30', () => {
  for (let L = 2; L <= 30; L++) {
    assert.ok(costFactor(L) > costFactor(L - 1));
    assert.ok(timeFactor(L) > timeFactor(L - 1));
  }
});

test('upgradeTime equals the legacy buildTime x level for HQ levels 1-10', async () => {
  const { upgradeTime } = await import('../../js/systems/building/buildingCurve.js');
  const hq = BUILDINGS_CONFIG.townhall;
  for (let lvl = 1; lvl <= 10; lvl++) assert.equal(upgradeTime(hq, lvl), hq.buildTime * lvl);
});
