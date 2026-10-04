import { CAMPAIGNS_CONFIG, MONSTERS_CONFIG } from '../../entities/data/combat.js';
import { CAMPAIGN_CHAPTER_KNOBS, CAMPAIGN_CHAPTER_OVERRIDES } from '../../entities/data/campaign.js';
import { buildCampaignStages } from './stageGenerator.js';

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

export const CAMPAIGN_STAGES = deepFreeze(
  buildCampaignStages(CAMPAIGNS_CONFIG, MONSTERS_CONFIG, CAMPAIGN_CHAPTER_KNOBS, CAMPAIGN_CHAPTER_OVERRIDES)
);

const BY_ID = new Map(CAMPAIGN_STAGES.map(stage => [stage.id, stage]));

export function stageById(id) {
  return BY_ID.get(id);
}

export function trailStages() {
  return CAMPAIGN_STAGES.filter(stage => stage.kind !== 'elite');
}

export function eliteFor(chapter) {
  return CAMPAIGN_STAGES.find(stage => stage.kind === 'elite' && stage.chapter === chapter);
}
