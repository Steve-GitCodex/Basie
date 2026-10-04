import test from 'node:test';
import assert from 'node:assert/strict';

import { BUILDINGS_CONFIG } from '../../js/entities/GAME_DATA.js';
import { CAMPAIGN_STAGES } from '../../js/systems/campaign/campaignStages.js';
import { stageStates, currentStageId } from '../../js/systems/campaign/campaignProgress.js';

const maxLevel = () => 99;
const noBuildings = () => 0;
const clear = ids => Object.fromEntries(ids.map(id => [id, 1]));
const chapterIds = ch => CAMPAIGN_STAGES.filter(s => s.chapter === ch && s.kind !== 'elite').map(s => s.id);

test('fresh save: only ch1_s1 is available', () => {
  const states = stageStates(CAMPAIGN_STAGES, { bestStars: {} }, maxLevel);
  const available = CAMPAIGN_STAGES.filter(s => states.get(s.id).isAvailable).map(s => s.id);
  assert.deepEqual(available, ['ch1_s1']);
});

test('stages unlock in trail order within a chapter', () => {
  const states = stageStates(CAMPAIGN_STAGES, { bestStars: clear(['ch1_s1', 'ch1_s2']) }, maxLevel);
  assert.equal(states.get('ch1_s1').isCompleted, true);
  assert.equal(states.get('ch1_s3').isAvailable, true);
  assert.equal(states.get('ch1_s4').isLocked, true);
  assert.equal(states.get('ch1_s4').lockReason, `Clear ${CAMPAIGN_STAGES.find(s => s.id === 'ch1_s3').name} first`);
});

test("chapter 2 needs chapter 1's boss and its requires", () => {
  const withoutBoss = stageStates(CAMPAIGN_STAGES, { bestStars: {} }, maxLevel);
  assert.equal(withoutBoss.get('ch2_s1').lockReason, 'Defeat Scav Warband first');

  const ch1 = chapterIds(1);
  const ch2 = chapterIds(2);
  const bossBeaten = { bestStars: clear([...ch1, ...ch2]) };
  const lowHall = stageStates(CAMPAIGN_STAGES, bossBeaten, noBuildings);
  assert.equal(lowHall.get('ch3_s1').isLocked, true);
  assert.equal(lowHall.get('ch3_s1').lockReason, `Requires: ${BUILDINGS_CONFIG.townhall.name} Lv.3`);

  const highHall = stageStates(CAMPAIGN_STAGES, bossBeaten, maxLevel);
  assert.equal(highHall.get('ch3_s1').isAvailable, true);
});

test('elite unlocks after its boss and never gates the next chapter', () => {
  const ch1 = chapterIds(1);
  const lockedElite = stageStates(CAMPAIGN_STAGES, { bestStars: clear(ch1.slice(0, -1)) }, maxLevel);
  assert.equal(lockedElite.get('ch1_elite').isLocked, true);
  assert.equal(lockedElite.get('ch1_elite').lockReason, 'Defeat Scav Warband first');

  const bossDown = stageStates(CAMPAIGN_STAGES, { bestStars: clear(ch1) }, maxLevel);
  assert.equal(bossDown.get('ch1_elite').isAvailable, true);
  assert.equal(bossDown.get('ch2_s1').isAvailable, true);
});

test('currentStageId is the first available non-elite stage', () => {
  const states = stageStates(CAMPAIGN_STAGES, { bestStars: clear(['ch1_s1']) }, maxLevel);
  assert.equal(currentStageId(CAMPAIGN_STAGES, states), 'ch1_s2');
});

test('currentStageId with everything cleared is the last boss', () => {
  const all = clear(CAMPAIGN_STAGES.map(s => s.id));
  const states = stageStates(CAMPAIGN_STAGES, { bestStars: all }, maxLevel);
  assert.equal(currentStageId(CAMPAIGN_STAGES, states), 'chaos_titan');
});

test('currentStageId falls back to the last cleared boss when the next chapter is building-gated', () => {
  const cleared = clear([...chapterIds(1), ...chapterIds(2)]);
  const states = stageStates(CAMPAIGN_STAGES, { bestStars: cleared }, noBuildings);
  assert.equal(states.get('ch3_s1').isLocked, true);
  assert.equal(currentStageId(CAMPAIGN_STAGES, states), 'bandit_camp');
});

test('currentStageId with everything cleared is still the last boss after the fallback change', () => {
  const states = stageStates(CAMPAIGN_STAGES, { bestStars: clear(CAMPAIGN_STAGES.map(s => s.id)) }, noBuildings);
  assert.equal(currentStageId(CAMPAIGN_STAGES, states), 'chaos_titan');
});
