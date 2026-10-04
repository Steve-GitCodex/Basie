import test from 'node:test';
import assert from 'node:assert/strict';

import { CAMPAIGNS_CONFIG } from '../../js/entities/data/combat.js';
import { CAMPAIGN_STAGES, stageById, trailStages, eliteFor } from '../../js/systems/campaign/campaignStages.js';

test('stageById resolves boss and generated ids', () => {
  assert.equal(stageById('goblin_camp').kind, 'boss');
  assert.equal(stageById('ch2_s3').kind, 'regular');
  assert.equal(stageById('ch1_elite').kind, 'elite');
  assert.equal(stageById('nope'), undefined);
});

test('trailStages excludes elites and is in chapter order', () => {
  const trail = trailStages();
  assert.equal(trail.length, 50);
  assert.ok(trail.every(s => s.kind !== 'elite'));
  const chapters = trail.map(s => s.chapter);
  assert.deepEqual(chapters, [...chapters].sort((a, b) => a - b));
});

test('eliteFor returns the chapter elite', () => {
  assert.equal(eliteFor(4).id, 'ch4_elite');
  assert.equal(eliteFor(99), undefined);
});

test('CAMPAIGN_STAGES is deep-frozen', () => {
  assert.ok(Object.isFrozen(CAMPAIGN_STAGES));
  const boss = stageById('goblin_camp');
  assert.ok(Object.isFrozen(boss));
  assert.ok(Object.isFrozen(boss.monster.waves[0].stacks[0]));
  assert.throws(() => { boss.monster.waves[0].stacks[0].count = 99; }, TypeError);
});

test('deep-freezing stages never touches live config objects', () => {
  const orc = stageById('orc_warband');
  assert.notEqual(orc.requires, CAMPAIGNS_CONFIG[2].requires);
  assert.deepEqual(orc.requires, CAMPAIGNS_CONFIG[2].requires);
  assert.equal(Object.isFrozen(CAMPAIGNS_CONFIG[2].requires), false);
  assert.notEqual(orc.rewards, orc.monster.rewards);
  assert.deepEqual(orc.rewards, orc.monster.rewards);
});
