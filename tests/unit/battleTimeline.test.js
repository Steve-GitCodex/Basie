import test from 'node:test';
import assert from 'node:assert/strict';

import { battleTimeline } from '../../js/systems/combat/report/battleTimeline.js';
import { resolveBattle } from '../../js/systems/combat/resolveBattle.js';

const unit = (over) => ({ tier: 1, type: 'infantry', row: 'front', ...over, startCount: over.count, hpPool: over.count * over.hp });

const INF = unit({ id: 'inf', tierKey: 'inf', label: 'Footman', count: 10, hp: 100 });
const RNG = unit({ id: 'rng', tierKey: 'rng', label: 'Archer', type: 'ranged', row: 'back', count: 5, hp: 50 });
const GRUNT = unit({ id: '0:0', name: 'Grunt', tier: 2, count: 4, hp: 200, ability: { kind: 'heal', value: 0.2 } });
const BRUTE = unit({ id: '2:0', name: 'Brute', tier: 3, count: 2, hp: 500 });

const snap = (id, count, hpPool) => ({ id, count, hpPool });
const hit = (targetId, damage, kills = 0) => ({ targetId, damage, kills });
const strike = (side, fromId, counterMult, hits) => ({ kind: 'strike', side, fromId, row: 'front', counterMult, hits });
const skill = (heroId, skillId, trigger) => ({ kind: 'skill', heroId, skillId, trigger });

const R1 = {
  round: 1,
  attacker: [snap('inf', 9, 900), snap('rng', 5, 250)],
  defender: [snap('0:0', 3, 600)],
  heroHits: [],
  events: [
    skill('h1', 'sk_rally', 'battle_start'),
    strike('attacker', 'inf', 1.5, [hit('0:0', 100)]),
    strike('attacker', 'rng', 1, [hit('0:0', 50)]),
    { kind: 'heroStrike', heroId: 'h1', hits: [hit('0:0', 50, 1)] },
    strike('defender', '0:0', 1, [hit('inf', 100, 1)]),
  ],
};

const R2 = {
  round: 2,
  attacker: [snap('inf', 9, 900), snap('rng', 5, 250)],
  defender: [snap('0:0', 0, 0)],
  heroHits: [],
  events: [
    { kind: 'heal', stackId: '0:0', amount: 200 },
    strike('attacker', 'inf', 1.5, [hit('0:0', 400, 2)]),
    strike('attacker', 'rng', 1.5, [hit('0:0', 400, 2)]),
    strike('defender', '0:0', 1, [hit('inf', 0)]),
  ],
};

const R3 = {
  round: 1,
  attacker: [snap('inf', 6, 600), snap('rng', 5, 250)],
  defender: [snap('2:0', 1, 500)],
  heroHits: [],
  events: [
    skill('h1', 'sk_rally', 'wave_start'),
    skill('h2', 'sk_last', 'final_wave'),
    strike('attacker', 'inf', 1, [hit('2:0', 500, 1)]),
    strike('defender', '2:0', 2, [hit('inf', 300, 3)]),
  ],
};

const buildReport = () => ({
  rulesVersion: 1,
  seed: 1,
  victory: false,
  roundsTotal: 3,
  waves: [{ name: 'W1', rounds: [R1, R2] }, { name: 'W2', rounds: [] }, { name: 'Boss', rounds: [R3] }],
  initial: { attacker: [INF, RNG], defender: [[GRUNT], [], [BRUTE]] },
  dead: {},
  wounded: {},
  fallen: {},
});

const HEROES = { inf: 'h1', rng: 'h2' };
const timeline = () => battleTimeline(buildReport(), { heroesBySlot: HEROES, bossWaveIndex: 2 });
const stackIn = (side, id) => Object.values(side.rows).flat().find((s) => s.id === id);

test('frame 0 shows full strength', () => {
  const [frame] = timeline().frames;
  assert.equal(frame.index, 0);
  assert.equal(frame.waveIndex, 0);
  assert.equal(frame.round, 0);
  assert.equal(frame.sides.attacker.strengthPct, 100);
  assert.equal(frame.sides.defender.strengthPct, 100);
  assert.deepEqual(frame.sides.attacker.rows.front.map((s) => [s.id, s.count, s.hpPct]), [['inf', 10, 100]]);
  assert.deepEqual(frame.sides.attacker.rows.back.map((s) => s.id), ['rng']);
  assert.deepEqual(frame.sides.attacker.rows.mid, []);
  assert.deepEqual(frame.sides.defender.rows.front.map((s) => [s.id, s.label, s.count]), [['0:0', 'Grunt', 4]]);
  assert.deepEqual(frame.arrows, []);
  assert.deepEqual(frame.floats, []);
  assert.deepEqual(frame.heroKills, { h1: 0, h2: 0 });
  assert.deepEqual(frame.skills, { h1: { sk_rally: 'ready' }, h2: { sk_last: 'ready' } });
});

