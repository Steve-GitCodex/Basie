import test from 'node:test';
import assert from 'node:assert/strict';

import { headquarters } from '../../js/systems/building/headquarters.js';
import { HQ_BENEFITS_BY_ERA } from '../../js/entities/data/buildings.js';
import { ERA_HQ, HQ_MAX } from '../../js/entities/data/buildingCurve.js';

const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} vs ${expected}`);

test('cumulative HQ benefits at M(n) equal the era-n anchor', () => {
  ERA_HQ.forEach((hq, i) => {
    const got = headquarters.benefits(hq);
    for (const [key, value] of Object.entries(HQ_BENEFITS_BY_ERA[i])) near(got[key], value, `HQ ${hq} ${key}`);
  });
});

test('attack bonus follows the design: +7% HQ9, +21% HQ15, +44% HQ22, +59% HQ26, +67% at HQ_MAX', () => {
  for (const [hq, attack] of [[9, 0.07], [15, 0.21], [22, 0.44], [26, 0.59]]) near(headquarters.benefits(hq).attackBonus, attack, `HQ ${hq}`);
  near(headquarters.benefits(HQ_MAX).attackBonus, 0.67, 'HQ_MAX');
});

test('the capstone scales every benefit by the attack ratio 67/59', () => {
  const last = HQ_BENEFITS_BY_ERA[HQ_BENEFITS_BY_ERA.length - 1];
  const top = headquarters.benefits(HQ_MAX);
  for (const [key, value] of Object.entries(last)) assert.ok(Math.abs(top[key] - value * 0.67 / 0.59) < 1e-4, key);
});

test('HQ benefits keep rising every level up to HQ_MAX', () => {
  for (let hq = 3; hq <= HQ_MAX; hq++) {
    const now = headquarters.benefits(hq);
    const before = headquarters.benefits(hq - 1);
    assert.ok(now.attackBonus > before.attackBonus, `attack plateaus at HQ ${hq}`);
    assert.ok(now.productionBonus > before.productionBonus, `production plateaus at HQ ${hq}`);
  }
});

test('requiredLevel reports the remapped HQ gate', () => {
  assert.equal(headquarters.requiredLevel('buildings', 'workshop'), 9);
  assert.equal(headquarters.requiredLevel('units', 'cavalry'), 6);
  assert.equal(headquarters.requiredLevel('techs', 'siege_mastery'), 15);
  assert.equal(headquarters.unlockedIds(8, 'units').has('siege'), false);
  assert.equal(headquarters.unlockedIds(9, 'units').has('siege'), true);
});

test('defence and storage benefits never drop on the way to HQ_MAX', () => {
  for (let hq = 2; hq <= HQ_MAX; hq++) {
    const now = headquarters.benefits(hq);
    const before = headquarters.benefits(hq - 1);
    assert.ok(now.defenseBonus >= before.defenseBonus, `defence drops at HQ ${hq}`);
    assert.ok(now.storageBonus >= before.storageBonus, `storage drops at HQ ${hq}`);
  }
  assert.ok(headquarters.benefits(HQ_MAX).defenseBonus > HQ_BENEFITS_BY_ERA.at(-1).defenseBonus);
  assert.ok(headquarters.benefits(HQ_MAX).storageBonus > HQ_BENEFITS_BY_ERA.at(-1).storageBonus);
});
