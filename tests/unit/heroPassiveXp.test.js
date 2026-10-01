import test from 'node:test';
import assert from 'node:assert/strict';

import { drainPassiveXpTicks, passiveXpRecipients, isContributingAt } from '../../js/systems/hero/heroPassiveXp.js';

const posted = (heroId, buildingId, level = 1) => ({
  heroId, level, assignment: { type: 'building', buildingId },
});

test('drainPassiveXpTicks 25s at 10 → 2 ticks, 5 left', () => {
  assert.deepEqual(drainPassiveXpTicks(25, 10), { ticks: 2, remainder: 5 });
});

test('recipients exclude unassigned heroes and heroes posted at house', () => {
  const heroes = [
    posted('shadowblade', 'mine_0'),
    { heroId: 'b', level: 1, assignment: null },
    posted('c', 'house_0'),
  ];
  assert.deepEqual(passiveXpRecipients(heroes, 50), ['shadowblade']);
});

test('a hero exactly at levelCap − 20 gets nothing', () => {
  const heroes = [posted('shadowblade', 'mine_0', 30), posted('kaelenthorne', 'farm_0', 29)];
  assert.deepEqual(passiveXpRecipients(heroes, 50), ['kaelenthorne']);
});

test('levelCap 20 (HQ 2) yields no recipients at all', () => {
  assert.deepEqual(passiveXpRecipients([posted('shadowblade', 'mine_0', 1)], 20), []);
});

test('warlord at a farm earns nothing (no station match, no active skill)', () => {
  assert.deepEqual(passiveXpRecipients([posted('warlord', 'farm_0')], 50), []);
});

test('paladin at heroquarters earns', () => {
  assert.deepEqual(passiveXpRecipients([posted('paladin', 'heroquarters_0')], 50), ['paladin']);
});

test('kaelen at a storehouse earns via scavenge storageCap', () => {
  assert.deepEqual(passiveXpRecipients([posted('kaelenthorne', 'storehouse_0')], 50), ['kaelenthorne']);
});

test('a hero in a barracks earns via combat skills', () => {
  assert.deepEqual(passiveXpRecipients([posted('warlord', 'barracks_0')], 50), ['warlord']);
});

test('isContributingAt is false at a non-paying posting', () => {
  assert.equal(isContributingAt(posted('kaelenthorne', 'house_0'), 'house'), false);
});
