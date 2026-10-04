import { eventBus } from '../core/EventBus.js';
import { starsFor } from './campaign/starRules.js';
import { stageStates, currentStageId } from './campaign/campaignProgress.js';
import { CAMPAIGN_STAGES, stageById } from './campaign/campaignStages.js';

const MAX_STARS = 3;

const total = counts => Object.values(counts ?? {}).reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
const clampStars = value => Math.min(MAX_STARS, Math.max(0, Math.floor(Number(value) || 0)));
const isObject = value => value !== null && typeof value === 'object';

export class CampaignManager {
  constructor(buildingManager, { now = Date.now } = {}) {
    this.name = 'campaign';
    this._getBuildingLevel = id => buildingManager?.getLevelOf(id) ?? 0;
    this._now = now;
    this._reset();
    this._unsubscribes = [
      eventBus.on('combat:victory', d => this._onResult(d, true)),
      eventBus.on('combat:defeat', d => this._onResult(d, false)),
    ];
  }

  destroy() {
    this._unsubscribes.forEach(off => off());
  }

  update() {}

  getStages() {
    return CAMPAIGN_STAGES;
  }

  getStageStates() {
    return stageStates(CAMPAIGN_STAGES, { bestStars: this._bestStars }, this._getBuildingLevel);
  }

  getCurrentStageId() {
    return currentStageId(CAMPAIGN_STAGES, this.getStageStates());
  }

  getProgress(stageId) {
    return {
      bestStars: this._bestStars[stageId] || 0,
      firstCleared: !!this._firstCleared[stageId],
      lastReport: this._lastReport[stageId] ? { ...this._lastReport[stageId] } : null,
    };
  }

  serialize() {
    return {
      bestStars: { ...this._bestStars },
      firstCleared: { ...this._firstCleared },
      lastReport: Object.fromEntries(Object.entries(this._lastReport).map(([id, r]) => [id, { ...r }])),
    };
  }

  deserialize(data) {
    this._reset();
    if (!isObject(data)) return;
    for (const stage of CAMPAIGN_STAGES) {
      const stars = clampStars(data.bestStars?.[stage.id]);
      if (stars > 0) this._bestStars[stage.id] = stars;
      if (data.firstCleared?.[stage.id] === true) this._firstCleared[stage.id] = true;
      const report = data.lastReport?.[stage.id];
      if (isObject(report)) this._lastReport[stage.id] = { ...report };
    }
  }

  _reset() {
    this._bestStars = {};
    this._firstCleared = {};
    this._lastReport = {};
  }

  _onResult(d, victory) {
    const stage = stageById(d?.stageId);
    if (!stage) return;
    const dead = total(d.dead);
    const wounded = total(d.wounded);
    this._lastReport[stage.id] = {
      victory, rounds: d.rounds, sent: d.sent, dead, wounded, enemyLeftPct: d.enemyLeftPct, at: this._now(),
    };
    if (victory) {
      const stars = starsFor({ victory, sent: d.sent, dead, wounded, rounds: d.rounds, roundPar: stage.roundPar });
      this._bestStars[stage.id] = Math.max(this._bestStars[stage.id] || 0, stars);
      this._grantFirstClear(stage);
    }
    eventBus.emit('campaign:updated');
  }

  _grantFirstClear(stage) {
    if (this._firstCleared[stage.id]) return;
    this._firstCleared[stage.id] = true;
    eventBus.emit('campaign:firstClear', { stageId: stage.id, rewards: { diamond: stage.firstClear.diamond } });
  }
}
