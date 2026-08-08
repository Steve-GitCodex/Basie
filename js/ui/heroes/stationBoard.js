import { BUILDINGS_CONFIG, PROD_BONUS_CONFIG } from '../../entities/GAME_DATA.js';

const RESOURCE_EFFECT_LABELS = {
  money: 'gold', food: 'food', wood: 'wood', stone: 'stone', iron: 'iron',
  trainingSpeed: 'training speed', researchSpeed: 'research speed',
};

const NO_BONUS_LABEL = 'No station bonus yet';

function effectLabelFor(buildingType) {
  const entry = PROD_BONUS_CONFIG.statEffectMap[buildingType];
  if (!entry) return { effectLabel: NO_BONUS_LABEL, hasBonus: false };
  const pct = Math.round(PROD_BONUS_CONFIG.base.resourceOutput * 100);
  const speedPct = Math.round((PROD_BONUS_CONFIG.base[entry.effect] ?? 0) * 100);
  const isResource = PROD_BONUS_CONFIG.base[entry.effect] == null;
  const label = RESOURCE_EFFECT_LABELS[entry.effect] ?? entry.effect;
  return { effectLabel: `+${isResource ? pct : speedPct}% ${label}`, hasBonus: true };
}

export function stationRows(activeBuildings, heroRecords) {
  const occupants = new Map();
  for (const hero of heroRecords ?? []) {
    const buildingId = hero.assignment?.type === 'building' ? hero.assignment.buildingId : null;
    if (buildingId && !buildingId.startsWith('barracks_')) occupants.set(buildingId, hero);
  }

  return (activeBuildings ?? [])
    .filter(b => b.id !== 'barracks' && (b.level ?? 0) > 0)
    .map(b => ({
      instanceId:   b.instanceId,
      buildingType: b.id,
      buildingName: BUILDINGS_CONFIG[b.id]?.name ?? b.id,
      level:        b.level ?? 0,
      occupant:     occupants.get(b.instanceId) ?? null,
      ...effectLabelFor(b.id),
    }))
    .sort((a, c) => (c.hasBonus - a.hasBonus) || a.instanceId.localeCompare(c.instanceId));
}
