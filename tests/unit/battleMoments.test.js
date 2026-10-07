import test from 'node:test';
import assert from 'node:assert/strict';

import { battleMoments, turningPoint } from '../../js/systems/combat/report/battleMoments.js';
import { battleTimeline } from '../../js/systems/combat/report/battleTimeline.js';

const unit = (over) => ({ tier: 1, type: 'infantry', row: 'front', hp: 100, ...over, startCount: over.count, hpPool: over.count * (over.hp ?? 100) });

const INF = unit({ id: 'inf', label: 'Footman', count: 10 });
const RNG = unit({ id: 'rng', label: 'Archer', type: 'ranged', row: 'back', count: 5, hp: 50 });
const GRUNT = unit({ id: '0:0', name: 'Grunt', count: 4, hp: 200 });
const BRUTE = unit({ id: '1:0', name: 'Brute', count: 2, hp: 500 });

const snap = (id, count, hpPool) => ({ id, count, hpPool });
const hit = (targetId, damage, kills = 0) => ({ targetId, damage, kills });
const strike = (side, fromId, hits, row = 'front') => ({ kind: 'strike', side, fromId, row, counterMult: 1, hits });
const round = (n, attacker, defender, events = []) => ({ round: n, attacker, defender, heroHits: [], events });

const FULL = [snap('inf', 10, 1000), snap('rng', 5, 250)];

const reportOf = (waves, { victory = false, attacker = [INF, RNG], defender = [[GRUNT]] } = {}) => ({
  rulesVersion: 1,
  seed: 1,
  victory,
  roundsTotal: waves.reduce((sum, wave) => sum + wave.rounds.length, 0),
  waves,
  initial: { attacker, defender },
  dead: {},
  wounded: {},
  fallen: {},
});

const build = (report, options = {}) => ({ report, timeline: battleTimeline(report, { heroesBySlot: {}, ...options }) });
const momentsOf = (report, options) => {
  const { timeline } = build(report, options);
  return battleMoments(report, timeline);
};
const ofKind = (moments, kind) => moments.filter((moment) => moment.kind === kind);

test('rowBroken when a row goes from alive to empty', () => {
  const report = reportOf([{
    name: 'W1',
    rounds: [
      round(1, FULL, [snap('0:0', 0, 0)]),
      round(2, [snap('inf', 0, 0), snap('rng', 5, 250)], [snap('0:0', 0, 0)]),
    ],
  }]);
  const moments = ofKind(momentsOf(report), 'rowBroken');
  assert.deepEqual(moments.map(({ frameIndex, text, icon }) => ({ frameIndex, text, icon })), [
    { frameIndex: 1, text: 'Enemy front line broken', icon: '⚠' },
    { frameIndex: 2, text: 'Your front line broken', icon: '⚠' },
  ]);
});

test('a wave change does not count as a row breaking', () => {
  const report = reportOf([
    { name: 'W1', rounds: [round(1, FULL, [snap('0:0', 4, 800)])] },
    { name: 'W2', rounds: [round(1, FULL, [snap('1:0', 2, 1000)])] },
  ], { defender: [[GRUNT], [BRUTE]] });
  assert.equal(ofKind(momentsOf(report), 'rowBroken').length, 0);
});

test('bossWave at the boss wave first frame', () => {
  const report = reportOf([
    { name: 'W1', rounds: [round(1, FULL, [snap('0:0', 4, 800)])] },
    { name: 'Warlord Pen', rounds: [round(1, FULL, [snap('1:0', 2, 1000)])] },
  ], { defender: [[GRUNT], [BRUTE]] });
  const moments = ofKind(momentsOf(report, { bossWaveIndex: 1 }), 'bossWave');
  assert.deepEqual(moments, [{ frameIndex: 2, kind: 'bossWave', text: 'Boss wave: Warlord Pen', icon: '☠' }]);
});

