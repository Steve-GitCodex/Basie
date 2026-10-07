import test from 'node:test';
import assert from 'node:assert/strict';

import { battleSummary } from '../../js/systems/combat/report/battleSummary.js';
import { battleTimeline } from '../../js/systems/combat/report/battleTimeline.js';
import { resolveBattle } from '../../js/systems/combat/resolveBattle.js';
import { starsFor } from '../../js/systems/campaign/starRules.js';

const stack = (id, label, row, startCount) => ({ id, label, row, startCount });
const hit = (targetId, damage, kills) => ({ targetId, damage, kills });
const strike = (fromId, hits) => ({ kind: 'strike', side: 'attacker', fromId, hits });
const enemyStrike = (fromId, hits) => ({ kind: 'strike', side: 'defender', fromId, hits });
const heroStrike = (heroId, hits) => ({ kind: 'heroStrike', heroId, hits });
const skill = (heroId, skillId) => ({ kind: 'skill', heroId, skillId, trigger: 'roundStart' });
const round = (n, events = []) => ({ round: n, attacker: [], defender: [], heroHits: [], events });

const makeReport = (over = {}) => ({
  victory: true,
  roundsTotal: 3,
  waves: [
    { name: 'W1', rounds: [round(1, [skill('h1', 'charge'), strike('inf', [hit('0:0', 10, 4)]), enemyStrike('0:0', [hit('inf', 5, 9)])]), round(2, [heroStrike('h1', [hit('0:0', 10, 3)])])] },
    { name: 'W2', rounds: [round(1, [skill('h2', 'lastStand'), strike('rng', [hit('1:0', 10, 5)]), heroStrike('h2', [hit('1:0', 1, 1)])])] },
  ],
  initial: { attacker: [stack('inf', 'Footman', 'front', 100), stack('rng', 'Archer', 'back', 50)], defender: [[]] },
  dead: { inf: 10, rng: 0 },
  wounded: { inf: 5, rng: 5 },
  ...over,
});

const heroes = [
  { heroId: 'h1', slotIndex: 0, stackId: 'inf' },
  { heroId: 'h2', slotIndex: 1, stackId: 'rng' },
];

test('layers add up (sent = back + wounded + dead)', () => {
  const { layers, stacks } = battleSummary({ report: makeReport() });
  assert.deepEqual(layers, { sent: 150, back: 130, wounded: 10, dead: 10 });
  assert.equal(layers.sent, layers.back + layers.wounded + layers.dead);
  assert.deepEqual(stacks[0], { id: 'inf', label: 'Footman', row: 'front', sent: 100, dead: 10, wounded: 5, back: 85, kills: 4 });
});

test('per-stack kills from strike events', () => {
  const { stacks } = battleSummary({ report: makeReport() });
  assert.deepEqual(stacks.map((s) => s.kills), [4, 5]);
});

test('hero kills = own strikes + led stack kills', () => {
  const result = battleSummary({ report: makeReport(), squadHeroes: heroes });
  assert.deepEqual(result.heroes.map((h) => h.kills), [7, 6]);
});

test('mvp is the top killer, ties → lowest slot', () => {
  const top = battleSummary({ report: makeReport(), squadHeroes: heroes });
  assert.deepEqual(top.heroes.map((h) => h.mvp), [true, false]);
  const tied = makeReport({ waves: [{ name: 'W', rounds: [round(1, [heroStrike('h1', [hit('x', 1, 2)]), heroStrike('h2', [hit('x', 1, 2)])])] }] });
  const result = battleSummary({ report: tied, squadHeroes: [heroes[1], heroes[0]] });
  assert.deepEqual(result.heroes.map((h) => [h.heroId, h.mvp]), [['h2', false], ['h1', true]]);
});

test('no kills → no mvp', () => {
  const quiet = makeReport({ waves: [{ name: 'W', rounds: [round(1)] }] });
  assert.ok(battleSummary({ report: quiet, squadHeroes: heroes }).heroes.every((h) => !h.mvp));
});

test('skillsFired with absolute rounds from skill events', () => {
  const result = battleSummary({ report: makeReport(), squadHeroes: heroes });
  assert.deepEqual(result.heroes[0].skillsFired, [{ skillId: 'charge', round: 1 }]);
  assert.deepEqual(result.heroes[1].skillsFired, [{ skillId: 'lastStand', round: 3 }]);
});

test('xp attaches per hero or null', () => {
  const xp = { heroId: 'h1', xpGained: 40, levelBefore: 1, levelAfter: 2, xpPct: 10, unlockedSkills: [] };
  const result = battleSummary({ report: makeReport(), squadHeroes: heroes, heroXp: [xp] });
  assert.deepEqual([result.heroes[0].xp, result.heroes[1].xp], [xp, null]);
});

test('star rules list pass/fail with actual numbers', () => {
  const stage = { id: 's', kind: 'regular', roundPar: 5 };
  const result = battleSummary({ report: makeReport(), stage });
  assert.deepEqual(result.starRules.map((r) => r.text), ['Won', 'Under 25% lost (13%)', 'Won within 5 rounds (took 3)']);
  assert.deepEqual(result.starRules.map((r) => r.pass), [true, true, true]);
  assert.equal(result.stars, 3);
});

