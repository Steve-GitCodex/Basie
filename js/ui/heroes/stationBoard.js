import { BUILDINGS_CONFIG, PROD_BONUS_CONFIG } from '../../entities/GAME_DATA.js';
import { skillBonusFor } from '../../systems/hero/heroProductionBonus.js';

const RESOURCE_EFFECTS = new Set(['money', 'food', 'wood', 'stone', 'iron']);

const RESOURCE_EFFECT_LABELS = {
  money: 'gold', food: 'food', wood: 'wood', stone: 'stone', iron: 'iron',
  trainingSpeed: 'training speed', researchSpeed: 'research speed',
  baseDefense: 'base defense', buildSpeed: 'build speed',
  storageCap: 'storage capacity', constructionCost: 'construction cost',
};

const NO_BONUS_LABEL = 'No station bonus yet';

function percent(fraction) {
  return Math.round(fraction * 100);
}

function skillPaidLabel(buildingType, entry, label, occupant) {
  if (!occupant) return `${label[0].toUpperCase()}${label.slice(1)} from hero skills`;
  const hero = {
    heroId: occupant.id, level: occupant.level, stars: occupant.stars,
    assignment: occupant.assignment, skillLevels: occupant.skillLevels,
  };
  return `+${percent(skillBonusFor(hero, buildingType, entry.effect))}% ${label}`;
}

function effectLabelFor(buildingType, occupant) {
  const entry = PROD_BONUS_CONFIG.statEffectMap[buildingType];
  if (!entry) return { effectLabel: NO_BONUS_LABEL, hasBonus: false };
  const label = RESOURCE_EFFECT_LABELS[entry.effect] ?? entry.effect;
  const base = PROD_BONUS_CONFIG.base;
  if (RESOURCE_EFFECTS.has(entry.effect)) {
    return { effectLabel: `+${percent(base.resourceOutput)}% ${label}`, hasBonus: true };
  }
  if (base[entry.effect] != null) {
    return { effectLabel: `+${percent(base[entry.effect])}% ${label}`, hasBonus: true };
  }
  return { effectLabel: skillPaidLabel(buildingType, entry, label, occupant), hasBonus: true };
}

export function stationRows(activeBuildings, heroRecords) {
  const occupants = new Map();
  for (const hero of heroRecords ?? []) {
    const buildingId = hero.assignment?.type === 'building' ? hero.assignment.buildingId : null;
    if (buildingId && !buildingId.startsWith('barracks_')) occupants.set(buildingId, hero);
  }

  return (activeBuildings ?? [])
    .filter(b => b.id !== 'barracks' && (b.level ?? 0) > 0 && (BUILDINGS_CONFIG[b.id]?.heroCapacity ?? 0) > 0)
    .map(b => {
      const occupant = occupants.get(b.instanceId) ?? null;
      return {
        instanceId:   b.instanceId,
        buildingType: b.id,
        buildingName: BUILDINGS_CONFIG[b.id]?.name ?? b.id,
        level:        b.level ?? 0,
        occupant,
        ...effectLabelFor(b.id, occupant),
      };
    })
    .sort((a, c) => (c.hasBonus - a.hasBonus) || a.instanceId.localeCompare(c.instanceId));
}
