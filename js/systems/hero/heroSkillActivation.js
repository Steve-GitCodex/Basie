import { BUILDINGS_CONFIG, PROD_BONUS_CONFIG } from '../../entities/GAME_DATA.js';
import { stationedTypeOf } from './heroProductionBonus.js';

const COMBAT_POSTING_TYPES = new Set(['barracks', 'heroquarters']);
const RESOURCE_EFFECTS = new Set(['money', 'food', 'wood', 'stone', 'iron']);

const COMBAT_EFFECT_LABELS = {
  attack:         'Squad attack',
  defense:        'Squad defense',
  auraValue:      'Aura strength',
  lossReduction:  'Troop losses',
  postBattleHeal: 'Post-battle healing',
  attackBonus:    'Squad attack',
  defenseBonus:   'Squad defense',
  evasion:        'Evasion',
};

const ECONOMY_EFFECT_LABELS = {
  resourceOutput: 'Resource output',
  trainingSpeed:  'Training speed',
  researchSpeed:  'Research speed',
};

const STRUCTURAL_EFFECT_KEYS = new Set(['trigger', 'duration', 'scope', 'stat', 'value']);

const COMBAT_REQUIREMENT = 'stationed in a barracks or the Hero Quarters';

function buildingTypesPaying(kind) {
  return Object.entries(PROD_BONUS_CONFIG.statEffectMap)
    .filter(([, entry]) => (kind === 'resourceOutput'
      ? RESOURCE_EFFECTS.has(entry.effect)
      : entry.effect === kind))
    .map(([type]) => type);
}

function economyRequirement(kind, types) {
  if (kind === 'resourceOutput') return 'stationed in a resource building';
  const names = types.map(t => BUILDINGS_CONFIG[t]?.name ?? t);
  return names.length > 0 ? `stationed in the ${names.join(' or ')}` : 'a posting that pays this effect';
}

export function skillEffectKinds(skill) {
  const fx = skill?.effect ?? {};
  const kinds = [];
  if (fx.stat) kinds.push(fx.stat);
  for (const [key, value] of Object.entries(fx)) {
    if (STRUCTURAL_EFFECT_KEYS.has(key) || value == null || value === false) continue;
    kinds.push(key);
  }
  return [...new Set(kinds)];
}

export function skillEffectActivation(hero, skill) {
  const posting = stationedTypeOf(hero);
  const entries = [];

  for (const kind of skillEffectKinds(skill)) {
    if (COMBAT_EFFECT_LABELS[kind]) {
      entries.push({
        kind,
        label: COMBAT_EFFECT_LABELS[kind],
        active: COMBAT_POSTING_TYPES.has(posting),
        requirement: COMBAT_REQUIREMENT,
      });
      continue;
    }
    if (ECONOMY_EFFECT_LABELS[kind]) {
      const types = buildingTypesPaying(kind);
      entries.push({
        kind,
        label: ECONOMY_EFFECT_LABELS[kind],
        active: types.includes(posting),
        requirement: economyRequirement(kind, types),
      });
    }
  }
  return entries;
}

export function skillDormancy(hero, skill) {
  const entries = skillEffectActivation(hero, skill);
  const dormant = entries.filter(e => !e.active);
  return {
    entries,
    isFullyDormant: entries.length > 0 && dormant.length === entries.length,
    isPartlyDormant: dormant.length > 0 && dormant.length < entries.length,
  };
}
