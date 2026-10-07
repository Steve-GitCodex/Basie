import test from 'node:test';
import assert from 'node:assert/strict';

import { resultsModel } from '../../js/ui/combat/scene/resultsModel.js';
import { COMBAT_RULES } from '../../js/entities/data/combatRules.js';
import { SURVIVAL_STAGE_ID } from '../../js/systems/campaign/campaignStages.js';

const foeSnap = (count) => [{ id: '1:0', count, hpPool: count * 10 }];
const round = (n, foeCount) => ({ round: n, attacker: [], defender: foeSnap(foeCount), heroHits: [], events: [] });

const reportOf = ({ victory = false, wave2Rounds = 3, foeLeft = 4 } = {}) => ({
  victory,
  roundsTotal: 2 + wave2Rounds,
  waves: [
    { name: 'Scav Runners', rounds: [round(1, 0), round(2, 0)] },
    { name: 'Scav Brawlers', rounds: Array.from({ length: wave2Rounds }, (_, i) => round(i + 1, foeLeft)) },
  ],
  initial: {
    attacker: [{ id: 'infantry_t1', label: 'Footmen', row: 'front', startCount: 60 }],
    defender: [[{ id: '0:0', hpPool: 50 }], [{ id: '1:0', hpPool: 100 }]],
  },
  dead: { infantry_t1: 30 },
  wounded: { infantry_t1: 6 },
});

const inputs = {
  heroesBySlot: { infantry_t1: 'warlord' },
  squadHeroes: [{ heroId: 'warlord', slotIndex: 0, stackId: 'infantry_t1' }],
  supportHeroes: [],
  emptySlots: [1],
};

const roster = [{ id: 'warlord', level: 9, tier: 'legendary', xp: 30, xpToNext: 120 }];

const build = (over = {}) => resultsModel({
  result: { report: reportOf(), rewards: null, reducedReward: false, heroXp: [] },
  stageId: 'goblin_camp',
  inputs,
  prior: { lastReport: null, firstCleared: false },
  roster,
  title: 'Scav Warband',
  ...over,
});

test('defeat reason: squad wiped out in the final fought wave', () => {
  const model = build();
  assert.equal(model.reason, 'Your squad was wiped out in wave 2');
  assert.deepEqual(model.current, { wavesReached: 2, bossLeftPct: 40, waveName: 'Scav Brawlers' });
  assert.equal(model.next, null);
});

test('defeat reason: round limit when the final wave hit ROUND_CAP', () => {
  const model = build({ result: { report: reportOf({ wave2Rounds: COMBAT_RULES.ROUND_CAP }), heroXp: [] } });
  assert.equal(model.reason, 'Round limit reached in wave 2');
});

test('defeat passes emptySlots to the analysis as a count and the summary as slots', () => {
  const model = build();
  assert.deepEqual(model.summary.emptySlots, [1]);
  assert.ok(model.analysis.some(entry => entry.cause === 'heroes'));
});

test('victory: first-clear diamonds only when not cleared before; Next is the following trail stage', () => {
  const result = { report: reportOf({ victory: true, foeLeft: 0 }), rewards: { money: 150 }, reducedReward: false, heroXp: [] };
  const first = build({ result });
  assert.equal(first.firstClearDiamonds, 20);
  assert.equal(first.reason, null);
  assert.deepEqual(first.next, { id: 'ch2_s1', name: 'Raider Ambush I' });
  assert.equal(first.summary.stars > 0, true);
  const again = build({ result, prior: { lastReport: null, firstCleared: true } });
  assert.equal(again.firstClearDiamonds, 0);
});

test('a defeat never grants the first-clear chip', () => {
  assert.equal(build().firstClearDiamonds, 0);
});

