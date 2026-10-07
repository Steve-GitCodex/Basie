import test from 'node:test';
import assert from 'node:assert/strict';

import { eventBus } from '../../js/core/EventBus.js';
import { CampaignManager } from '../../js/systems/CampaignManager.js';
import { CAMPAIGN_STAGES } from '../../js/systems/campaign/campaignStages.js';

const STAGE = CAMPAIGN_STAGES[0];

function setup() {
  const campaign = new CampaignManager({ getLevelOf: () => 99 }, { now: () => 1234 });
  const seen = [];
  const offs = ['campaign:firstClear', 'campaign:updated'].map(type => eventBus.on(type, d => seen.push({ type, d })));
  return { campaign, seen, stop: () => { offs.forEach(off => off()); campaign.destroy(); } };
}

const win = (stageId, dead = {}, rounds = 1) =>
  eventBus.emit('combat:victory', { monsterId: 'x', stageId, rewards: {}, dead, wounded: {}, rounds, sent: 100, enemyLeftPct: 0, wavesReached: 1, bossLeftPct: 0 });

test('victory records stars and keeps the best', () => {
  const { campaign, stop } = setup();
  win(STAGE.id);
  assert.equal(campaign.getProgress(STAGE.id).bestStars, 3);
  win(STAGE.id, { a: 30 });
  assert.equal(campaign.getProgress(STAGE.id).bestStars, 3);
  stop();
});

test('first win emits campaign:firstClear once with the stage diamonds', () => {
  const { campaign, seen, stop } = setup();
  win(STAGE.id);
  win(STAGE.id);
  const clears = seen.filter(e => e.type === 'campaign:firstClear');
  assert.equal(clears.length, 1);
  assert.deepEqual(clears[0].d, { stageId: STAGE.id, rewards: { diamond: STAGE.firstClear.diamond } });
  assert.equal(campaign.getProgress(STAGE.id).firstCleared, true);
  stop();
});

test('first victory emits campaign:updated once, after firstClear', () => {
  const { seen, stop } = setup();
  win(STAGE.id);
  assert.deepEqual(seen.map(e => e.type), ['campaign:firstClear', 'campaign:updated']);
  stop();
});

test('defeat stores lastReport but no stars', () => {
  const { campaign, stop } = setup();
  eventBus.emit('combat:defeat', { monsterId: 'x', stageId: STAGE.id, dead: { a: 2, b: 3 }, wounded: { a: 1 }, rounds: 5, sent: 50, enemyLeftPct: 40, wavesReached: 2, bossLeftPct: 30 });
  const p = campaign.getProgress(STAGE.id);
  assert.equal(p.bestStars, 0);
  assert.equal(p.firstCleared, false);
  assert.deepEqual(p.lastReport, { victory: false, rounds: 5, sent: 50, dead: 5, wounded: 1, enemyLeftPct: 40, wavesReached: 2, bossLeftPct: 30, at: 1234 });
  stop();
});

test('survival victory leaves campaign state unchanged', () => {
  const { campaign, seen, stop } = setup();
  win(undefined);
  assert.deepEqual(campaign.serialize(), { bestStars: {}, firstCleared: {}, lastReport: {} });
  assert.equal(seen.length, 0);
  stop();
});

test('serialize round-trips', () => {
  const { campaign, stop } = setup();
  win(STAGE.id);
  const data = campaign.serialize();
  const other = new CampaignManager(null);
  other.deserialize(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(other.serialize(), data);
  other.destroy();
  stop();
});

test('deserialize drops unknown stage ids and clamps stars to 0-3', () => {
  const campaign = new CampaignManager(null);
  campaign.deserialize({
    bestStars: { [STAGE.id]: 9, ghost: 2, [CAMPAIGN_STAGES[1].id]: -4 },
    firstCleared: { [STAGE.id]: true, ghost: true },
    lastReport: { ghost: { victory: true } }
  });
  const out = campaign.serialize();
  assert.deepEqual(out.bestStars, { [STAGE.id]: 3 });
  assert.deepEqual(out.firstCleared, { [STAGE.id]: true });
  assert.deepEqual(out.lastReport, {});
  campaign.destroy();
});

test('deserialize(null/undefined) seeds empty state', () => {
  const campaign = new CampaignManager(null);
  campaign.deserialize(null);
  assert.deepEqual(campaign.serialize(), { bestStars: {}, firstCleared: {}, lastReport: {} });
  campaign.deserialize(undefined);
  assert.deepEqual(campaign.serialize(), { bestStars: {}, firstCleared: {}, lastReport: {} });
  campaign.destroy();
});

test('stage states and current stage follow progress', () => {
  const { campaign, stop } = setup();
  assert.equal(campaign.getCurrentStageId(), STAGE.id);
  win(STAGE.id);
  assert.equal(campaign.getStageStates().get(STAGE.id).isCompleted, true);
  assert.equal(campaign.getCurrentStageId(), CAMPAIGN_STAGES[1].id);
  assert.equal(campaign.getStages(), CAMPAIGN_STAGES);
  stop();
});

test('destroy unsubscribes from combat events', () => {
  const campaign = new CampaignManager(null);
  campaign.destroy();
  win(STAGE.id);
  assert.equal(campaign.getProgress(STAGE.id).bestStars, 0);
});

test('lastReport stores wavesReached and bossLeftPct', () => {
  const { campaign, stop } = setup();
  eventBus.emit('combat:defeat', {
    monsterId: 'x', stageId: STAGE.id, dead: {}, wounded: {}, rounds: 3, sent: 100, enemyLeftPct: 40,
    wavesReached: 2, bossLeftPct: 35,
  });
  const report = campaign.getProgress(STAGE.id).lastReport;
  assert.equal(report.wavesReached, 2);
  assert.equal(report.bossLeftPct, 35);
  stop();
});

test('deserialize keeps wavesReached and bossLeftPct', () => {
  const { campaign, stop } = setup();
  eventBus.emit('combat:defeat', {
    monsterId: 'x', stageId: STAGE.id, dead: {}, wounded: {}, rounds: 3, sent: 100, enemyLeftPct: 40,
    wavesReached: 2, bossLeftPct: 35,
  });
  const data = JSON.parse(JSON.stringify(campaign.serialize()));
  campaign.deserialize(data);
  const report = campaign.getProgress(STAGE.id).lastReport;
  assert.equal(report.wavesReached, 2);
  assert.equal(report.bossLeftPct, 35);
  stop();
});
