import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveBattle } from '../../js/systems/combat/resolveBattle.js';
import { COMBAT_RULES } from '../../js/entities/data/combatRules.js';

const FOOTMAN = { type: 'infantry', tier: 1, hp: 120, attack: 14, defense: 10, tierKey: 'infantry_t1' };
const PALADIN = { type: 'infantry', tier: 5, hp: 540, attack: 56, defense: 38, tierKey: 'infantry_t5' };
const DEF_100 = { type: 'infantry', tier: 6, hp: 750, attack: 76, defense: 100 };
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const stack = (over) => {
  const base = { id: 's', label: 's', type: 'infantry', tier: 1, row: 'front', count: 1, hp: 100, attack: 10, defense: 10, ...over };
  return { startCount: base.count, hpPool: base.count * base.hp, ...base };
};

const attackerSide = (stacks, extra = {}) => ({
  stacks,
  strikers: [],
  triggers: { battle_start: [], wave_start: [], final_wave: [], losing: [] },
  lossEntries: [],
  healEntries: [],
  firstWaveBonus: 0,
  ...extra,
});

const defenderSide = (...waves) => ({ waves: waves.map((stacks, i) => ({ name: `W${i + 1}`, stacks })) });

const trigger = (event, effect) => ({ heroId: 'h1', skill: { id: `sk_${event}`, type: 'major', effect: { trigger: event, ...effect } }, level: 1 });

const withTriggers = (buckets) => ({ battle_start: [], wave_start: [], final_wave: [], losing: [], ...buckets });

const winsOver = (build) => SEEDS.filter((seed) => {
  const { attacker, defender } = build();
  return resolveBattle(attacker, defender, { seed }).victory;
}).length;

const footmen = (count, over = {}) => stack({ ...FOOTMAN, id: 'foot', count, ...over });

test('same inputs and seed give an identical report', () => {
  const build = () => [attackerSide([footmen(30)]), defenderSide([stack({ ...DEF_100, id: 'm' })])];
  assert.deepEqual(resolveBattle(...build(), { seed: 7 }), resolveBattle(...build(), { seed: 7 }));
});

test('inputs are not mutated', () => {
  const attacker = attackerSide([footmen(30)], { strikers: [{ heroId: 'h1', slotIndex: 0, attack: 50, level: 3 }] });
  const defender = defenderSide([stack({ ...DEF_100, id: 'm' })], [footmen(5, { id: 'f2' })]);
  const before = structuredClone({ attacker, defender });
  resolveBattle(attacker, defender, { seed: 3 });
  assert.deepEqual({ attacker, defender }, before);
});

test('report carries the spec shape', () => {
  const report = resolveBattle(attackerSide([footmen(30)]), defenderSide([footmen(2, { id: 'd' })]), { seed: 1 });
  assert.equal(report.rulesVersion, COMBAT_RULES.RULES_VERSION);
  assert.equal(report.seed, 1);
  assert.equal(report.roundsTotal, report.waves[0].rounds.length);
  assert.deepEqual(Object.keys(report.waves[0].rounds[0]).sort(), ['attacker', 'defender', 'heroHits']);
  assert.deepEqual(Object.keys(report.waves[0].rounds[0].attacker[0]).sort(), ['count', 'hpPool', 'id']);
  assert.equal(report.initial.attacker[0].count, 30);
  assert.equal(report.initial.defender[0][0].count, 2);
  for (const key of ['fallen', 'healed', 'wounded', 'dead']) assert.equal(typeof report[key], 'object');
});

test('10 Footmen lose to a defense-100 tier-6 stack', () => {
  const wins = winsOver(() => ({ attacker: attackerSide([footmen(10)]), defender: defenderSide([stack({ ...DEF_100, id: 'm' })]) }));
  assert.ok(wins < 5, `won ${wins}/10`);
});

test('50 Footmen beat the same defense-100 stack', () => {
  const wins = winsOver(() => ({ attacker: attackerSide([footmen(50)]), defender: defenderSide([stack({ ...DEF_100, id: 'm' })]) }));
  assert.ok(wins > 5, `won ${wins}/10`);
});