test('heroKill only for hero strikes with kills', () => {
  const report = reportOf([{
    name: 'W1',
    rounds: [
      round(1, FULL, [snap('0:0', 4, 800)], [{ kind: 'heroStrike', heroId: 'warlord', hits: [hit('0:0', 50, 0)] }]),
      round(2, FULL, [snap('0:0', 3, 600)], [{ kind: 'heroStrike', heroId: 'warlord', hits: [hit('0:0', 200, 1)] }]),
      round(3, FULL, [snap('0:0', 1, 200)], [{ kind: 'heroStrike', heroId: 'ghost', hits: [hit('0:0', 400, 2)] }]),
    ],
  }]);
  assert.deepEqual(ofKind(momentsOf(report), 'heroKill'), [
    { frameIndex: 2, kind: 'heroKill', text: 'Marcus Kestrel slays 1', icon: '⚔️' },
    { frameIndex: 3, kind: 'heroKill', text: 'ghost slays 2', icon: '⚔' },
  ]);
});

test('skill at its event frame', () => {
  const report = reportOf([{
    name: 'W1',
    rounds: [
      round(1, FULL, [snap('0:0', 4, 800)]),
      round(2, FULL, [snap('0:0', 4, 800)], [{ kind: 'skill', heroId: 'warlord', skillId: 'charge', trigger: 'battle_start' }]),
    ],
  }]);
  assert.deepEqual(ofKind(momentsOf(report), 'skill'), [{ frameIndex: 2, kind: 'skill', text: 'Marcus Kestrel: Charge', icon: '✦' }]);
});

test('revive names the stack that rises', () => {
  const report = reportOf([{
    name: 'W1',
    rounds: [round(1, FULL, [snap('0:0', 3, 600)], [{ kind: 'revive', stackId: '0:0', count: 1 }])],
  }]);
  assert.deepEqual(ofKind(momentsOf(report), 'revive'), [{ frameIndex: 1, kind: 'revive', text: 'Grunt rise again', icon: '↺' }]);
});

test('moments sort by frame then kind order', () => {
  const report = reportOf([{
    name: 'W1',
    rounds: [round(1, FULL, [snap('0:0', 0, 0)], [
      { kind: 'revive', stackId: 'inf', count: 1 },
      { kind: 'heroStrike', heroId: 'warlord', hits: [hit('0:0', 800, 4)] },
      { kind: 'skill', heroId: 'warlord', skillId: 'charge', trigger: 'battle_start' },
    ])],
  }]);
  assert.deepEqual(momentsOf(report).map((moment) => moment.kind), ['skill', 'heroKill', 'rowBroken', 'revive']);
});

const lineReport = ({ victory, series, lostPerRound = [] }) => reportOf([{
  name: 'W1',
  rounds: series.map(([attacker, defender], index) => round(
    index + 1,
    [snap('inf', Math.ceil(attacker / 100), attacker)],
    [snap('0:0', Math.ceil(defender / 100), defender)],
    lostPerRound[index] ? [strike('defender', '0:0', [hit('inf', 0, lostPerRound[index])])] : [],
  )),
}], { victory, attacker: [INF], defender: [[{ ...GRUNT, count: 10, startCount: 10, hp: 100 }]] });

const turning = (report) => {
  const { timeline } = build(report);
  return turningPoint(report, timeline);
};

test('turningPoint defeat: frame after which the lead never returns positive', () => {
  const report = lineReport({ victory: false, series: [[800, 900], [900, 500], [300, 400], [0, 300]] });
  assert.equal(turning(report), 3);
});

test('turningPoint victory: frame after which the lead never returns negative', () => {
  const report = lineReport({ victory: true, series: [[900, 800], [600, 700], [600, 300], [500, 0]] });
  assert.equal(turning(report), 3);
});

test('turningPoint with no flip falls back to the biggest attacker loss', () => {
  const report = lineReport({ victory: false, series: [[900, 950], [400, 900], [0, 800]], lostPerRound: [1, 5, 4] });
  assert.equal(turning(report), 2);
});

test('turningPoint fallback ties go to the earliest frame', () => {
  const report = lineReport({ victory: false, series: [[900, 950], [800, 900], [0, 800]], lostPerRound: [2, 2, 2] });
  assert.equal(turning(report), 1);
});

test('turningPoint is 0 for a report with no rounds', () => {
  assert.equal(turning(reportOf([{ name: 'W1', rounds: [] }])), 0);
});