test('frame 0 starts on the first fought wave', () => {
  const report = buildReport();
  report.waves = [{ name: 'Empty', rounds: [] }, { name: 'W1', rounds: [R1] }];
  report.initial.defender = [[], [GRUNT]];
  const { frames } = battleTimeline(report);
  assert.equal(frames[0].waveIndex, 1);
  assert.deepEqual(frames[0].sides.defender.rows.front.map((s) => s.id), ['0:0']);
});

test('frames count = 1 + total rounds', () => {
  assert.equal(timeline().frames.length, 4);
  assert.deepEqual(timeline().frames.map((f) => [f.index, f.waveIndex, f.round]), [[0, 0, 0], [1, 0, 1], [2, 0, 2], [3, 2, 1]]);
});

test('each frame\'s counts equal that round\'s snapshots', () => {
  const { frames } = timeline();
  const third = frames[3];
  assert.equal(stackIn(third.sides.attacker, 'inf').count, 6);
  assert.equal(stackIn(third.sides.attacker, 'inf').hpPct, 60);
  assert.equal(stackIn(third.sides.attacker, 'inf').startCount, 10);
  assert.deepEqual(third.sides.defender.rows.front.map((s) => [s.id, s.label, s.count, s.hpPct]), [['2:0', 'Brute', 1, 50]]);
  assert.deepEqual(frames.map((f) => f.sides.attacker.strengthPct), [100, 92, 92, 68]);
  assert.deepEqual(frames.map((f) => f.sides.defender.strengthPct), [100, 75, 0, 50]);
});

test('counts match resolveBattle snapshots on a real report', () => {
  const report = resolveBattle(
    { stacks: [unit({ id: 'foot', label: 'Footman', count: 30, hp: 120, attack: 14, defense: 10 })] },
    { waves: [{ name: 'A', stacks: [unit({ id: 'm', name: 'Brute', count: 2, hp: 300, attack: 120, defense: 0 })] }, { name: 'B', stacks: [] }] },
    { seed: 1 },
  );
  const { frames } = battleTimeline(report);
  assert.equal(frames.length, 1 + report.roundsTotal);
  report.waves[0].rounds.forEach((round, i) => {
    assert.equal(stackIn(frames[i + 1].sides.attacker, 'foot').count, round.attacker[0].count);
    assert.equal(stackIn(frames[i + 1].sides.defender, 'm').count, round.defender[0].count);
  });
});

test('delta.lost/healed per stack match the events', () => {
  const { frames } = timeline();
  const delta = (frame, side, id) => stackIn(frames[frame].sides[side], id).delta;
  assert.deepEqual(delta(0, 'attacker', 'inf'), { lost: 0, healed: 0 });
  assert.deepEqual(delta(1, 'attacker', 'inf'), { lost: 1, healed: 0 });
  assert.deepEqual(delta(1, 'attacker', 'rng'), { lost: 0, healed: 0 });
  assert.deepEqual(delta(1, 'defender', '0:0'), { lost: 1, healed: 0 });
  assert.deepEqual(delta(2, 'defender', '0:0'), { lost: 4, healed: 1 });
  assert.deepEqual(delta(3, 'attacker', 'inf'), { lost: 3, healed: 0 });
  assert.deepEqual(delta(3, 'defender', '2:0'), { lost: 1, healed: 0 });
});

test('revive counts as healed with a heal float', () => {
  const report = buildReport();
  report.waves[0].rounds = [{ ...R1, events: [{ kind: 'revive', stackId: '0:0', count: 2 }] }];
  const [, frame] = battleTimeline(report).frames;
  assert.deepEqual(stackIn(frame.sides.defender, '0:0').delta, { lost: 0, healed: 2 });
  assert.deepEqual(frame.floats, [{ stackId: '0:0', kind: 'heal', value: 2 }]);
});

test('floats: dmg/kill per hit target, heal per heal event', () => {
  const { frames } = timeline();
  assert.deepEqual(frames[1].floats, [
    { stackId: '0:0', kind: 'dmg', value: 100 },
    { stackId: '0:0', kind: 'dmg', value: 50 },
    { stackId: '0:0', kind: 'dmg', value: 50 },
    { stackId: '0:0', kind: 'kill', value: 1 },
    { stackId: 'inf', kind: 'dmg', value: 100 },
    { stackId: 'inf', kind: 'kill', value: 1 },
  ]);
  assert.deepEqual(frames[2].floats, [
    { stackId: '0:0', kind: 'heal', value: 1 },
    { stackId: '0:0', kind: 'dmg', value: 400 },
    { stackId: '0:0', kind: 'kill', value: 2 },
    { stackId: '0:0', kind: 'dmg', value: 400 },
    { stackId: '0:0', kind: 'kill', value: 2 },
  ], 'a zero-damage hit yields no float');
});

