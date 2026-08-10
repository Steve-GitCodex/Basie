import test from 'node:test';
import assert from 'node:assert/strict';

import { SKILLS_CONFIG, HEROES_CONFIG, PROD_BONUS_CONFIG } from '../../js/entities/GAME_DATA.js';

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

const LIVE_EFFECT_KINDS = new Set([
  'attack', 'defense', 'lossReduction', 'auraValue', 'postBattleHeal',
  'attackBonus', 'defenseBonus', 'evasion',
  'money', 'food', 'wood', 'stone', 'iron',
  'trainingSpeed', 'researchSpeed',
]);

function effectKindsOf(skill) {
  const fx = skill.effect ?? {};
  const kinds = [];
  if (fx.stat) kinds.push(fx.stat);
  for (const k of ['attackBonus', 'defenseBonus', 'evasion', 'postBattleHeal',
                   'trainingSpeed', 'researchSpeed', 'resourceOutput']) {
    if (fx[k] != null) kinds.push(k === 'resourceOutput' ? 'money' : k);
  }
  return kinds;
}

test('every hero has exactly 6 skills composed 3 passive / 2 support / 1 major', () => {
  for (const hero of Object.values(HEROES_CONFIG)) {
    const skills = (hero.skills ?? []).map(id => SKILLS_CONFIG[id]);
    assert.equal(skills.length, 6, `${hero.id} has ${skills.length} skills, expected 6`);
    for (const [i, s] of skills.entries()) {
      assert.ok(s, `${hero.id}'s skill at index ${i} ('${hero.skills[i]}') is not in SKILLS_CONFIG`);
    }
    const byType = t => skills.filter(s => s.type === t).length;
    assert.equal(byType('passive'), 3, `${hero.id} has ${byType('passive')} passives, expected 3`);
    assert.equal(byType('support'), 2, `${hero.id} has ${byType('support')} supports, expected 2`);
    assert.equal(byType('major'),   1, `${hero.id} has ${byType('major')} majors, expected 1`);
  }
});

test('every authored effect kind lands on a hook that is live in the tree', () => {
  for (const skill of Object.values(SKILLS_CONFIG)) {
    for (const kind of effectKindsOf(skill)) {
      assert.ok(LIVE_EFFECT_KINDS.has(kind),
        `${skill.id} declares effect kind '${kind}', which has no live consumer — it belongs in Phase 2d`);
    }
  }
});

test('buildSpeed stays unauthored — it has no consumer (spec 2.1)', () => {
  assert.ok(PROD_BONUS_CONFIG.base.buildSpeed != null, 'buildSpeed config vanished');
  for (const skill of Object.values(SKILLS_CONFIG)) {
    assert.ok(!effectKindsOf(skill).includes('buildSpeed'),
      `${skill.id} declares buildSpeed, which has no consumer until Phase 2d`);
  }
});

test('no skill id is orphaned — every config entry is referenced by some hero', () => {
  const referenced = new Set(Object.values(HEROES_CONFIG).flatMap(h => h.skills ?? []));
  for (const id of Object.keys(SKILLS_CONFIG)) {
    assert.ok(referenced.has(id), `${id} is defined but no hero references it`);
  }
});
