import test from 'node:test';
import assert from 'node:assert/strict';

import { SKILLS_CONFIG } from '../../js/entities/GAME_DATA.js';

const EXISTING_SKILL_IDS = [
  'charge', 'battle_cry', 'iron_will',
  'fireball', 'arcane_nova', 'mana_shield',
  'divine_shield', 'holy_light', 'consecration',
  'shadowstep', 'poison_blade', 'evasion',
];

test('the twelve pre-2c skills survive the move to data/heroSkills.js', () => {
  for (const id of EXISTING_SKILL_IDS) {
    assert.ok(SKILLS_CONFIG[id], `${id} is missing from SKILLS_CONFIG`);
    assert.equal(SKILLS_CONFIG[id].id, id, `${id} has a mismatched id field`);
  }
});

test('iron_will keeps its exact pre-2c effect', () => {
  assert.deepEqual(SKILLS_CONFIG.iron_will.effect, { stat: 'lossReduction', value: 0.08 });
  assert.equal(SKILLS_CONFIG.iron_will.unlockLevel, 20);
});

test('no skill uses the retired "active" type', () => {
  for (const skill of Object.values(SKILLS_CONFIG)) {
    assert.notEqual(skill.type, 'active', `${skill.id} still uses the retired 'active' type`);
  }
});

test('every skill declares a valid type, slot and domain', () => {
  const types   = new Set(['passive', 'support', 'major']);
  const domains = new Set(['combat', 'production', 'research', 'training']);
  for (const skill of Object.values(SKILLS_CONFIG)) {
    assert.ok(types.has(skill.type), `${skill.id} has invalid type '${skill.type}'`);
    assert.ok(domains.has(skill.domain), `${skill.id} has invalid domain '${skill.domain}'`);
    assert.ok(Number.isInteger(skill.slot) && skill.slot >= 1,
      `${skill.id} has invalid slot '${skill.slot}'`);
  }
});

test('the four pre-2c actives became support skills, keeping their triggers', () => {
  for (const id of ['charge', 'fireball', 'divine_shield', 'shadowstep']) {
    assert.equal(SKILLS_CONFIG[id].type, 'support', `${id} should be support`);
    assert.equal(SKILLS_CONFIG[id].effect.trigger, 'battle_start',
      `${id} lost its battle_start trigger`);
  }
});