test('1 Paladin beats 8 Footmen', () => {
  const wins = winsOver(() => ({
    attacker: attackerSide([stack({ ...PALADIN, id: 'pal', count: 1 })]),
    defender: defenderSide([footmen(8, { id: 'd' })]),
  }));
  assert.ok(wins > 5, `won ${wins}/10`);
});

test('20 Footmen beat 1 Paladin', () => {
  const wins = winsOver(() => ({
    attacker: attackerSide([footmen(20)]),
    defender: defenderSide([stack({ ...PALADIN, id: 'pal', count: 1 })]),
  }));
  assert.ok(wins > 5, `won ${wins}/10`);
});

test('front row absorbs hits before the back row', () => {
  const front = footmen(10, { id: 'front', tierKey: 'infantry_t1' });
  const back = stack({ ...FOOTMAN, id: 'back', type: 'ranged', row: 'back', count: 10, tierKey: 'ranged_t1' });
  const monster = stack({ id: 'm', tier: 6, hp: 1e6, attack: 66, defense: 0 });
  const report = resolveBattle(attackerSide([front, back]), defenderSide([monster]), { seed: 1 });
  assert.ok((report.fallen.ranged_t1 ?? 0) < report.fallen.infantry_t1);
});

test('reaching the round cap is a defeat', () => {
  const report = resolveBattle(
    attackerSide([footmen(1)]),
    defenderSide([stack({ id: 'wall', hp: 1e6, attack: 0, defense: 0 })]),
    { seed: 1 },
  );
  assert.equal(report.victory, false);
  assert.equal(report.roundsTotal, COMBAT_RULES.ROUND_CAP);
});

test('survivors carry into the next wave', () => {
  const report = resolveBattle(
    attackerSide([footmen(30)]),
    defenderSide([stack({ id: 'brute', hp: 300, attack: 120, defense: 0, count: 2 })], [stack({ id: 'dummy', hp: 100, attack: 0, defense: 0, count: 1 })]),
    { seed: 1 },
  );
  const wave1End = report.waves[0].rounds.at(-1).attacker[0];
  const wave2Start = report.waves[1].rounds[0].attacker[0];
  assert.ok(wave1End.count < 30);
  assert.equal(wave2Start.count, wave1End.count);
  assert.equal(wave2Start.hpPool, wave1End.hpPool);
});

test('heal regains lost HP each round', () => {
  const run = (ability) => resolveBattle(
    attackerSide([footmen(5)]),
    defenderSide([stack({ id: 'h', hp: 100, attack: 0, defense: 0, count: 10, ability })]),
    { seed: 1 },
  );
  const healed = run({ kind: 'heal', value: 0.5 }).waves[0].rounds[1].defender[0];
  const plain = run(undefined).waves[0].rounds[1].defender[0];
  assert.ok(healed.hpPool > plain.hpPool);
  assert.ok(healed.hpPool <= 1000);
});

test('revive returns the stack once', () => {
  const report = resolveBattle(
    attackerSide([footmen(100)]),
    defenderSide([stack({ id: 'r', hp: 10, attack: 0, defense: 0, count: 4, ability: { kind: 'revive', value: 0.5 } })]),
    { seed: 1 },
  );
  const rounds = report.waves[0].rounds;
  assert.deepEqual(rounds[0].defender[0], { id: 'r', count: 2, hpPool: 20 });
  assert.equal(rounds[1].defender[0].count, 0);
  assert.equal(rounds.length, 2);
  assert.equal(report.victory, true);
});

test('aoe_blast hits every row', () => {
  const run = (ability) => resolveBattle(
    attackerSide([footmen(10, { id: 'front' }), stack({ ...FOOTMAN, id: 'back', type: 'ranged', row: 'back', count: 10, tierKey: 'ranged_t1' })]),
    defenderSide([stack({ id: 'b', hp: 1e6, attack: 50, defense: 0, ability })]),
    { seed: 1 },
  );
  const backAfter = (report) => report.waves[0].rounds[0].attacker.find((s) => s.id === 'back').hpPool;
  assert.ok(backAfter(run({ kind: 'aoe_blast', value: 1 })) < 1200);
  assert.equal(backAfter(run(undefined)), 1200);
});

