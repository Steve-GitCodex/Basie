/**
 * GAME_DATA.js
 * Barrel re-export — all game data is split into focused domain files under js/entities/data/.
 * Import from this file exactly as before; no consumers need to change.
 *
 * Domain files:
 *   data/buildings.js   — BUILDINGS_CONFIG, QUEUE_CONFIG, HQ_UNLOCK_TABLE
 *   data/units.js       — UNITS_CONFIG
 *   data/heroes.js      — HERO_CLASSIFICATIONS, BUFF_CATEGORIES, AURA_BUFF_CATEGORY,
 *                          HEROES_CONFIG, SKILLS_CONFIG, AWAKENING_CONFIG, GACHA_CONFIG
 *   data/economy.js     — INVENTORY_ITEMS, SHOP_CONFIG, DIAMOND_PACKAGES, VIP_TIERS
 *   data/combat.js      — MONSTERS_CONFIG, CAMPAIGNS_CONFIG, ENCOUNTER_MODIFIERS
 *   data/tech.js        — TECH_CONFIG
 *   data/progression.js — QUESTS_CONFIG, ACHIEVEMENTS_CONFIG, CHALLENGES_CONFIG,
 *                          DAILY_PASS_CONFIG, CHALLENGE_PASS_CONFIG,
 *                          DAILY_LOGIN_REWARDS, DAILY_LOGIN_MILESTONE
 *   data/story.js       — STORY_CHAPTERS
 *   data/events.js      — EVENTS_CONFIG
 */

export { BUILDINGS_CONFIG, QUEUE_CONFIG, HQ_UNLOCK_TABLE } from './data/buildings.js';
export { UNITS_CONFIG, UNIT_TIER_REQUIREMENTS } from './data/units.js';
export {
  HERO_CLASSIFICATIONS, BUFF_CATEGORIES, AURA_BUFF_CATEGORY,
  HEROES_CONFIG, SKILLS_CONFIG, AWAKENING_CONFIG, GACHA_CONFIG
} from './data/heroes.js';
export { INVENTORY_ITEMS, SHOP_CONFIG, DIAMOND_PACKAGES, VIP_TIERS } from './data/economy.js';
export { MONSTERS_CONFIG, CAMPAIGNS_CONFIG, ENCOUNTER_MODIFIERS, DIFFICULTY_MODIFIERS, SURVIVAL_MONSTER } from './data/combat.js';
export { TECH_CONFIG } from './data/tech.js';
export {
  QUESTS_CONFIG, ACHIEVEMENTS_CONFIG, CHALLENGES_CONFIG,
  DAILY_PASS_CONFIG, CHALLENGE_PASS_CONFIG,
  DAILY_LOGIN_REWARDS, DAILY_LOGIN_MILESTONE
} from './data/progression.js';
export { STORY_CHAPTERS } from './data/story.js';
export { EVENTS_CONFIG } from './data/events.js';
export { TAB_UNLOCK_CONDITIONS, TAB_GROUPS, BUILDING_TAB_MAP } from './data/navigation.js';
export {
  CITY_BLUEPRINT, CATEGORY_ZONE,
  isRoad, zoneAt, plotAt, plotById, plotsInZone
} from './data/cityBlueprint.js';

/**
 * DEBUG_CONFIG — controls optional debug features.
 * Set logPersist: true to write the in-game log buffer to localStorage on page unload
 * (use Ctrl+Shift+L to open the in-game log overlay at any time).
 */
export const DEBUG_CONFIG = { logPersist: false };
