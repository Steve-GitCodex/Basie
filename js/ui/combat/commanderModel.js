import { BUILDINGS_CONFIG } from '../../entities/GAME_DATA.js';
import { squadCommanders } from '../../systems/campaign/squadCommanders.js';

const SUPPORT_BUILDING_PREFIX = 'heroquarters_';
const NEUTRAL_BONUSES = { attackMult: 1, defenseMult: 1, baseDefense: 0, strikers: [] };

function requiredLevel(condition, barracksLevel, bm) {
  const unmet = Object.entries(condition ?? {}).find(([id, level]) =>
    (id === 'barracks' ? barracksLevel : bm?.getLevelOf?.(id) ?? 0) < level);
  return unmet ? unmet[1] : null;
}

function heroEntry(hero) {
  return {
    heroId: hero.id, level: hero.level, stars: hero.stars,
    skillLevels: hero.skillLevels, slotIndex: hero.assignment.slotIndex,
  };
}

function slotsFor({ um, bm }, squadId, fallbackBarracksId) {
  const slotCfgs = BUILDINGS_CONFIG.barracks?.squadSlots ?? [];
  const barracksId = um.getSquad(squadId)?.barracksInstanceId ?? fallbackBarracksId;
  const barracksLevel = bm?.getInstanceLevelOf?.(barracksId) ?? 1;
  return Array.from({ length: slotCfgs.length || 4 }, (_, slotIndex) => {
    const unit = um.getSlotUnit(squadId, slotIndex);
    return {
      slotIndex,
      unitId: unit?.unitId ?? null,
      tier: unit?.tier ?? null,
      count: unit?.count ?? 0,
      row: um.getSlotRow(squadId, slotIndex),
      lockedAt: requiredLevel(slotCfgs[slotIndex]?.condition, barracksLevel, bm),
    };
  });
}

export function commanderModel(systems, squadId) {
  const { heroes } = systems;
  const barracksId = heroes.barracksIdForSquad(squadId);
  const placed = heroes.getRosterWithState().filter(h => h.isOwned && h.assignment?.type === 'building');
  return squadCommanders({
    slots: slotsFor(systems, squadId, barracksId),
    squadHeroes: placed.filter(h => h.assignment.buildingId === barracksId).map(heroEntry),
    supportHeroes: placed.filter(h => h.assignment.buildingId?.startsWith(SUPPORT_BUILDING_PREFIX)).map(heroEntry),
    bonuses: { ...NEUTRAL_BONUSES, ...heroes.getCombatBonuses(squadId) },
  });
}
