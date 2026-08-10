import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SKILL_LEVEL_CAP, MAJOR_SKILL_LEVEL_CAP,
  shardCostForSkillLevel, majorSkillCost,
  levelCapFor, defaultLevelFor, effectValueAt,
  reconcileSkillLevels, groupedSkillsFor, collectEffects, sumTriggeredEffects,
} from '../../js/systems/hero/heroSkills.js';
import { SKILLS_CONFIG, HEROES_CONFIG } from '../../js/entities/GAME_DATA.js';

test('a passive or support skill costs 29 shards to take from L1 to L10', () => {
  let total = 0;
  for (let l = 2; l <= SKILL_LEVEL_CAP; l++) total += shardCostForSkillLevel(l);
  assert.equal(total, 29);
});

test('the five levelable skills on a hero cost 145 shards to max', () => {
  let per = 0;
  for (let l = 2; l <= SKILL_LEVEL_CAP; l++) per += shardCostForSkillLevel(l);
  assert.equal(per * 5, 145);
});

test('the major track costs 68 shards across its five levels', () => {
  let total = 0;
  for (let l = 1; l <= MAJOR_SKILL_LEVEL_CAP; l++) total += majorSkillCost(l);
  assert.equal(total, 68);
});

test('costs outside the track return 0 rather than NaN or undefined', () => {
  assert.equal(shardCostForSkillLevel(1), 0);
  assert.equal(shardCostForSkillLevel(11), 0);
  assert.equal(majorSkillCost(0), 0);
  assert.equal(majorSkillCost(6), 0);
});

test('passive effects scale 15% per level, support effects 10%', () => {
  assert.equal(effectValueAt(SKILLS_CONFIG.iron_will, 0.08, 1), 0.08);
  assert.ok(Math.abs(effectValueAt(SKILLS_CONFIG.iron_will, 0.08, 10) - 0.188) < 1e-9);
  assert.ok(Math.abs(effectValueAt(SKILLS_CONFIG.charge, 0.20, 10) - 0.38) < 1e-9);
});

test('majors default to level 0 and cap at 5; others default to 1 and cap at 10', () => {
  const major = Object.values(SKILLS_CONFIG).find(s => s.type === 'major');
  assert.equal(defaultLevelFor(major), 0);
  assert.equal(levelCapFor(major), MAJOR_SKILL_LEVEL_CAP);
  assert.equal(defaultLevelFor(SKILLS_CONFIG.iron_will), 1);
  assert.equal(levelCapFor(SKILLS_CONFIG.iron_will), SKILL_LEVEL_CAP);
});

test('reconcile fills missing entries with the per-type default', () => {
  const out = reconcileSkillLevels('warlord', {});
  assert.equal(out.iron_will, 1, 'a missing passive should default to 1');
  assert.equal(out.last_stand, 0, 'a missing major should default to 0');
});

test('reconcile clamps over-cap levels and drops unknown ids', () => {
  const out = reconcileSkillLevels('warlord', {
    iron_will: 99, last_stand: 99, not_a_skill: 4, fireball: 3,
  });
  assert.equal(out.iron_will, SKILL_LEVEL_CAP);
  assert.equal(out.last_stand, MAJOR_SKILL_LEVEL_CAP);
  assert.equal(out.not_a_skill, undefined, 'unknown ids must be dropped');
  assert.equal(out.fireball, undefined, 'skills not on this hero must be dropped');
});

test('grouping returns exactly 3 / 2 / 1 for every hero', () => {
  for (const heroId of Object.keys(HEROES_CONFIG)) {
    const hero = { heroId, level: 100, stars: 10, skillLevels: {} };
    const g = groupedSkillsFor(heroId, hero);
    assert.equal(g.passive.length, 3, `${heroId} passive group`);
    assert.equal(g.support.length, 2, `${heroId} support group`);
    assert.equal(g.major.length,   1, `${heroId} major group`);
  }
});