test('stars match starsFor across outcomes', () => {
  const stage = { id: 's', kind: 'regular', roundPar: 2 };
  const cases = [
    makeReport(),
    makeReport({ victory: false }),
    makeReport({ dead: { inf: 60, rng: 0 } }),
  ];
  for (const report of cases) {
    const dead = Object.values(report.dead).reduce((a, b) => a + b, 0);
    const wounded = Object.values(report.wounded).reduce((a, b) => a + b, 0);
    const expected = starsFor({ victory: report.victory, sent: 150, dead, wounded, rounds: report.roundsTotal, roundPar: 2 });
    const result = battleSummary({ report, stage });
    assert.equal(result.stars, expected);
    assert.equal(result.starRules.filter((r) => r.pass).length >= expected, true);
  }
});

test('defeat fails every star rule', () => {
  const result = battleSummary({ report: makeReport({ victory: false }), stage: { id: 's', kind: 'boss', roundPar: 9 } });
  assert.deepEqual(result.starRules.map((r) => r.pass), [false, false, false]);
  assert.equal(result.stars, 0);
});

test('survival summary has no stars', () => {
  const result = battleSummary({ report: makeReport(), stage: null });
  assert.equal(result.stars, null);
  assert.deepEqual(result.starRules, []);
});

test('no squad heroes → heroes [] and emptySlots passthrough', () => {
  const result = battleSummary({ report: makeReport(), emptySlots: 2 });
  assert.deepEqual(result.heroes, []);
  assert.equal(result.emptySlots, 2);
});

test('merged-slot stack kills are credited to its heroesBySlot hero only', () => {
  const merged = [
    { heroId: 'h1', slotIndex: 0, stackId: 'inf' },
    { heroId: 'h2', slotIndex: 1, stackId: 'inf' },
  ];
  const result = battleSummary({ report: makeReport(), squadHeroes: merged, heroesBySlot: { inf: 'h1' } });
  assert.deepEqual(result.heroes.map((h) => h.kills), [7, 1]);
  assert.deepEqual(battleSummary({ report: makeReport(), squadHeroes: merged }).heroes.map((h) => h.kills), [7, 1]);
});

const fullStack = (over) => {
  const base = { id: 's', label: 's', type: 'infantry', tier: 1, row: 'front', count: 1, hp: 100, attack: 10, defense: 10, ...over };
  return { startCount: base.count, hpPool: base.count * base.hp, ...base };
};

test('final frame heroKills match battleSummary hero kills on a multi-wave fight with heals and revives', () => {
  const front = fullStack({ id: 'front', tier: 1, hp: 120, attack: 14, defense: 10, count: 40, tierKey: 'infantry_t1' });
  const back = fullStack({ id: 'back', type: 'ranged', row: 'back', hp: 120, attack: 18, defense: 10, count: 2, tierKey: 'ranged_t1' });
  const attacker = {
    stacks: [front, back],
    strikers: [{ heroId: 'h1', slotIndex: 0, attack: 5, level: 1 }],
    triggers: { battle_start: [], wave_start: [], final_wave: [], losing: [] },
    lossEntries: [],
    healEntries: [],
    firstWaveBonus: 0,
  };
  const defender = {
    waves: [
      { name: 'W1', stacks: [fullStack({ id: 'grunt', tier: 2, hp: 150, attack: 20, defense: 8, count: 12 }), fullStack({ id: 'howl', type: 'ranged', row: 'back', tier: 3, hp: 300, attack: 35, defense: 5, count: 3, ability: { kind: 'heal', value: 0.2 } })] },
      { name: 'W2', stacks: [fullStack({ id: 'rev', tier: 2, hp: 200, attack: 30, defense: 6, count: 6, ability: { kind: 'revive', value: 0.5 } })] },
    ],
  };
  const kindsOf = (report) => new Set(report.waves.flatMap((wave) => wave.rounds.flatMap((r) => r.events.map((e) => e.kind))));
  const report = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12345].map((seed) => resolveBattle(structuredClone(attacker), structuredClone(defender), { seed }))
    .find((candidate) => kindsOf(candidate).has('heal') && kindsOf(candidate).has('revive'));
  assert.ok(report, 'a seed exercising both heal and revive');
  const heroesBySlot = { front: 'h1', back: 'h2' };
  const squadHeroes = [{ heroId: 'h1', slotIndex: 0, stackId: 'front' }, { heroId: 'h2', slotIndex: 1, stackId: 'back' }];
  const { heroes } = battleSummary({ report, squadHeroes, heroesBySlot });
  const finalKills = battleTimeline(report, { heroesBySlot }).frames.at(-1).heroKills;
  assert.ok(heroes.some((h) => h.kills > 0));
  for (const hero of heroes) assert.equal(finalKills[hero.heroId], hero.kills, hero.heroId);
});