test('hero strikes land kills', () => {
  const report = resolveBattle(
    attackerSide([stack({ id: 'shield', hp: 1e6, attack: 0, defense: 0, tierKey: 'x' })], { strikers: [{ heroId: 'h1', slotIndex: 0, attack: 160, level: 1 }] }),
    defenderSide([footmen(20, { id: 'd' })]),
    { seed: 1 },
  );
  const hits = report.waves[0].rounds.flatMap((r) => r.heroHits);
  assert.ok(hits.length > 0);
  assert.ok(hits.some((h) => h.heroId === 'h1' && h.targetId === 'd' && h.kills > 0 && h.damage > 0));
  assert.equal(report.victory, true);
});

test('evasion zeroes incoming damage while active', () => {
  const report = resolveBattle(
    attackerSide([footmen(20)], { triggers: withTriggers({ battle_start: [trigger('battle_start', { evasion: true, duration: 2 })] }) }),
    defenderSide([stack({ id: 'm', hp: 1e6, attack: 100, defense: 0 })]),
    { seed: 1 },
  );
  const rounds = report.waves[0].rounds;
  assert.equal(rounds[0].attacker[0].hpPool, 2400);
  assert.equal(rounds[1].attacker[0].hpPool, 2400);
  assert.ok(rounds[2].attacker[0].hpPool < 2400);
});

test('an over-100% defenseBonus never heals the attacker', () => {
  const report = resolveBattle(
    attackerSide([footmen(20)], { triggers: withTriggers({ wave_start: [trigger('wave_start', { defenseBonus: 3 })] }) }),
    defenderSide([stack({ id: 'm', hp: 1e6, attack: 100, defense: 0 })]),
    { seed: 1 },
  );
  for (const round of report.waves[0].rounds) assert.equal(round.attacker[0].hpPool, 2400);
});

test('battle_start duration counts rounds of the first wave only', () => {
  const report = resolveBattle(
    attackerSide([footmen(50)], { triggers: withTriggers({ battle_start: [trigger('battle_start', { evasion: true, duration: 3 })] }) }),
    defenderSide([footmen(1, { id: 'd1' })], [stack({ id: 'm', hp: 1e6, attack: 200, defense: 0 })]),
    { seed: 1 },
  );
  assert.equal(report.waves[0].rounds.length, 1);
  assert.equal(report.waves[0].rounds[0].attacker[0].hpPool, 6000);
  assert.ok(report.waves[1].rounds[0].attacker[0].hpPool < 6000);
});

test('final_wave effects are active every round of the last non-empty wave only', () => {
  const report = resolveBattle(
    attackerSide([footmen(50)], { triggers: withTriggers({ final_wave: [trigger('final_wave', { evasion: true })] }) }),
    defenderSide([footmen(1, { id: 'd1' })], [stack({ id: 'm', hp: 3000, attack: 200, defense: 0 })], []),
    { seed: 1 },
  );
  assert.ok(report.waves[0].rounds[0].attacker[0].hpPool < 6000);
  assert.ok(report.waves[1].rounds.length > 1);
  for (const round of report.waves[1].rounds) assert.equal(round.attacker[0].hpPool, report.waves[0].rounds.at(-1).attacker[0].hpPool);
});

test('wave_start effects are active every round of every wave', () => {
  const report = resolveBattle(
    attackerSide([footmen(50)], { triggers: withTriggers({ wave_start: [trigger('wave_start', { evasion: true })] }) }),
    defenderSide([stack({ id: 'a', hp: 3000, attack: 200, defense: 0 })], [stack({ id: 'b', hp: 3000, attack: 200, defense: 0 })]),
    { seed: 1 },
  );
  assert.ok(report.waves[0].rounds.length > 1);
  assert.ok(report.waves[1].rounds.length > 1);
  for (const wave of report.waves) for (const round of wave.rounds) assert.equal(round.attacker[0].hpPool, 6000);
});