test('hero meta: xp bar starts at the pre-battle progress, or 0 after a level-up', () => {
  const heroXp = [{ heroId: 'warlord', xpGained: 50, levelBefore: 9, levelAfter: 9, xpPct: 67, unlockedSkills: [] }];
  const stay = build({ result: { report: reportOf({ victory: true, foeLeft: 0 }), heroXp } });
  assert.deepEqual(stay.heroMeta.warlord, { level: 9, tier: 'legendary', stackLabel: 'Footmen', xpFrom: 25 });
  const up = build({ result: { report: reportOf({ victory: true, foeLeft: 0 }), heroXp: [{ ...heroXp[0], levelAfter: 10, xpPct: 5 }] } });
  assert.equal(up.heroMeta.warlord.xpFrom, 0);
  assert.equal(up.heroMeta.warlord.level, 10);
});

test('survival: no stage, no previous, no Next, no first clear', () => {
  const model = build({
    stageId: SURVIVAL_STAGE_ID,
    title: 'Survival Wave 3',
    prior: { lastReport: { wavesReached: 1, bossLeftPct: 50 }, firstCleared: false },
    result: { report: reportOf({ victory: true, foeLeft: 0 }), heroXp: [] },
  });
  assert.equal(model.isSurvival, true);
  assert.equal(model.summary.stars, null);
  assert.equal(model.previous, null);
  assert.equal(model.next, null);
  assert.equal(model.firstClearDiamonds, 0);
  assert.equal(model.title, 'Survival Wave 3');
});

test('previous attempt comes from the pre-attack progress', () => {
  const lastReport = { victory: false, wavesReached: 1, bossLeftPct: 70 };
  assert.deepEqual(build({ prior: { lastReport, firstCleared: false } }).previous, lastReport);
});

const strike = (fromId, damage) => ({ kind: 'strike', side: 'attacker', fromId, row: 'front', counterMult: 1, hits: [{ targetId: '1:0', damage, kills: 0 }] });
const frameOf = (index, you, foe, waveIndex = 0, n = index) => ({ index, waveIndex, round: n, sides: { attacker: { strengthPct: you }, defender: { strengthPct: foe } } });

test('train fix targets the trainer of the stack that dealt the most damage', () => {
  const report = reportOf();
  report.initial.attacker = [
    { id: 'infantry_t1', type: 'infantry', label: 'Footmen', row: 'front', startCount: 60 },
    { id: 'ranged_t1', type: 'ranged', label: 'Archers', row: 'back', startCount: 20 },
  ];
  report.waves[1].rounds[0].events = [strike('infantry_t1', 5), strike('ranged_t1', 30)];
  assert.equal(build({ result: { report, heroXp: [] } }).trainBuildingId, 'archeryrange');
  report.waves[1].rounds[0].events = [strike('infantry_t1', 50), strike('ranged_t1', 30)];
  assert.equal(build({ result: { report, heroXp: [] } }).trainBuildingId, 'infantryhall');
});

test('train fix falls back to the first stack when nothing struck', () => {
  const report = reportOf();
  report.initial.attacker = [{ id: 'cavalry_t2', type: 'cavalry', label: 'Riders', row: 'mid', startCount: 10 }];
  assert.equal(build({ result: { report, heroXp: [] } }).trainBuildingId, 'cavalrystable');
});

test('a defeat that never led replays the whole fight', () => {
  const timeline = { frames: [frameOf(0, 100, 100), frameOf(1, 80, 90), frameOf(2, 50, 60), frameOf(3, 0, 40)], waves: [] };
  assert.deepEqual(build({ timeline }).turningPoint, { frame: 0, neverLed: true });
});

test('a defeat that led names the turning-point wave and round', () => {
  const timeline = { frames: [frameOf(0, 100, 100), frameOf(1, 90, 70), frameOf(2, 60, 70, 1, 1), frameOf(3, 0, 40, 1, 2)], waves: [] };
  assert.deepEqual(build({ timeline }).turningPoint, { frame: 2, neverLed: false, wave: 2, round: 1 });
});

test('healedTotal sums the report healed map', () => {
  const report = { ...reportOf({ victory: true }), healed: { infantry_t1: 3, ranged_t1: 4 } };
  assert.equal(build({ result: { report, rewards: null, reducedReward: false, heroXp: [] } }).healedTotal, 7);
  assert.equal(build().healedTotal, 0);
});