test('arrows: one per strike event, weight = share of side damage', () => {
  const { frames } = timeline();
  assert.deepEqual(frames[1].arrows, [
    { side: 'attacker', fromId: 'inf', toRow: 'front', weight: 2 / 3 },
    { side: 'attacker', fromId: 'rng', toRow: 'front', weight: 1 / 3 },
    { side: 'defender', fromId: '0:0', toRow: 'front', weight: 1 },
  ]);
  assert.equal(frames[2].arrows.find((a) => a.side === 'defender').weight, 0);
});

test('counter: max counterMult above 1 per striking stack, else null', () => {
  const { frames } = timeline();
  assert.equal(stackIn(frames[1].sides.attacker, 'inf').counter, 1.5);
  assert.equal(stackIn(frames[1].sides.attacker, 'rng').counter, null);
  assert.equal(stackIn(frames[2].sides.attacker, 'rng').counter, 1.5);
  assert.equal(stackIn(frames[3].sides.defender, '2:0').counter, 2);
  assert.equal(stackIn(frames[3].sides.attacker, 'inf').counter, null);
});

test('heroKills cumulative from heroStrike and led-stack strike events', () => {
  assert.deepEqual(timeline().frames.map((f) => f.heroKills), [{ h1: 0, h2: 0 }, { h1: 1, h2: 0 }, { h1: 3, h2: 2 }, { h1: 4, h2: 2 }]);
});

test('skills: ready → firing on the skill event frame → used after', () => {
  assert.deepEqual(timeline().frames.map((f) => f.skills), [
    { h1: { sk_rally: 'ready' }, h2: { sk_last: 'ready' } },
    { h1: { sk_rally: 'firing' }, h2: { sk_last: 'ready' } },
    { h1: { sk_rally: 'used' }, h2: { sk_last: 'ready' } },
    { h1: { sk_rally: 'firing' }, h2: { sk_last: 'firing' } },
  ]);
});

test('ledBy from heroesBySlot', () => {
  const [frame] = timeline().frames;
  assert.equal(stackIn(frame.sides.attacker, 'inf').ledBy, 'h1');
  assert.equal(stackIn(frame.sides.attacker, 'rng').ledBy, 'h2');
  assert.equal(stackIn(frame.sides.defender, '0:0').ledBy, null);
  assert.equal(stackIn(battleTimeline(buildReport()).frames[0].sides.attacker, 'inf').ledBy, null);
});

test('stack entries carry the spec fields', () => {
  const entry = stackIn(timeline().frames[0].sides.attacker, 'rng');
  assert.deepEqual(entry, {
    id: 'rng', label: 'Archer', tier: 1, type: 'ranged', count: 5, startCount: 5, hpPct: 100,
    delta: { lost: 0, healed: 0 }, ledBy: 'h2', counter: null,
  });
});

test('zero-round wave yields no frames but keeps its wave entry', () => {
  const { waves, frames } = timeline();
  assert.deepEqual(waves, [
    { index: 0, name: 'W1', firstFrame: 1, isBoss: false },
    { index: 1, name: 'W2', firstFrame: 3, isBoss: false },
    { index: 2, name: 'Boss', firstFrame: 3, isBoss: true },
  ]);
  assert.ok(frames.every((f) => f.waveIndex !== 1));
});

test('waves[].firstFrame points at the wave\'s first frame; a trailing zero-round wave points at the last frame', () => {
  const report = buildReport();
  report.waves = [{ name: 'W1', rounds: [R1, R2] }, { name: 'Tail', rounds: [] }];
  report.initial.defender = [[GRUNT], []];
  const { waves, frames } = battleTimeline(report);
  assert.equal(frames[waves[0].firstFrame].waveIndex, 0);
  assert.equal(frames[waves[0].firstFrame].round, 1);
  assert.equal(waves[1].firstFrame, frames.length - 1);
  assert.equal(waves[1].isBoss, false);
});

test('report is not mutated', () => {
  const report = buildReport();
  const before = structuredClone(report);
  battleTimeline(report, { heroesBySlot: HEROES });
  assert.deepEqual(report, before);
});

test('heroKills include kills of the stack the hero leads', () => {
  const final = timeline().frames.at(-1).heroKills;
  assert.deepEqual(final, { h1: 4, h2: 2 });
});

test('a small heal still counts as one healed and shows a heal float', () => {
  const report = buildReport();
  report.waves[0].rounds[1] = { ...R2, events: [{ kind: 'heal', stackId: '0:0', amount: 50 }] };
  const frame = battleTimeline(report, { heroesBySlot: HEROES }).frames[2];
  assert.equal(stackIn(frame.sides.defender, '0:0').delta.healed, 1);
  assert.ok(frame.floats.some((f) => f.kind === 'heal' && f.value > 0));
});
