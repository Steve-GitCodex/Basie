import test from 'node:test';
import assert from 'node:assert/strict';

import { defeatAnalysis } from '../../js/systems/combat/report/defeatAnalysis.js';
import { COMBAT_RULES } from '../../js/entities/data/combatRules.js';

const mine = (over) => ({ id: 'inf', label: 'Footman', type: 'infantry', tier: 1, row: 'front', startCount: 10, hp: 100, attack: 100, defense: 10, ...over });
const foe = (over) => ({ id: '0:0', label: 'Ironbacks', type: 'infantry', tier: 1, row: 'front', startCount: 5, hp: 200, attack: 50, defense: 10, ...over });

const hit = (targetId, damage, kills = 0) => ({ targetId, damage, kills });
const strike = (side, fromId, hits, counterMult = 1) => ({ kind: 'strike', side, fromId, row: 'front', counterMult, hits });
const snap = (id, count) => ({ id, count, hpPool: count * 100 });
const round = (n, events = [], attacker = [snap('inf', 10)]) => ({ round: n, attacker, defender: [snap('0:0', 5)], heroHits: [], events });

const reportOf = (rounds, { attacker = [mine({})], defender = [[foe({})]], victory = false } = {}) => ({
  victory,
  roundsTotal: rounds.length,
  waves: [{ name: 'W1', rounds }],
  initial: { attacker, defender },
  dead: {},
  wounded: {},
  fallen: {},
});

const causesOf = (report, emptySlots = 0) => defeatAnalysis({ report, emptySlots }).map((entry) => entry.cause);
const only = (report, cause, emptySlots = 0) => defeatAnalysis({ report, emptySlots }).find((entry) => entry.cause === cause);

test('armor: absorbed share >= 50% with real numbers', () => {
  const report = reportOf([round(1, [strike('attacker', 'inf', [hit('0:0', 10)])])], { defender: [[foe({ defense: 300 })]] });
  const entry = only(report, 'armor');
  assert.equal(entry.fix, 'train');
  assert.equal(entry.text, 'Ironbacks have defense 300. Your Footman hit for 100: about 75% of each hit is absorbed.');
  assert.equal(entry.score, 0.75);
});

test('armor does not trigger under 50% absorbed', () => {
  const report = reportOf([round(1, [strike('attacker', 'inf', [hit('0:0', 10)])])], { defender: [[foe({ defense: 50 })]] });
  assert.equal(only(report, 'armor'), undefined);
});

test('armor picks the highest-damage stack and the highest-defense front enemy', () => {
  const attacker = [mine({}), mine({ id: 'rng', label: 'Archer', attack: 40, row: 'back' })];
  const defender = [[foe({ id: 'a', label: 'Scouts', defense: 500, row: 'back' }), foe({ id: 'b', label: 'Shields', defense: 120 }), foe({ id: 'c', label: 'Pawns', defense: 20 })]];
  const report = reportOf([round(1, [strike('attacker', 'inf', [hit('b', 10)]), strike('attacker', 'rng', [hit('b', 90)])])], { attacker, defender });
  assert.match(only(report, 'armor').text, /^Shields have defense 120\. Your Archer hit for 40: about 75% /);
});

test('heal: enemy healing >= your damage over the last 5 fought rounds', () => {
  const rounds = [1, 2, 3].map((n) => round(n, [strike('attacker', 'inf', [hit('0:0', 100)]), { kind: 'heal', stackId: '0:0', amount: 150 }]));
  const entry = only(reportOf(rounds), 'heal');
  assert.equal(entry.fix, 'mix');
  assert.equal(entry.text, 'Ironbacks healed 450 HP over the last 3 rounds — more than the 300 damage you dealt.');
  assert.equal(entry.score, 1);
});

test('heal counts hero strikes and only the last 5 rounds', () => {
  const early = round(1, [strike('attacker', 'inf', [hit('0:0', 9999)])]);
  const late = [2, 3, 4, 5, 6].map((n) => round(n, [{ kind: 'heal', stackId: '0:0', amount: 100 }, { kind: 'heroStrike', heroId: 'h', hits: [hit('0:0', 40)] }]));
  const entry = only(reportOf([early, ...late]), 'heal');
  assert.match(entry.text, /healed 500 HP over the last 5 rounds — more than the 200 damage/);
  assert.equal(entry.score, 1);
});