test('firstWaveBonus applies only in round 1 of the first non-empty wave', () => {
  const defender = () => defenderSide([], [stack({ id: 'm', tier: 6, hp: 1e6, attack: 0, defense: 100 })]);
  const poolsOf = (extra) => resolveBattle(attackerSide([footmen(10, { attack: 20 })], extra), defender(), { seed: 4 }).waves[1].rounds.map((r) => r.defender[0].hpPool);
  const plain = poolsOf({});
  const boosted = poolsOf({ firstWaveBonus: 0.5 });
  assert.ok(boosted[0] < plain[0]);
  const drop = (pools, i) => pools[i - 1] - pools[i];
  assert.ok(drop(boosted, 1) > 0);
  assert.equal(drop(boosted, 1), drop(plain, 1));
  assert.equal(drop(boosted, 2), drop(plain, 2));
});

test('losing-trigger lossReduction counts once per battle', () => {
  const report = resolveBattle(
    attackerSide([footmen(10)], { triggers: withTriggers({ losing: [trigger('losing', { lossReduction: 0.2 })] }) }),
    defenderSide([stack({ id: 'm', hp: 1e6, attack: 200, defense: 0 })]),
    { seed: 1 },
  );
  assert.equal(report.victory, false);
  assert.equal(report.fallen.infantry_t1, 10);
  const share = COMBAT_RULES.WOUNDED_SHARE.defeat + 0.2 * (1 - COMBAT_RULES.WOUNDED_SHARE.defeat);
  assert.equal(report.wounded.infantry_t1, Math.floor(10 * share));
  assert.equal(report.dead.infantry_t1, 10 - Math.floor(10 * share));
});

test('attacker with no stacks loses immediately', () => {
  const report = resolveBattle(attackerSide([]), defenderSide([footmen(1, { id: 'd' })]), { seed: 1 });
  assert.equal(report.victory, false);
  assert.equal(report.roundsTotal, 0);
});

test('attacker with strikers but no stacks loses', () => {
  const report = resolveBattle(
    attackerSide([], { strikers: [{ heroId: 'h1', slotIndex: 0, attack: 500, level: 10 }] }),
    defenderSide([footmen(1, { id: 'd' })]),
    { seed: 1 },
  );
  assert.equal(report.victory, false);
  assert.equal(report.roundsTotal, 0);
});

test('an empty defender wave is skipped', () => {
  const report = resolveBattle(attackerSide([footmen(50)]), defenderSide([], [footmen(1, { id: 'd' })]), { seed: 1 });
  assert.equal(report.victory, true);
  assert.equal(report.waves[0].rounds.length, 0);
  assert.ok(report.waves[1].rounds.length > 0);
});

test('a mutual wipe on the final wave is a defeat', () => {
  const report = resolveBattle(
    attackerSide([footmen(10)], { healEntries: [{ stat: 'postBattleHeal', category: 'hero', value: 0.3, sourceId: 'medic' }] }),
    defenderSide([stack({ id: 'glass', hp: 1, attack: 2000, defense: 0 })]),
    { seed: 1 },
  );
  const lastRound = report.waves[0].rounds.at(-1);
  assert.equal(report.roundsTotal, 1);
  assert.equal(lastRound.attacker[0].count, 0);
  assert.equal(lastRound.defender[0].count, 0);
  assert.equal(report.victory, false);
  assert.deepEqual(report.healed, {});
  assert.equal(report.wounded.infantry_t1, Math.floor(10 * COMBAT_RULES.WOUNDED_SHARE.defeat));
  assert.equal(report.dead.infantry_t1, 10 - Math.floor(10 * COMBAT_RULES.WOUNDED_SHARE.defeat));
});

test('attack bonuses scale atk inside hitDamage', () => {
  const firstRoundPool = (attack, extra) => resolveBattle(
    attackerSide([footmen(10, { attack })], extra),
    defenderSide([stack({ id: 'm', tier: 6, hp: 1e6, attack: 0, defense: 100 })]),
    { seed: 4 },
  ).waves[0].rounds[0].defender[0].hpPool;
  const premultiplied = firstRoundPool(30);
  assert.equal(firstRoundPool(20, { firstWaveBonus: 0.5 }), premultiplied);
  assert.equal(firstRoundPool(20, { triggers: withTriggers({ battle_start: [trigger('battle_start', { attackBonus: 0.5, duration: 1 })] }) }), premultiplied);
});
