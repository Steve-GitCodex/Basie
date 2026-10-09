import { BUILDINGS_CONFIG } from '../../entities/GAME_DATA.js';
import { levelTable } from './levelTable.js';

export function trainingSlotAt(buildingId, level) {
  const slots = BUILDINGS_CONFIG[buildingId]?.trainingSlots;
  if (!slots || level <= 0) return null;
  return levelTable(slots, level - 1, `${buildingId}.trainingSlots`);
}

export function levelStatsAt(buildingId, level) {
  const stats = BUILDINGS_CONFIG[buildingId]?.levelStats;
  if (!stats || level <= 0) return null;
  return levelTable(stats, level - 1, `${buildingId}.levelStats`);
}