test('heal does not trigger when damage exceeds healing', () => {
  const rounds = [round(1, [strike('attacker', 'inf', [hit('0:0', 100)]), { kind: 'heal', stackId: '0:0', amount: 50 }])];
  assert.equal(only(reportOf(rounds), 'heal'), undefined);
});

test('frontBroke: front row emptied before round 4 of the final wave', () => {
  const attacker = [mine({}), mine({ id: 'rng', label: 'Archer', row: 'back' })];
  const rounds = [
    round(1, [], [snap('inf', 4), snap('rng', 5)]),
    round(2, [], [snap('inf', 0), snap('rng', 5)]),
    round(3, [], [snap('inf', 0), snap('rng', 5)]),
  ];
  const entry = only(reportOf(rounds, { attacker }), 'frontBroke');
  assert.equal(entry.fix, 'rows');
  assert.equal(entry.text, 'Your front line broke in round 2 of the final wave — the rows behind it took the rest.');
  assert.equal(entry.score, 0.5);
});

test('frontBroke ignores a break at round 4+ and fronts that never existed', () => {
  const late = reportOf([round(1), round(2), round(3), round(4, [], [snap('inf', 0)])]);
  assert.equal(only(late, 'frontBroke'), undefined);
  const noFront = reportOf([round(1, [], [snap('rng', 0)])], { attacker: [mine({ id: 'rng', row: 'back' })] });
  assert.equal(only(noFront, 'frontBroke'), undefined);
});

test('heroes: empty commander slots', () => {
  const report = reportOf([round(1)]);
  assert.equal(only(report, 'heroes', 1).text, '1 commander slot empty — each hero adds a strike every round.');
  assert.equal(only(report, 'heroes', 1).score, 0.5);
  assert.equal(only(report, 'heroes', 2).text, '2 commander slots empty — each hero adds a strike every round.');
  assert.equal(only(report, 'heroes', 3).score, 1);
  assert.equal(only(report, 'heroes', 0), undefined);
  assert.equal(only(report, 'heroes', 1).fix, 'heroes');
});

test('roundCap: final fought wave reached ROUND_CAP', () => {
  const rounds = Array.from({ length: COMBAT_RULES.ROUND_CAP }, (_, i) => round(i + 1));
  const entry = only(reportOf(rounds), 'roundCap');
  assert.equal(entry.fix, 'train');
  assert.equal(entry.score, 1);
  assert.equal(entry.text, 'Round limit reached in wave 1 — your damage was too low to finish.');
  assert.equal(only(reportOf(rounds.slice(1)), 'roundCap'), undefined);
});

test('counter: enemy advantage on >= 60% of its strike damage', () => {
  const rounds = [round(1, [strike('defender', '0:0', [hit('inf', 70)], 1.5), strike('defender', '0:0', [hit('inf', 30)], 1)])];
  const entry = only(reportOf(rounds), 'counter');
  assert.equal(entry.fix, 'mix');
  assert.equal(entry.score, 0.7);
  assert.equal(entry.text, 'The enemy had the counter advantage on 70% of its damage.');
  const low = [round(1, [strike('defender', '0:0', [hit('inf', 50)], 1.5), strike('defender', '0:0', [hit('inf', 50)], 1)])];
  assert.equal(only(reportOf(low), 'counter'), undefined);
});

test('returns at most 2, highest score first, ties by cause order', () => {
  const rounds = Array.from({ length: COMBAT_RULES.ROUND_CAP }, (_, i) => round(i + 1, [strike('defender', '0:0', [hit('inf', 10)], 2)]));
  const report = reportOf(rounds);
  assert.deepEqual(causesOf(report, 2), ['heroes', 'roundCap']);
  const results = defeatAnalysis({ report, emptySlots: 1 });
  assert.equal(results.length, 2);
  assert.ok(results[0].score >= results[1].score);
  assert.deepEqual(causesOf(reportOf([round(1, [strike('defender', '0:0', [hit('inf', 10)], 2)])]), 1), ['counter', 'heroes']);
});

test('victory report yields no causes', () => {
  assert.deepEqual(defeatAnalysis({ report: reportOf([round(1)], { victory: true }), emptySlots: 3 }), []);
});

test('a defeat with no fought rounds still reports empty slots only', () => {
  const report = { victory: false, roundsTotal: 0, waves: [{ name: 'W1', rounds: [] }], initial: { attacker: [mine({})], defender: [[foe({})]] } };
  assert.deepEqual(causesOf(report, 1), ['heroes']);
});
