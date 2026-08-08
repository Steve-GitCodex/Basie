import test from 'node:test';
import assert from 'node:assert/strict';

import { resourceBonusFor, globalEffectBonus } from '../../js/systems/hero/heroProductionBonus.js';

const stationed = (heroId, buildingId, level = 1, stars = 0) => ({
  heroId, level, stars, assignment: { type: 'building', buildingId },
});

test('resourceBonusFor returns the base §I bonus at level 1, 0 stars', () => {
  assert.equal(resourceBonusFor(stationed('kaelenthorne', 'farm_0'), 'farm'), 0.15);
});

test('resourceBonusFor scales with level and stars per §I', () => {
  const lvl10 = resourceBonusFor(stationed('kaelenthorne', 'farm_0', 10, 0), 'farm');
  assert.ok(Math.abs(lvl10 - 0.15 * 1.09) < 1e-9, 'level 10 → ×(1 + 0.01·9)');

  const star5 = resourceBonusFor(stationed('kaelenthorne', 'farm_0', 1, 5), 'farm');
  assert.ok(Math.abs(star5 - 0.15 * 1.10) < 1e-9, '5 stars → ×(1 + 0.02·5)');
});

test('resourceBonusFor returns 0 when the building type does not match the hero', () => {
  assert.equal(resourceBonusFor(stationed('kaelenthorne', 'mine_0'), 'mine'), 0);
});

test('resourceBonusFor returns 0 for heroes whose effect is not a resource output', () => {
  assert.equal(resourceBonusFor(stationed('warlord', 'barracks_0'), 'barracks'), 0,
    'trainingSpeed is a global effect, never a per-instance resource bonus');
});

test('resourceBonusFor returns 0 for an unknown hero or a hero with no buildingBonus', () => {
  assert.equal(resourceBonusFor(stationed('nope', 'farm_0'), 'farm'), 0);
  assert.equal(resourceBonusFor(stationed('shadowblade', 'farm_0'), 'farm'), 0);
});

test('resourceBonusFor returns 0 for paladin — heroquarters has no statEffectMap entry', () => {
  assert.equal(resourceBonusFor(stationed('paladin', 'heroquarters_0'), 'heroquarters'), 0);
});

test('globalEffectBonus sums trainingSpeed and researchSpeed across stationed heroes', () => {
  const map = globalEffectBonus([
    stationed('warlord', 'barracks_0'),
    stationed('archsorceress', 'workshop_0'),
    stationed('junovane', 'workshop_1'),
  ]);
  assert.ok(Math.abs(map.trainingSpeed - 0.12) < 1e-9);
  assert.ok(Math.abs(map.researchSpeed - 0.24) < 1e-9, 'two workshop heroes stack additively');
});

test('globalEffectBonus excludes resource heroes and unstationed heroes', () => {
  const map = globalEffectBonus([
    stationed('kaelenthorne', 'farm_0'),
    { heroId: 'warlord', level: 1, stars: 0 },
    { heroId: 'archsorceress', level: 1, stars: 0, assignment: { type: 'squad', squadId: 's1' } },
  ]);
  assert.deepEqual(map, {});
});

test('globalEffectBonus scales with level and stars', () => {
  const map = globalEffectBonus([stationed('warlord', 'barracks_0', 10, 5)]);
  assert.ok(Math.abs(map.trainingSpeed - 0.12 * 1.09 * 1.10) < 1e-9);
});