test('a major is locked below star 5 and unlocked at star 5', () => {
  const below = groupedSkillsFor('warlord', { heroId: 'warlord', level: 100, stars: 4, skillLevels: {} });
  const at    = groupedSkillsFor('warlord', { heroId: 'warlord', level: 100, stars: 5, skillLevels: {} });
  assert.equal(below.major[0].unlocked, false);
  assert.equal(at.major[0].unlocked, true);
});

test('collectEffects aggregates a level-20 warlord\'s unlocked passives in one pass', () => {
  const hero = { heroId: 'warlord', level: 20, stars: 0, skillLevels: {} };
  const out = collectEffects(hero, {});
  assert.ok(out.lossReduction >= 0.08, 'iron_will lossReduction missing');
  assert.ok(out.attackMult >= 0.10, 'battle_cry squad attack missing');
  assert.ok(out.auraFrac > 0, 'commanding_presence aura fraction missing');
});

test('collectEffects ignores skills below their unlock level', () => {
  const hero = { heroId: 'warlord', level: 1, stars: 0, skillLevels: {} };
  const out = collectEffects(hero, {});
  assert.equal(out.lossReduction, 0, 'iron_will (Lv.20) leaked at level 1');
});

test('a level-0 major contributes nothing even at star 10', () => {
  const hero = { heroId: 'warlord', level: 100, stars: 10, skillLevels: { last_stand: 0 } };
  const out = collectEffects(hero, { trigger: 'losing' });
  assert.equal(out.triggered.find(t => t.skill.id === 'last_stand'), undefined,
    'an unpurchased major must not fire');
});

test('a purchased major stays locked below star 5 even at level 100', () => {
  const hero = { heroId: 'warlord', level: 100, stars: 4, skillLevels: { last_stand: 5 } };
  const out = collectEffects(hero, {});
  assert.equal(out.triggered.find(t => t.skill.id === 'last_stand'), undefined,
    'the star-5 major gate leaked at star 4');
});

test('omitting trigger returns every triggered skill; naming one filters to that bucket', () => {
  const hero = { heroId: 'warlord', level: 100, stars: 5, skillLevels: { last_stand: 1 } };
  assert.deepEqual(
    collectEffects(hero, {}).triggered.map(t => t.skill.id).sort(),
    ['charge', 'last_stand', 'rally'],
    'a null trigger must return all triggered skills, not none',
  );
  assert.deepEqual(
    collectEffects(hero, { trigger: 'battle_start' }).triggered.map(t => t.skill.id),
    ['charge'],
    'a named trigger must return only that bucket',
  );
});

test('a levelled support contributes a strictly larger triggered magnitude', () => {
  const entryAt = level => ({ heroId: 'warlord', skill: SKILLS_CONFIG.charge, level });
  const l1  = sumTriggeredEffects([entryAt(1)]);
  const l10 = sumTriggeredEffects([entryAt(10)]);
  assert.ok(Math.abs(l1.attackBonus - 0.20) < 1e-9, `L1 got ${l1.attackBonus}`);
  assert.ok(Math.abs(l10.attackBonus - 0.38) < 1e-9, `L10 got ${l10.attackBonus}`);
  assert.ok(l10.attackBonus > l1.attackBonus, 'levelling a support bought the player nothing');
});

test('sumTriggeredEffects folds every triggered magnitude kind', () => {
  const out = sumTriggeredEffects([
    { heroId: 'warlord',  skill: SKILLS_CONFIG.last_stand, level: 1 },
    { heroId: 'engineer', skill: SKILLS_CONFIG.static_ward, level: 1 },
    { heroId: 'rogue',    skill: SKILLS_CONFIG.shadowstep, level: 1 },
  ]);
  assert.ok(Math.abs(out.attackBonus - 0.30) < 1e-9);
  assert.ok(Math.abs(out.defenseBonus - 0.25) < 1e-9);
  assert.ok(Math.abs(out.lossReduction - 0.32) < 1e-9);
  assert.equal(out.evasion, true);
});
