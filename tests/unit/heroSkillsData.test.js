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
