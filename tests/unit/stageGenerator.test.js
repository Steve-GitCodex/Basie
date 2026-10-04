import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCampaignStages, lineupPower } from '../../js/systems/campaign/stageGenerator.js';
import { CAMPAIGNS_CONFIG, MONSTERS_CONFIG } from '../../js/entities/data/combat.js';
import { CAMPAIGN_CHAPTER_KNOBS } from '../../js/entities/data/campaign.js';

const build = (knobs = CAMPAIGN_CHAPTER_KNOBS, overrides = {}) =>
  buildCampaignStages(CAMPAIGNS_CONFIG, MONSTERS_CONFIG, knobs, overrides);
const byId = (stages, id) => stages.find(s => s.id === id);

test('builds 10 chapters x (4 regular + boss + elite) = 60 stages with spec ids', () => {
  const stages = build();
  assert.equal(stages.length, 60);
  const ch1 = stages.slice(0, 6).map(s => s.id);
  assert.deepEqual(ch1, ['ch1_s1', 'ch1_s2', 'ch1_s3', 'ch1_s4', 'goblin_camp', 'ch1_elite']);
  assert.equal(stages[6].id, 'ch2_s1');
  assert.equal(stages[6].chapter, 2);
  assert.equal(stages[10].id, 'bandit_camp');
  assert.equal(new Set(stages.map(s => s.id)).size, 60);
});

test('every boss stage is its unchanged monster, as a copy', () => {
  for (const stage of build().filter(s => s.kind === 'boss')) {
    assert.deepEqual(stage.monster, MONSTERS_CONFIG[stage.id]);
    assert.notEqual(stage.monster, MONSTERS_CONFIG[stage.id]);
    assert.notEqual(stage.monster.waves, MONSTERS_CONFIG[stage.id].waves);
  }
});

test('is deterministic', () => {
  assert.deepEqual(build(), build());
});

test('regular stage power is non-decreasing and below the boss', () => {
  const stages = build();
  for (const chapter of new Set(stages.map(s => s.chapter))) {
    const inChapter = stages.filter(s => s.chapter === chapter);
    const boss = inChapter.find(s => s.kind === 'boss');
    const powers = inChapter.filter(s => s.kind === 'regular').map(s => lineupPower(s.monster.waves));
    for (let i = 1; i < powers.length; i++) assert.ok(powers[i] >= powers[i - 1], `ch${chapter} s${i + 1}`);
    assert.ok(powers.at(-1) < lineupPower(boss.monster.waves), `ch${chapter} below boss`);
  }
});

test('chapter 1 regular stages scale from the from-fraction', () => {
  const stages = build();
  const bossPower = lineupPower(byId(stages, 'goblin_camp').monster.waves);
  const first = lineupPower(byId(stages, 'ch1_s1').monster.waves) / bossPower;
  const last = lineupPower(byId(stages, 'ch1_s4').monster.waves) / bossPower;
  assert.ok(Math.abs(first - 0.45) <= 0.45 * 0.25, `s1 ${first}`);
  assert.ok(Math.abs(last - 0.85) <= 0.85 * 0.25, `s4 ${last}`);
});

test('single-wave boss keeps its wave for regular stages', () => {
  const stages = build();
  const boss = MONSTERS_CONFIG.bandit_camp;
  assert.equal(boss.waves.length, 1);
  for (const stage of stages.filter(s => s.chapter === 2 && s.kind === 'regular')) {
    assert.equal(stage.monster.waves.length, 1);
    stage.monster.waves[0].stacks.forEach((s, i) => {
      assert.equal(s.name, boss.waves[0].stacks[i].name);
      assert.ok(s.count <= boss.waves[0].stacks[i].count);
    });
  }
});

test('multi-wave boss drops its last wave for regular stages', () => {
  const stage = byId(build(), 'ch1_s2');
  assert.equal(stage.monster.waves.length, MONSTERS_CONFIG.goblin_camp.waves.length - 1);
  assert.equal(stage.monster.id, 'ch1_s2');
  assert.equal(stage.monster.name, 'Scav Runners II');
});

test('elite tier bump clamps at the top tier', () => {
  const monsters = {
    top: {
      id: 'top', name: 'Top', icon: 'x', description: 'd', difficulty: 1, campaignStage: 1,
      waves: [{ name: 'W', stacks: [
        { name: 'A', tier: 10, type: 'infantry', row: 'front', hp: 100, attack: 10, count: 2 },
        { name: 'B', tier: 4, type: 'ranged', row: 'back', hp: 100, attack: 10, count: 3 },
      ] }],
      rewards: { money: 100 }, maxRewardedWins: 1,
    },
  };
  const stages = buildCampaignStages([{ stage: 1, monsterId: 'top', requires: null }], monsters, CAMPAIGN_CHAPTER_KNOBS, {});
  const elite = byId(stages, 'ch1_elite');
  assert.equal(elite.monster.waves[0].stacks[0].tier, 10);
  assert.equal(elite.monster.waves[0].stacks[1].tier, 5);
  assert.equal(elite.monster.waves[0].stacks[0].count, 3);
  assert.equal(elite.monster.waves[0].stacks[1].count, 5);
  assert.deepEqual(elite.rewards, { money: 150 });
});

test('throws on a tier outside 1-10', () => {
  const monsters = {
    bad: {
      id: 'bad', name: 'Bad', icon: 'x', description: 'd',
      waves: [{ name: 'W', stacks: [{ name: 'A', tier: 11, type: 'infantry', row: 'front', hp: 1, attack: 1, count: 1 }] }],
      rewards: { money: 1 }, maxRewardedWins: 1,
    },
  };
  assert.throws(
    () => buildCampaignStages([{ stage: 1, monsterId: 'bad', requires: null }], monsters, CAMPAIGN_CHAPTER_KNOBS, {}),
    /tier/
  );
});

test('first-clear diamonds follow the knob curve', () => {
  const stages = build();
  assert.equal(byId(stages, 'ch1_s1').firstClear.diamond, 5);
  assert.equal(byId(stages, 'goblin_camp').firstClear.diamond, 20);
  assert.equal(byId(stages, 'ch1_elite').firstClear.diamond, 15);
  assert.equal(byId(stages, 'ch2_s1').firstClear.diamond, 6);
});

test('round par by kind', () => {
  const stages = build();
  assert.equal(byId(stages, 'ch1_s1').roundPar, 8);
  assert.equal(byId(stages, 'goblin_camp').roundPar, 12);
  assert.equal(byId(stages, 'ch1_elite').roundPar, 12);
});

test('stage carries the chapter requires and 1-based chapter', () => {
  const stages = build();
  assert.equal(byId(stages, 'ch1_s1').requires, null);
  assert.deepEqual(byId(stages, 'ch3_s1').requires, { townhall: 3 });
  assert.equal(byId(stages, 'ch3_s1').chapter, 3);
  assert.equal(byId(stages, 'ch3_s2').index, 2);
});

test('knobs.elite=false via overrides drops that chapter elite', () => {
  const stages = build(CAMPAIGN_CHAPTER_KNOBS, { 1: { elite: false } });
  assert.equal(stages.length, 59);
  assert.equal(byId(stages, 'ch1_elite'), undefined);
  assert.ok(byId(stages, 'ch2_elite'));
});

test('regularCount override changes the count and supports roman numerals to 8', () => {
  const stages = build(CAMPAIGN_CHAPTER_KNOBS, { 1: { regularCount: 8 } });
  const regs = stages.filter(s => s.chapter === 1 && s.kind === 'regular');
  assert.equal(regs.length, 8);
  assert.equal(regs[7].monster.name, 'Scav Runners VIII');
});
