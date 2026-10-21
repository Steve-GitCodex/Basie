import { fmt } from '../uiUtils.js';
import { prodFactor } from '../../systems/building/buildingCurve.js';

const RESOURCE_KEYS = ['wood', 'stone', 'iron', 'food', 'water', 'money'];

const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

function productionParts(cfg, level) {
  return RESOURCE_KEYS
    .filter(res => typeof cfg.effects?.[res] === 'number')
    .map(res => ({ res, text: `+${(cfg.effects[res] * prodFactor(level)).toFixed(1)}/s` }));
}

function storageParts(cfg, level) {
  return RESOURCE_KEYS
    .filter(res => Array.isArray(cfg.storageCap?.[res]) && cfg.storageCap[res][level] != null)
    .map(res => ({ res, text: fmt(cfg.storageCap[res][level]) }));
}

function cafeteriaParts(cfg, level) {
  const food = cfg.foodCapacityPerLevel;
  const water = cfg.waterCapacityPerLevel;
  if (!Array.isArray(food)) return [];
  return [{ res: 'food', text: fmt(food[level]) }, { res: 'water', text: fmt(water?.[level] ?? food[level]) }];
}

function trainingParts(cfg, level) {
  const row = cfg.trainingSlots?.[level - 1];
  if (!row) return [];
  const speedUp = Math.round((1 - row.trainTimeMultiplier) * 100);
  const time = speedUp > 0 ? ` · -${speedUp}% time` : '';
  return [{ text: `${plural(row.concurrentSlots, 'slot')} · T${row.maxTrainableTier} · batch ${fmt(row.maxBatchSize)}${time}` }];
}

function levelStatParts(cfg, level) {
  const row = cfg.levelStats?.[level - 1];
  if (!row) return [];
  if (row.slotCapacity != null) return [{ text: `${fmt(row.slotCapacity)} units per squad slot` }];
  if (row.marchSlots != null) return [{ text: `${plural(row.marchSlots, 'march', 'marches')} · +${Math.round(row.speedBonus * 100)}% speed` }];
  return [];
}

function populationParts(cfg, level) {
  if (cfg.populationCapacityPerLevel == null) return [];
  return [{ text: `+${fmt(cfg.populationCapacityPerLevel * level)} population` }];
}

function heroSlotParts(cfg, level) {
  const perLevel = cfg.effects?.heroSlots;
  return perLevel ? [{ text: plural(perLevel * level, 'hero slot') }] : [];
}

export function levelEffectParts(cfg, level) {
  return [
    ...productionParts(cfg, level),
    ...storageParts(cfg, level),
    ...cafeteriaParts(cfg, level),
    ...trainingParts(cfg, level),
    ...levelStatParts(cfg, level),
    ...populationParts(cfg, level),
    ...heroSlotParts(cfg, level),
  ];
}

export function hasLevelEffects(cfg) {
  return levelEffectParts(cfg, 1).length > 0;
}
