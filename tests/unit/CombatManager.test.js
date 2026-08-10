import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatManager } from '../../js/systems/CombatManager.js';
import { SKILLS_CONFIG } from '../../js/entities/GAME_DATA.js';
import { bucketTriggeredByEvent, sumTriggeredEffects } from '../../js/systems/hero/heroSkills.js';

const ARMY = [{ unitId: 'test_grunt', tier: 1, count: 10 }];

function makeMonster(waveCount = 3) {
  return {
    id: 'test_target',
    name: 'Test Target',
    waves: Array.from({ length: waveCount }, (_, i) => ({
      name: `Wave ${i + 1}`, hp: 5000, count: 2, attack: 1,
    })),
  };
}

function entry(skillId, level = 1) {
  return { heroId: 'test_hero', skill: SKILLS_CONFIG[skillId], level };
}

function makeCombat(entries = []) {
  const triggeredByEvent = bucketTriggeredByEvent(entries);
  const heroManager = {
    getCombatBonuses: () => ({
      attackMult: 1, defenseMult: 1, lossReduction: 0, postBattleHeal: 0,
      triggeredByEvent, activeSkills: triggeredByEvent.battle_start,
      productionBuffMult: 0,
    }),
  };
  const unitManager = { getSquad: () => ({ units: ARMY }), isSquadDeployed: () => false };
  return new CombatManager(unitManager, {}, {}, heroManager, null);
}

function roundsPerWave(entries, waveCount = 3) {
  const result = makeCombat(entries)._simulateBattle(ARMY, makeMonster(waveCount));
  return result.waveDetails.map(d => d.rounds);
}

test('a battle with no triggered skills is the control baseline', () => {
  const result = makeCombat()._simulateBattle(ARMY, makeMonster());
  assert.equal(result.waveDetails.length, 3, 'all three waves should resolve');
  assert.equal(result.victory, true, 'the control fixture must survive, or the probes are invalid');
  assert.ok(result.waveDetails.every(d => d.rounds > 0));
});

test('summed defenseBonus above 1.0 is reachable from real config magnitudes', () => {
  const worstCase = sumTriggeredEffects([
    entry('divine_shield', 10), entry('emp_burst', 10),
    entry('aegis_of_the_faithful', 1), entry('static_ward', 1),
  ]);
  assert.ok(worstCase.defenseBonus > 1.0,
    `the clamp fixture is no longer a worst case — got ${worstCase.defenseBonus}`);
});

test('an over-100% defenseBonus never heals the player or deals negative damage', () => {
  const entries = [
    entry('divine_shield', 10), entry('emp_burst', 10),
    entry('aegis_of_the_faithful', 1), entry('static_ward', 1),
  ];
  assert.ok(sumTriggeredEffects(entries.filter(e => e.skill.effect.trigger !== 'losing'))
    .defenseBonus > 1.0, 'the reachable (non-losing) subset must still exceed 1.0');

  const result = makeCombat(entries)._simulateBattle(ARMY, makeMonster());
  const startHP = result.initialPlayerHP;

  for (const detail of result.waveDetails) {
    assert.ok(detail.dmgReceived >= 0,
      `wave ${detail.waveIndex} took negative damage (${detail.dmgReceived})`);
    assert.ok(detail.playerHP <= Math.round(startHP),
      `wave ${detail.waveIndex} left HP at ${detail.playerHP}, above the starting ${startHP}`);
  }
  assert.ok(result.survivalRate <= 1, `survivalRate ${result.survivalRate} exceeded 1`);
});

test('a duration-1 battle_start skill contributes on wave 0 only', () => {
  const base = roundsPerWave([]);
  const withCharge = roundsPerWave([entry('charge')]);

  assert.ok(withCharge[0] < base[0], 'charge did not apply on the first wave');
  assert.equal(withCharge[1], base[1], 'a duration-1 skill leaked into wave 1');
  assert.equal(withCharge[2], base[2], 'a duration-1 skill leaked into wave 2');
});

test('a duration-2 battle_start skill contributes on waves 0 and 1 only', () => {
  const base = roundsPerWave([]);
  const withCataclysm = roundsPerWave([entry('cataclysm')]);

  assert.equal(SKILLS_CONFIG.cataclysm.effect.duration, 2, 'cataclysm must stay duration 2');
  assert.ok(withCataclysm[0] < base[0], 'cataclysm did not apply on wave 0');
  assert.ok(withCataclysm[1] < base[1], 'cataclysm did not apply on wave 1');
  assert.equal(withCataclysm[2], base[2], 'a duration-2 skill leaked into wave 2');
});

test('a battle_start skill is applied exactly once per applicable wave', () => {
  const base    = roundsPerWave([]);
  const once    = roundsPerWave([entry('charge')]);
  const twice   = roundsPerWave([entry('charge'), entry('charge')]);

  assert.ok(once[0] < base[0], 'the probe is invalid — charge had no effect');
  assert.ok(twice[0] < once[0], 'the probe is invalid — a doubled bucket must be distinguishable');
  assert.ok(once[0] > twice[0], 'charge was applied twice on the first wave');
});

test('a wave_start skill contributes on every wave', () => {
  const base = roundsPerWave([]);
  const withRally = roundsPerWave([entry('rally')]);

  for (const [i, rounds] of withRally.entries()) {
    assert.ok(rounds < base[i], `rally did not apply on wave ${i}`);
  }
});

test('a final_wave skill contributes on the last wave only', () => {
  const base = roundsPerWave([]);
  const withNova = roundsPerWave([entry('mana_surge')]);

  assert.equal(withNova[0], base[0], 'a final_wave skill leaked into wave 0');
  assert.equal(withNova[1], base[1], 'a final_wave skill leaked into wave 1');
  assert.ok(withNova[2] < base[2], 'mana_surge did not apply on the final wave');
});

test('a levelled support scales its triggered magnitude inside the wave loop', () => {
  const l1  = roundsPerWave([entry('charge', 1)]);
  const l10 = roundsPerWave([entry('charge', 10)]);
  assert.ok(l10[0] < l1[0], 'levelling charge to 10 changed nothing in the battle');
});
