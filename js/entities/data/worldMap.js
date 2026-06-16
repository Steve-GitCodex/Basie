/**
 * data/worldMap.js
 * Declarative world-map definition for the Phase 2 march system (immutable;
 * copy-before-mutate like every other config). Coordinates are top-down world
 * pixels inside `bounds`; the player city sits at `home`.
 *
 * Runtime state (node depletion, camp respawn timers, region ownership) is NOT
 * here — it lives in WorldMapManager save state, the same split BuildingManager
 * uses for `_placements`. This file is the hand-designed layout only.
 *
 * POI types: 'city' | 'resource_node' | 'camp' | 'stronghold'
 *   resource_node: { resource, gatherRate (per s), capacity (store + max load),
 *                    regenPerSec }
 *   camp / stronghold: { monsterId → MONSTERS_CONFIG }, camp also { respawnMs };
 *                    stronghold also { capturesRegion }
 *
 * Region.buff.flavor: 'economic' (resource %), 'military' (combat %), or
 *   'logistic' (march-time %). One signature flavor per faction territory.
 */

export const WORLD_MAP = {
  bounds: { w: 3600, h: 2600 },
  home:   { x: 1800, y: 1300 },

  factions: {
    neutral: { id: 'neutral', name: 'Wildlands',         color: '#7f8c8d', enemyTypes: [] },
    goblins: { id: 'goblins', name: 'Goblin Clans',      color: '#6ab04c', enemyTypes: ['goblin_camp', 'orc_warband'] },
    bandits: { id: 'bandits', name: 'Bandit Coalition',  color: '#c0392b', enemyTypes: ['bandit_camp', 'troll_bridge'] },
  },

  regions: [
    {
      id: 'home_valley', name: 'Home Valley', factionId: 'neutral',
      center: { x: 1800, y: 1300 }, radius: 560,
      strongholdId: null, buff: null, requires: null,
    },
    {
      id: 'green_marches', name: 'The Green Marches', factionId: 'goblins',
      center: { x: 1050, y: 820 }, radius: 620,
      strongholdId: 'goblin_keep',
      buff: { flavor: 'economic', resource: 'wood', pct: 0.10 },
      requires: null,
    },
    {
      id: 'red_coast', name: 'Red Coast', factionId: 'bandits',
      center: { x: 2650, y: 1780 }, radius: 640,
      strongholdId: 'bandit_fort',
      buff: { flavor: 'logistic', pct: 0.15 },
      requires: { region: 'green_marches' },
    },
  ],

  pois: [
    // ── Home Valley (neutral, safe starting gather grounds) ──────────────
    { id: 'home_city',   type: 'city',          regionId: 'home_valley',   name: 'Your City',  icon: '🏰', x: 1800, y: 1300 },
    { id: 'oak_forest',  type: 'resource_node', regionId: 'home_valley',   name: 'Oak Forest', icon: '🌲', x: 1480, y: 1060, resource: 'wood',  gatherRate: 6, capacity: 1200, regenPerSec: 2.0 },
    { id: 'stone_ridge', type: 'resource_node', regionId: 'home_valley',   name: 'Stone Ridge',icon: '🪨', x: 2120, y: 1040, resource: 'stone', gatherRate: 5, capacity: 1000, regenPerSec: 1.6 },

    // ── The Green Marches (goblins) ──────────────────────────────────────
    { id: 'iron_vein',   type: 'resource_node', regionId: 'green_marches', name: 'Iron Vein',  icon: '⛏️', x: 1180, y: 1080, resource: 'iron',  gatherRate: 4, capacity: 800, regenPerSec: 1.2 },
    { id: 'grain_fields',type: 'resource_node', regionId: 'green_marches', name: 'Grain Fields',icon: '🌾', x: 760,  y: 1060, resource: 'food',  gatherRate: 5, capacity: 1000, regenPerSec: 1.6 },
    { id: 'goblin_camp_1',type: 'camp',         regionId: 'green_marches', name: 'Goblin Camp',icon: '👺', x: 900,  y: 820,  monsterId: 'goblin_camp', respawnMs: 1_800_000 },
    { id: 'goblin_keep', type: 'stronghold',    regionId: 'green_marches', name: 'Goblin Keep',icon: '🏯', x: 1050, y: 540,  monsterId: 'orc_warband', capturesRegion: 'green_marches' },

    // ── Red Coast (bandits — gated behind taking the Green Marches) ───────
    { id: 'salt_flats',  type: 'resource_node', regionId: 'red_coast',     name: 'Salt Flats', icon: '🧂', x: 2980, y: 1620, resource: 'water', gatherRate: 5, capacity: 1000, regenPerSec: 1.6 },
    { id: 'timber_camp', type: 'resource_node', regionId: 'red_coast',     name: 'Timber Camp',icon: '🪵', x: 2520, y: 2080, resource: 'wood',  gatherRate: 6, capacity: 1200, regenPerSec: 2.0 },
    { id: 'bandit_camp_1',type: 'camp',         regionId: 'red_coast',     name: 'Bandit Hideout',icon: '🗡️', x: 2840, y: 2020, monsterId: 'bandit_camp', respawnMs: 1_800_000 },
    { id: 'bandit_fort', type: 'stronghold',    regionId: 'red_coast',     name: 'Bandit Fort',icon: '🏰', x: 2680, y: 1500, monsterId: 'troll_bridge', capturesRegion: 'red_coast' },
  ],
};
