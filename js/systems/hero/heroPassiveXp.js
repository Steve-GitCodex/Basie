import { HEROES_CONFIG, PROD_BONUS_CONFIG, SKILLS_CONFIG, XP_CONFIG } from '../../entities/GAME_DATA.js';
import { isPayingPosting, skillEffectActivation } from './heroSkillActivation.js';
import { isUnlocked, reconcileSkillLevels } from './heroSkills.js';
import { stationedTypeOf } from './heroProductionBonus.js';

export function drainPassiveXpTicks(elapsedSec, intervalSec) {
  const ticks = Math.floor(elapsedSec / intervalSec);
  return { ticks, remainder: elapsedSec - ticks * intervalSec };
}

function stationBonusApplies(heroId, buildingType) {
  const bonus = HEROES_CONFIG[heroId]?.buildingBonus;
  return bonus?.buildingType === buildingType
    && PROD_BONUS_CONFIG.statEffectMap[buildingType]?.stat === bonus.stat;
}

function hasActiveSkillAt(hero, buildingType) {
  const levels = reconcileSkillLevels(hero.heroId, hero.skillLevels);
  return (HEROES_CONFIG[hero.heroId]?.skills ?? []).some(id => {
    const skill = SKILLS_CONFIG[id];
    if (!skill || !isUnlocked(skill, hero)) return false;
    if (skill.type === 'major' && levels[id] < 1) return false;
    return skillEffectActivation(hero, skill, buildingType).some(entry => entry.active);
  });
}

export function isContributingAt(hero, buildingType) {
  return isPayingPosting(buildingType)
    && (stationBonusApplies(hero.heroId, buildingType) || hasActiveSkillAt(hero, buildingType));
}

export function passiveXpRecipients(heroes, levelCap) {
  const ceiling = levelCap - XP_CONFIG.passiveXpCapOffset;
  const ids = [];
  for (const hero of heroes) {
    const type = stationedTypeOf(hero);
    if (type && hero.level < ceiling && isContributingAt(hero, type)) ids.push(hero.heroId);
  }
  return ids;
}
