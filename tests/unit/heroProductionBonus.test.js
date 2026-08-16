import test from 'node:test';
import assert from 'node:assert/strict';

import { resourceBonusFor, globalEffectBonus, skillBonusFor } from '../../js/systems/hero/heroProductionBonus.js';
import { HeroManager } from '../../js/systems/HeroManager.js';

const stationed = (heroId, buildingId, level = 1, stars = 0) => ({
  heroId, level, stars, assignment: { type: 'building', buildingId },
});

test('resourceBonusFor returns the base §I bonus plus the level-1 scavenge term at level 1, 0 stars', () => {
  assert.equal(resourceBonusFor(stationed('kaelenthorne', 'farm_0'), 'farm'), 0.15 + 0.10);
});

test('resourceBonusFor scales the station term with level and stars per §I', () => {
  const lvl10 = resourceBonusFor(stationed('kaelenthorne', 'farm_0', 10, 0), 'farm');
  assert.ok(Math.abs(lvl10 - (0.15 * 1.09 + 0.10)) < 1e-9, 'level 10 → station ×(1 + 0.01·9)');

  const star5 = resourceBonusFor(stationed('kaelenthorne', 'farm_0', 1, 5), 'farm');
  assert.ok(Math.abs(star5 - (0.15 * 1.10 + 0.10)) < 1e-9, '5 stars → station ×(1 + 0.02·5)');
});

test('resourceBonusFor drops the station term when the building type does not match the hero, keeping the skill term', () => {
  assert.equal(resourceBonusFor(stationed('kaelenthorne', 'mine_0'), 'mine'), 0.10,
    'station term must be absent off-type; only scavenge pays');
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
  assert.ok(Math.abs(map.researchSpeed - (0.12 + 0.08 + 0.12 + 0.10)) < 1e-9,
    'two workshop heroes stack additively, each station term plus their own research skill');
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

function managerWith(buildingId) {
  const m = new HeroManager(
    { canAfford: () => true, spend() {}, add() {}, getSnapshot: () => ({}) },
    { getLevelOf: () => 10 },
    { hasItem: () => false, removeItem: () => false, addItem: () => true, getQuantity: () => 0 },
  );
  m._owned.set('kaelenthorne', {
    heroId: 'kaelenthorne', level: 20, stars: 0, skillLevels: {},
    assignment: { type: 'building', buildingId },
  });
  return m;
}

test('a hero in a bank yields resource output and zero combat contribution', () => {
  const m = managerWith('bank_0');
  const hero = m._owned.get('kaelenthorne');
  assert.ok(resourceBonusFor(hero, 'bank') > 0, 'bank posting pays no resource bonus');

  const combat = m.getCombatBonuses();
  assert.equal(combat.lossReduction, 0, 'grit leaked out of a bank posting');
  assert.equal(combat.triggeredByEvent.losing.length, 0, 'safe_route leaked out of a bank posting');
});

test('the same hero in a barracks yields combat and zero resource output', () => {
  const m = managerWith('barracks_0');
  const hero = m._owned.get('kaelenthorne');
  assert.equal(resourceBonusFor(hero, 'bank'), 0, 'resource output paid from a barracks posting');
  assert.ok(globalEffectBonus([hero]).trainingSpeed > 0, 'trail_marks did not reach trainingSpeed');

  const combat = m.getCombatBonuses();
  assert.ok(combat.lossReduction > 0, 'grit did not pay from a barracks posting');
  assert.ok(combat.triggeredByEvent.losing.length > 0, 'safe_route did not pay from a barracks posting');
});

test('a skill bonus composes with the station bonus instead of replacing it', () => {
  const bare = {
    heroId: 'kaelenthorne', level: 20, stars: 0, skillLevels: { scavenge: 1 },
    assignment: { type: 'building', buildingId: 'farm_0' },
  };
  const levelled = { ...bare, skillLevels: { scavenge: 10 } };
  const a = resourceBonusFor(bare, 'farm');
  const b = resourceBonusFor(levelled, 'farm');
  assert.ok(a > 0, 'station bonus vanished');
  assert.ok(b > a, 'leveling scavenge did not increase output — the terms are not composing');

  const station   = 0.15 * 1.19;
  const skillOnly = skillBonusFor(levelled, 'farm', 'food');
  assert.ok(Math.abs(skillOnly - 0.10 * (1 + 0.15 * 9)) < 1e-9, 'scavenge L10 = 0.10·(1 + 0.15·9)');
  assert.ok(b > station,   'the skill term replaced the station term');
  assert.ok(b > skillOnly, 'the station term replaced the skill term');
  assert.ok(Math.abs(b - (station + skillOnly)) < 1e-9, 'the total is exactly both terms summed');
});

test('an unassigned hero contributes nothing at all', () => {
  const hero = { heroId: 'kaelenthorne', level: 20, stars: 0, skillLevels: {}, assignment: { type: 'none' } };
  assert.equal(resourceBonusFor(hero, 'farm'), 0);
  assert.deepEqual(globalEffectBonus([hero]), {});
});

test('wastelands_bounty pays its resource half in a farm and its training half in a barracks, never both', () => {
  const base = { heroId: 'kaelenthorne', level: 100, stars: 5, skillLevels: { wastelands_bounty: 1 } };
  const inFarm     = { ...base, assignment: { type: 'building', buildingId: 'farm_0' } };
  const inBarracks = { ...base, assignment: { type: 'building', buildingId: 'barracks_0' } };

  assert.ok(skillBonusFor(inFarm, 'farm', 'food') > 0, 'resource half dormant in a farm');
  assert.equal(skillBonusFor(inFarm, 'farm', 'trainingSpeed'), 0, 'training half fired in a farm');
  assert.ok(skillBonusFor(inBarracks, 'barracks', 'trainingSpeed') > 0, 'training half dormant in a barracks');
  assert.equal(skillBonusFor(inBarracks, 'barracks', 'food'), 0, 'resource half fired in a barracks');
});
