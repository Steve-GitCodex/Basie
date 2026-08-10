/** Barrel re-export — game data lives under js/entities/data/, split by domain. */

export { BUILDINGS_CONFIG, QUEUE_CONFIG, HQ_UNLOCK_TABLE } from './data/buildings.js';
export { UNITS_CONFIG, UNIT_TIER_REQUIREMENTS } from './data/units.js';
export {
  HERO_CLASSIFICATIONS, BUFF_CATEGORIES, AURA_BUFF_CATEGORY,
  HEROES_CONFIG, AWAKENING_CONFIG, GACHA_CONFIG,
  XP_CONFIG, PITY_CONFIG, EXCHANGE_CONFIG, PROD_BONUS_CONFIG,
  FRAGMENTS_PER_SHARD, SHARDS_TO_UNLOCK
} from './data/heroes.js';
export { SKILLS_CONFIG } from './data/heroSkills.js';
export { INVENTORY_ITEMS, SHOP_CONFIG, DIAMOND_PACKAGES, VIP_TIERS } from './data/economy.js';
export { MONSTERS_CONFIG, CAMPAIGNS_CONFIG, ENCOUNTER_MODIFIERS, DIFFICULTY_MODIFIERS, SURVIVAL_MONSTER } from './data/combat.js';
export { TECH_CONFIG, TECH_BRANCHES } from './data/tech.js';
export {
  QUESTS_CONFIG, ACHIEVEMENTS_CONFIG, CHALLENGES_CONFIG,
  DAILY_PASS_CONFIG, CHALLENGE_PASS_CONFIG,
  DAILY_LOGIN_REWARDS, DAILY_LOGIN_MILESTONE
} from './data/progression.js';
export { STORY_CHAPTERS } from './data/story.js';
export { EVENTS_CONFIG } from './data/events.js';
export { TAB_UNLOCK_CONDITIONS, TAB_GROUPS, BUILDING_TAB_MAP, BUILDING_VIEW_ACTION } from './data/navigation.js';
export {
  CELL_COLS, CELL_ROWS, BUILD_RECT, CATEGORY_ZONE, HQ_RECT,
  GRID_TILE_COLS, GRID_TILE_ROWS, GRID_MARGIN_TILES,
  cellToTile, rectFrontTile, rectCenterTile, rectCornersTile,
  rectsOverlap, inBounds, clampRect,
  SKELETON, cellKey, isSkeletonCell, rectHitsSkeleton,
} from './data/cityGrid.js';
export {
  SECTORS, SECTOR_IDS, CORE_RECT, sectorIdAt, coreContains, sectorName,
} from './data/citySectors.js';
export { WORLD_MAP } from './data/worldMap.js';

/** logPersist: true writes the in-game log buffer to localStorage on unload (Ctrl+Shift+L opens it). */
export const DEBUG_CONFIG = { logPersist: false };
