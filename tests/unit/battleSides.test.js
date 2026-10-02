import test from 'node:test';
import assert from 'node:assert/strict';

import { squadSide, encounterSide } from '../../js/systems/combat/battleSides.js';
import { COMBAT_RULES } from '../../js/entities/data/combatRules.js';
import { UNITS_CONFIG } from '../../js/entities/GAME_DATA.js';

const neutralHero = () => ({
  attackMult: 1, defenseMult: 1, baseDefense: 0,
  statEntries: { lossReduction: [], postBattleHeal: [] },
  triggeredByEvent: { battle_start: [], wave_start: [], final_wave: [], losing: [] },
});

const unit = (unitId, tier, count) => ({ unitId, tier, tierKey: `${unitId}_t${tier}`, count });
const build = (over = {}) => squadSide({
  units: [unit('infantry', 1, 10)], slotRows: new Map(), heroBonus: neutralHero(), tech: {}, hq: {}, ...over,
});
const baseStats = UNITS_CONFIG.infantry.tiers[0].stats;
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} !~ ${expected}`);

test('tech, hero aura, HQ and milMult reach stack attack', () => {
  const side = build({
    tech: { attackBonus: 0.1 },
    heroBonus: { ...neutralHero(), attackMult: 1.2 },
    hq: { attackBonus: 0.05 },
    milMult: 1.5,
    modifier: { playerAttackMult: 2 },
  });
  close(side.stacks[0].attack, baseStats.attack * 1.1 * 1.2 * 1.05 * 1.5 * 2);
});

test('defense stacks baseDefense and HQ', () => {
  const side = build({
    tech: { defenseBonus: 3 },
    heroBonus: { ...neutralHero(), defenseMult: 1.1, baseDefense: 0.2 },
    hq: { defenseBonus: 0.1 },
  });
  close(side.stacks[0].defense, (baseStats.defense + 3) * 1.1 * 1.2 * 1.1);
});

test('hp scales with tech hpBonus and modifier playerHpMult', () => {
  const stack = build({ tech: { hpBonus: 0.1 }, modifier: { playerHpMult: 0.5 } }).stacks[0];
  close(stack.hp, baseStats.hp * 1.1 * 0.5);
  assert.equal(stack.count, 10);
  assert.equal(stack.startCount, 10);
  close(stack.hpPool, 10 * stack.hp);
});

test('milMult below 1 weakens the squad', () => {
  close(build({ milMult: 0.8 }).stacks[0].attack, build().stacks[0].attack * 0.8);
});

test('stack identity comes from tierKey, tier name and category', () => {
  const stack = build().stacks[0];
  assert.equal(stack.id, 'infantry_t1');
  assert.equal(stack.label, UNITS_CONFIG.infantry.tiers[0].name);
  assert.equal(stack.type, 'infantry');
  assert.equal(stack.tier, 1);
});

test('combat type is the unitId even when the config category is melee', () => {
  const stack = build({ units: [{ unitId: 'infantry', category: 'melee', tier: 1, tierKey: 'infantry_t1', count: 5 }] }).stacks[0];
  assert.equal(stack.type, 'infantry');
  assert.equal(stack.row, 'front');
});

test('unslotted units fight at their type default row', () => {
  const side = build({
    units: [unit('infantry', 1, 5), unit('cavalry', 1, 5), unit('ranged', 1, 5), unit('siege', 1, 5)],
  });
  const rows = Object.fromEntries(side.stacks.map((s) => [s.type, s.row]));
  assert.deepEqual(rows, COMBAT_RULES.DEFAULT_ROW);
});

test('slot rows override the default', () => {
  const side = build({ slotRows: new Map([['infantry_t1', 'back']]) });
  assert.equal(side.stacks[0].row, 'back');
});

test('units with no count are skipped', () => {
  const side = build({ units: [unit('infantry', 1, 0), unit('ranged', 1, 3)] });
  assert.deepEqual(side.stacks.map((s) => s.id), ['ranged_t1']);
});

test('stack order is deterministic: row then tierKey', () => {
  const units = [unit('ranged', 2, 1), unit('infantry', 2, 1), unit('infantry', 1, 1), unit('cavalry', 1, 1)];
  const slotRows = new Map([['ranged_t2', 'front']]);
  const forward = build({ units, slotRows }).stacks.map((s) => s.id);
  const reversed = build({ units: [...units].reverse(), slotRows }).stacks.map((s) => s.id);
  assert.deepEqual(forward, reversed);
  assert.deepEqual(forward, ['infantry_t1', 'infantry_t2', 'ranged_t2', 'cavalry_t1']);
});

test('side carries hero triggers, strikers, loss and heal entries and first wave bonus', () => {
  const lossEntry = { stat: 'lossReduction', category: 'hero', value: 0.1, sourceId: 'h' };
  const healEntry = { stat: 'postBattleHeal', category: 'hero', value: 0.2, sourceId: 'h' };
  const hero = {
    ...neutralHero(),
    statEntries: { lossReduction: [lossEntry], postBattleHeal: [healEntry] },
    strikers: [{ heroId: 'h' }],
  };
  const side = build({ heroBonus: hero, tech: { lossReduction: 0.15, firstWaveBonus: 0.25 } });
  assert.equal(side.triggers, hero.triggeredByEvent);
  assert.deepEqual(side.strikers, [{ heroId: 'h' }]);
  assert.equal(side.lossEntries[0], lossEntry);
  assert.deepEqual(side.lossEntries[1], { stat: 'lossReduction', category: 'tech', value: 0.15, sourceId: 'tech' });
  assert.deepEqual(side.healEntries, [healEntry]);
  assert.equal(side.firstWaveBonus, 0.25);
});

test('missing bonuses are neutral', () => {
  const side = squadSide({ units: [unit('infantry', 1, 1)], slotRows: new Map(), heroBonus: neutralHero() });
  assert.equal(side.stacks[0].attack, baseStats.attack);
  assert.equal(side.strikers.length, 0);
  assert.equal(side.firstWaveBonus, 0);
  assert.equal(side.lossEntries.at(-1).value, 0);
});

const monster = (stackOver = {}) => ({
  waves: [
    { name: 'Wave 1', stacks: [{ name: 'Grunt', tier: 2, type: 'infantry', row: 'front', hp: 100, attack: 10, count: 6, ...stackOver }] },
    { name: 'Wave 2', stacks: [{ name: 'Brute', tier: 3, type: 'cavalry', row: 'mid', hp: 200, attack: 20, count: 2, specialAbility: 'regen', abilityValue: 0.1 }] },
  ],
});
const normal = { enemyHpMult: 1, enemyAtkMult: 1 };

test('monster defense falls back to MONSTER_TIERS', () => {
  const side = encounterSide(monster(), { difficulty: normal });
  assert.equal(side.waves[0].stacks[0].defense, COMBAT_RULES.MONSTER_TIERS[1].defense);
  assert.equal(side.waves[1].stacks[0].defense, COMBAT_RULES.MONSTER_TIERS[2].defense);
});

test('explicit stack defense overrides the tier table', () => {
  const side = encounterSide(monster({ defense: 77 }), { difficulty: normal });
  assert.equal(side.waves[0].stacks[0].defense, 77);
});

test('difficulty and waveTransform scale monster stacks', () => {
  const modifier = { waveTransform: (w) => ({ ...w, attack: w.attack * 2 }) };
  const side = encounterSide(monster(), { difficulty: { enemyHpMult: 1.4, enemyAtkMult: 1.3 }, modifier });
  const stack = side.waves[0].stacks[0];
  assert.equal(stack.hp, 140);
  assert.equal(stack.attack, 26);
  assert.equal(stack.count, 6);
  assert.equal(stack.startCount, 6);
  assert.equal(stack.hpPool, 840);
});

test('monster stack shape and ability mapping', () => {
  const side = encounterSide(monster(), { difficulty: normal });
  assert.deepEqual(side.waves.map((w) => w.name), ['Wave 1', 'Wave 2']);
  const first = side.waves[0].stacks[0];
  assert.equal(first.id, '0:0');
  assert.equal(first.label, 'Grunt');
  assert.equal(first.type, 'infantry');
  assert.equal(first.row, 'front');
  assert.equal(first.tier, 2);
  assert.equal('ability' in first, false);
  assert.deepEqual(side.waves[1].stacks[0].ability, { kind: 'regen', value: 0.1 });
  assert.equal(side.waves[1].stacks[0].id, '1:0');
});

test('player stacks carry tierKey so resolveBattle casualties key by it', () => {
  assert.equal(build().stacks[0].tierKey, 'infantry_t1');
});
