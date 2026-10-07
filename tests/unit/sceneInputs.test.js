import test from 'node:test';
import assert from 'node:assert/strict';

import { sceneInputs } from '../../js/ui/combat/scene/sceneInputs.js';
import { CAMPAIGN_STAGES, eliteFor } from '../../js/systems/campaign/campaignStages.js';

const SQUAD = 'sq1';
const BARRACKS = 'barracks_0';

function hero(id, buildingId, slotIndex = null) {
  return {
    id, isOwned: true, level: 3, stars: 1, skillLevels: {},
    assignment: { type: 'building', buildingId, slotIndex },
  };
}

function stubSystems({ slotUnits, roster, barracksLevel = 30 }) {
  return {
    um: {
      getSquad: () => ({ barracksInstanceId: BARRACKS, units: [] }),
      getSlotUnit: (_id, slotIndex) => slotUnits[slotIndex] ?? null,
      getSlotRow: () => 'front',
    },
    bm: { getInstanceLevelOf: () => barracksLevel, getLevelOf: () => 30 },
    heroes: {
      barracksIdForSquad: () => BARRACKS,
      getRosterWithState: () => roster,
      getCombatBonuses: () => ({}),
    },
  };
}

const regular = CAMPAIGN_STAGES.find(s => s.kind === 'regular');
const boss = CAMPAIGN_STAGES.find(s => s.kind === 'boss');

const slotUnits = {
  0: { unitId: 'infantry', tier: 2, count: 40 },
  1: { unitId: 'ranged', tier: 1, count: 20 },
  2: { unitId: 'cavalry', tier: 1, count: 10 },
};
const roster = [
  hero('warlord', BARRACKS, 0),
  hero('ranger', BARRACKS, 1),
  hero('cleric', 'heroquarters_0'),
  hero('idle', 'lumbermill_0'),
];

test('heroesBySlot maps each led slot unit tierKey to its hero', () => {
  const out = sceneInputs(stubSystems({ slotUnits, roster }), { stageId: regular.id, squadId: SQUAD });
  assert.deepEqual(out.heroesBySlot, { infantry_t2: 'warlord', ranged_t1: 'ranger' });
});

test('squadHeroes carry slot and stack id; support heroes listed separately', () => {
  const out = sceneInputs(stubSystems({ slotUnits, roster }), { stageId: regular.id, squadId: SQUAD });
  assert.deepEqual(out.squadHeroes, [
    { heroId: 'warlord', slotIndex: 0, stackId: 'infantry_t2' },
    { heroId: 'ranger', slotIndex: 1, stackId: 'ranged_t1' },
  ]);
  assert.deepEqual(out.supportHeroes, [{ heroId: 'cleric' }]);
});

test('a hero on an empty slot leads no stack', () => {
  const out = sceneInputs(stubSystems({ slotUnits: { 0: slotUnits[0] }, roster }), { stageId: regular.id, squadId: SQUAD });
  assert.deepEqual(out.heroesBySlot, { infantry_t2: 'warlord' });
  assert.deepEqual(out.squadHeroes.find(h => h.heroId === 'ranger'), { heroId: 'ranger', slotIndex: 1, stackId: null });
});

test('emptySlots lists unlocked slots holding units with no hero', () => {
  const out = sceneInputs(stubSystems({ slotUnits, roster }), { stageId: regular.id, squadId: SQUAD });
  assert.deepEqual(out.emptySlots, [2]);
});

test('locked slots are never empty commander slots', () => {
  const out = sceneInputs(stubSystems({ slotUnits, roster: [], barracksLevel: 1 }), { stageId: regular.id, squadId: SQUAD });
  assert.deepEqual(out.emptySlots, [0]);
});

test('bossWaveIndex is the last wave on boss and elite stages, null otherwise', () => {
  const systems = stubSystems({ slotUnits, roster });
  assert.equal(sceneInputs(systems, { stageId: regular.id, squadId: SQUAD }).bossWaveIndex, null);
  assert.equal(sceneInputs(systems, { stageId: boss.id, squadId: SQUAD }).bossWaveIndex, boss.monster.waves.length - 1);
  const elite = eliteFor(1);
  assert.equal(sceneInputs(systems, { stageId: elite.id, squadId: SQUAD }).bossWaveIndex, elite.monster.waves.length - 1);
  assert.equal(sceneInputs(systems, { stageId: 'survival_wave', squadId: SQUAD }).bossWaveIndex, null);
});
