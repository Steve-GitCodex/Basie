import { HEROES_CONFIG, PROD_BONUS_CONFIG } from '../../entities/GAME_DATA.js';

const RESOURCE_OUTPUT_EFFECTS = new Set(['money', 'food', 'wood', 'stone', 'iron']);

function scaleFor(hero) {
  const starMult  = 1 + PROD_BONUS_CONFIG.starBonusPerStar * (hero.stars ?? 0);
  const levelMult = 1 + PROD_BONUS_CONFIG.levelScalePerLevel * ((hero.level ?? 1) - 1);
  return starMult * levelMult;
}

function effectEntryFor(hero, buildingType) {
  const bb = HEROES_CONFIG[hero.heroId]?.buildingBonus;
  if (!bb?.stat || bb.buildingType !== buildingType) return null;
  const entry = PROD_BONUS_CONFIG.statEffectMap[buildingType];
  return entry && entry.stat === bb.stat ? entry : null;
}

export function resourceBonusFor(hero, buildingType) {
  const entry = effectEntryFor(hero, buildingType);
  if (!entry || !RESOURCE_OUTPUT_EFFECTS.has(entry.effect)) return 0;
  return PROD_BONUS_CONFIG.base.resourceOutput * scaleFor(hero);
}

export function globalEffectBonus(heroes) {
  const map = {};
  for (const hero of heroes) {
    if (hero.assignment?.type !== 'building') continue;
    const buildingType = hero.assignment.buildingId?.replace(/_\d+$/, '');
    const entry = effectEntryFor(hero, buildingType);
    if (!entry || RESOURCE_OUTPUT_EFFECTS.has(entry.effect)) continue;
    const base = PROD_BONUS_CONFIG.base[entry.effect];
    if (base == null) continue;
    map[entry.effect] = (map[entry.effect] ?? 0) + base * scaleFor(hero);
  }
  return map;
}
