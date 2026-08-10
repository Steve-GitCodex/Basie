import { HEROES_CONFIG, PROD_BONUS_CONFIG, SKILLS_CONFIG } from '../../entities/GAME_DATA.js';
import { reconcileSkillLevels, effectValueAt, isUnlocked } from './heroSkills.js';

const RESOURCE_OUTPUT_EFFECTS = new Set(['money', 'food', 'wood', 'stone', 'iron']);

function scaleFor(hero) {
  const starMult  = 1 + PROD_BONUS_CONFIG.starBonusPerStar * (hero.stars ?? 0);
  const levelMult = 1 + PROD_BONUS_CONFIG.levelScalePerLevel * ((hero.level ?? 1) - 1);
  return starMult * levelMult;
}

function stationedTypeOf(hero) {
  if (hero?.assignment?.type !== 'building') return null;
  return hero.assignment.buildingId?.replace(/_\d+$/, '') ?? null;
}

function effectEntryFor(hero, buildingType) {
  const bb = HEROES_CONFIG[hero.heroId]?.buildingBonus;
  if (!bb?.stat || bb.buildingType !== buildingType) return null;
  const entry = PROD_BONUS_CONFIG.statEffectMap[buildingType];
  return entry && entry.stat === bb.stat ? entry : null;
}

export function skillBonusFor(hero, buildingType, effectKind) {
  if (!buildingType || stationedTypeOf(hero) !== buildingType) return 0;
  const entry = PROD_BONUS_CONFIG.statEffectMap[buildingType];
  if (!entry || entry.effect !== effectKind) return 0;

  const isResource = RESOURCE_OUTPUT_EFFECTS.has(effectKind);
  const levels = reconcileSkillLevels(hero.heroId, hero.skillLevels);
  let total = 0;

  for (const id of (HEROES_CONFIG[hero.heroId]?.skills ?? [])) {
    const skill = SKILLS_CONFIG[id];
    if (!skill || !isUnlocked(skill, hero)) continue;
    const level = levels[id];
    if (skill.type === 'major' && level < 1) continue;

    const fx = skill.effect ?? {};
    const base = isResource ? fx.resourceOutput : fx[effectKind];
    if (base) total += effectValueAt(skill, base, level);
  }
  return total;
}

export function resourceBonusFor(hero, buildingType) {
  if (stationedTypeOf(hero) !== buildingType) return 0;
  const entry = effectEntryFor(hero, buildingType);
  const station = entry && RESOURCE_OUTPUT_EFFECTS.has(entry.effect)
    ? PROD_BONUS_CONFIG.base.resourceOutput * scaleFor(hero)
    : 0;
  const mapped = PROD_BONUS_CONFIG.statEffectMap[buildingType];
  const skill = mapped && RESOURCE_OUTPUT_EFFECTS.has(mapped.effect)
    ? skillBonusFor(hero, buildingType, mapped.effect)
    : 0;
  return station + skill;
}

export function globalEffectBonus(heroes) {
  const map = {};
  for (const hero of heroes) {
    const buildingType = stationedTypeOf(hero);
    if (!buildingType) continue;
    const mapped = PROD_BONUS_CONFIG.statEffectMap[buildingType];
    if (!mapped || RESOURCE_OUTPUT_EFFECTS.has(mapped.effect)) continue;

    const base = PROD_BONUS_CONFIG.base[mapped.effect];
    const station = effectEntryFor(hero, buildingType) && base != null
      ? base * scaleFor(hero)
      : 0;
    const total = station + skillBonusFor(hero, buildingType, mapped.effect);
    if (total !== 0) map[mapped.effect] = (map[mapped.effect] ?? 0) + total;
  }
  return map;
}
