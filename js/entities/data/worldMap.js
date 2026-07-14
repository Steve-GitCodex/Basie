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
 * LAYOUT = a single rectangular "state" PARTITIONED into 9 tile regions that
 * tessellate it — they pack together sharing borders (only a thin seam shows
 * between neighbours; no empty no-man's-land). Each region is authored as a
 * `rect` cell; the renderer warps the whole coordinate field with one continuous
 * function so the shared borders stay matched but read as organic/wavy hand-drawn
 * shapes, then insets each tile a few px to reveal the thin seam. The centre cell
 * is the square **command-centre ruin** — the end-game capture, gated behind
 * owning its four orthogonal neighbours AND a punishing high-level fight. The
 * player starts in the bottom-left corner tile.
 *
 *   Cells:   TL TC TR        ids: mistwood     goblin_crest dragon_spire
 *            ML C  MR             west_warrens  command_ruin ember_reach
 *            BL BC BR             home_vale     red_lowlands frost_hold
 *
 * Column x-edges: 0 · 1300 · 2300 · 3600   Row y-edges: 0 · 800 · 1800 · 2600
 *   (centre cell 1300..2300 × 800..1800 = 1000×1000 square)
 *
 * POI types: 'city' | 'resource_node' | 'camp' | 'stronghold' | 'ruin' | 'outpost' | 'world_boss'
 *   resource_node: { resource, gatherRate (per s), capacity, regenPerSec }
 *   camp / stronghold: { monsterId → MONSTERS_CONFIG }, camp also { respawnMs };
 *                    stronghold also { capturesRegion }
 *   ruin: scout→expedition (one-time loot). { expeditionMs, garrison?:monsterId,
 *         reward } where reward is one of:
 *           { kind:'buff', flavor, resource?, pct, durationMs }  (timed world buff)
 *           { kind:'item', itemId, qty }                          (→ InventoryManager)
 *           { kind:'resource', resource, amount }                 (carried home)
 *   outpost: scout→capture, persistent. { subtype:'outpost'|'shrine'|'watchtower',
 *         garrison?:monsterId, boon:{ flavor, resource?, pct }, revealRadius?,
 *         startOwner? }. While player-held the boon stays active (folded into
 *         activeBuffs); watchtowers also clear fog within revealRadius (Step 4).
 *   world_boss: attack, windowed. { monsterId, window:{ everyMs, openMs },
 *         lootTable:[{ kind:'item'|'resource', …, weight }] }. Only attackable while
 *         its window is open; one kill per window; drops a weighted rare reward.
 *         Windows derive from the clock (no stored timers).
 *
 * Region fields:
 *   rect — { x0,y0,x1,y1 } tessellating cell (renderer warps+insets it).
 *   startOwner — initial regionOwner ('player' for home, else factionId; the ruin
 *     starts 'neutral'/unowned). Kept a free owner-string so a future AIManager can
 *     flip tiles (AI factions claim regions back — see memory/basie-ai-faction-direction).
 *   requires — unlock gate: { region: id } (one) OR { regions: [ids] } (all). The
 *     ruin uses the list form. Enforced in WorldMapUI._poiVm + PoiDetailPanel.
 *   isCommandCenter — the square ruin (distinct render + capstone buff).
 *   buff.flavor — 'economic' (resource %), 'military' (combat %), 'logistic'
 *     (march-time %). One signature flavor per territory.
 */

export const WORLD_MAP = {
  bounds: { w: 3600, h: 2600 },
  home:   { x: 650, y: 2200 }, // player city (bottom-left tile)

  factions: {
    neutral: { id: 'neutral', name: 'Wildlands',         tag: 'WILD', color: '#8a93a0', enemyTypes: [] },
    goblins: { id: 'goblins', name: 'Goblin Clans',      tag: 'GOB',  color: '#b7d645', enemyTypes: ['goblin_camp', 'orc_warband', 'undead_legion', 'demon_gates'] },
    bandits: { id: 'bandits', name: 'Bandit Coalition',  tag: 'RED',  color: '#e05a3d', enemyTypes: ['bandit_camp', 'troll_bridge', 'frost_giant', 'demon_gates'] },
  },

  regions: [
    // ── BL: player home (owned) ──────────────────────────────────────────────
    {
      id: 'home_vale', name: 'Home Vale', factionId: 'neutral', startOwner: 'player',
      rect: { x0: 0, y0: 1800, x1: 1300, y1: 2600 }, center: { x: 650, y: 2200 },
      strongholdId: null, buff: null, requires: null,
    },
    // ── ML: first goblin tile (iron) ─────────────────────────────────────────
    {
      id: 'west_warrens', name: 'West Warrens', factionId: 'goblins', startOwner: 'goblins',
      rect: { x0: 0, y0: 800, x1: 1300, y1: 1800 }, center: { x: 650, y: 1300 },
      strongholdId: 'sh_west',
      buff: { flavor: 'economic', resource: 'iron', pct: 0.10 },
      requires: { region: 'home_vale' },
    },
    // ── BC: first bandit tile (food) ─────────────────────────────────────────
    {
      id: 'red_lowlands', name: 'Red Lowlands', factionId: 'bandits', startOwner: 'bandits',
      rect: { x0: 1300, y0: 1800, x1: 2300, y1: 2600 }, center: { x: 1800, y: 2200 },
      strongholdId: 'sh_red',
      buff: { flavor: 'economic', resource: 'food', pct: 0.10 },
      requires: { region: 'home_vale' },
    },
    // ── TL: goblin mid (wood) ────────────────────────────────────────────────
    {
      id: 'mistwood', name: 'Mistwood', factionId: 'goblins', startOwner: 'goblins',
      rect: { x0: 0, y0: 0, x1: 1300, y1: 800 }, center: { x: 650, y: 400 },
      strongholdId: 'sh_mist',
      buff: { flavor: 'economic', resource: 'wood', pct: 0.10 },
      requires: { region: 'west_warrens' },
    },
    // ── BR: bandit mid (water) ───────────────────────────────────────────────
    {
      id: 'frost_hold', name: 'Frost Hold', factionId: 'bandits', startOwner: 'bandits',
      rect: { x0: 2300, y0: 1800, x1: 3600, y1: 2600 }, center: { x: 2950, y: 2200 },
      strongholdId: 'sh_frost',
      buff: { flavor: 'logistic', pct: 0.12 },
      requires: { region: 'red_lowlands' },
    },
    // ── TC: goblin hard, touches ruin (military) ─────────────────────────────
    {
      id: 'goblin_crest', name: 'Goblin Crest', factionId: 'goblins', startOwner: 'goblins',
      rect: { x0: 1300, y0: 0, x1: 2300, y1: 800 }, center: { x: 1800, y: 400 },
      strongholdId: 'sh_crest',
      buff: { flavor: 'military', pct: 0.10 },
      requires: { region: 'mistwood' },
    },
    // ── MR: bandit hard, touches ruin (stone) ────────────────────────────────
    {
      id: 'ember_reach', name: 'Ember Reach', factionId: 'bandits', startOwner: 'bandits',
      rect: { x0: 2300, y0: 800, x1: 3600, y1: 1800 }, center: { x: 2950, y: 1300 },
      strongholdId: 'sh_ember',
      buff: { flavor: 'economic', resource: 'stone', pct: 0.10 },
      requires: { region: 'frost_hold' },
    },
    // ── TR: hardest outer, contested wildlands (military) ────────────────────
    {
      id: 'dragon_spire', name: 'Dragon Spire', factionId: 'neutral', startOwner: 'neutral',
      rect: { x0: 2300, y0: 0, x1: 3600, y1: 800 }, center: { x: 2950, y: 400 },
      strongholdId: 'sh_dragon',
      buff: { flavor: 'military', pct: 0.15 },
      requires: { region: 'goblin_crest' },
    },
    // ── C: command-centre ruin (square; capstone; gated by all 4 neighbours) ──
    {
      id: 'command_ruin', name: 'Command Ruin', factionId: 'neutral', startOwner: 'neutral',
      isCommandCenter: true,
      rect: { x0: 1300, y0: 800, x1: 2300, y1: 1800 }, center: { x: 1800, y: 1300 },
      strongholdId: 'sh_ruin',
      buff: { flavor: 'military', pct: 0.25 },
      requires: { regions: ['west_warrens', 'goblin_crest', 'ember_reach', 'red_lowlands'] },
    },
  ],

  pois: [
    // ── Home Vale (player, safe gather grounds) ──────────────────────────────
    { id: 'home_city', type: 'city',          regionId: 'home_vale',    name: 'Your City',  icon: '🏰', x: 650,  y: 2200 },
    { id: 'rn_oak',    type: 'resource_node', regionId: 'home_vale',    name: 'Oak Forest', icon: '🌲', x: 430,  y: 2010, level: 1, resource: 'wood',  gatherRate: 6, capacity: 1200, regenPerSec: 2.0 },
    { id: 'rn_well',   type: 'resource_node', regionId: 'home_vale',    name: 'Spring Well',icon: '💧', x: 880,  y: 2390, level: 1, resource: 'water', gatherRate: 5, capacity: 1000, regenPerSec: 1.6 },
    { id: 'ruin_vale', type: 'ruin',          regionId: 'home_vale',    name: 'Sunken Shrine', icon: '🗿', x: 300, y: 2440, level: 1, expeditionMs: 30_000,
      reward: { kind: 'buff', flavor: 'logistic', pct: 0.15, durationMs: 600_000 } },
    { id: 'op_relay',  type: 'outpost',       regionId: 'home_vale',    name: 'Crossroads Relay', icon: '⛺', x: 1080, y: 1960, level: 1, subtype: 'outpost',
      boon: { flavor: 'logistic', pct: 0.10 } },

    // ── West Warrens (goblins, iron) ─────────────────────────────────────────
    { id: 'sh_west',   type: 'stronghold',    regionId: 'west_warrens', name: 'Warren Gate',icon: '🏯', x: 650,  y: 1130, level: 3, monsterId: 'orc_warband',  capturesRegion: 'west_warrens' },
    { id: 'rn_iron',   type: 'resource_node', regionId: 'west_warrens', name: 'Iron Vein',  icon: '⛏️', x: 440,  y: 1430, level: 2, resource: 'iron',  gatherRate: 4, capacity: 800,  regenPerSec: 1.2 },
    { id: 'camp_west', type: 'camp',          regionId: 'west_warrens', name: 'Goblin Camp',icon: '👺', x: 880,  y: 1430, level: 2, monsterId: 'goblin_camp',  respawnMs: 1_800_000 },
    { id: 'ruin_warren', type: 'ruin',        regionId: 'west_warrens', name: 'Old Warren Vault', icon: '🗿', x: 300, y: 980, level: 3, expeditionMs: 45_000, garrison: 'goblin_camp',
      reward: { kind: 'item', itemId: 'scroll_rare', qty: 1 } },
    { id: 'op_shrine', type: 'outpost',       regionId: 'west_warrens', name: 'Warden Shrine', icon: '⛩️', x: 1080, y: 1180, level: 3, subtype: 'shrine', garrison: 'goblin_camp',
      boon: { flavor: 'military', pct: 0.08 } },

    // ── Red Lowlands (bandits, food) ─────────────────────────────────────────
    { id: 'sh_red',    type: 'stronghold',    regionId: 'red_lowlands', name: 'Reaver Fort',icon: '🏰', x: 1800, y: 2060, level: 3, monsterId: 'troll_bridge', capturesRegion: 'red_lowlands' },
    { id: 'rn_grain',  type: 'resource_node', regionId: 'red_lowlands', name: 'Grain Fields',icon:'🌾', x: 1600, y: 2380, level: 2, resource: 'food',  gatherRate: 5, capacity: 1000, regenPerSec: 1.6 },
    { id: 'camp_red',  type: 'camp',          regionId: 'red_lowlands', name: 'Bandit Hideout',icon:'🗡️',x: 2020, y: 2360, level: 2, monsterId: 'bandit_camp',  respawnMs: 1_800_000 },
    { id: 'wb_roc',    type: 'world_boss',    regionId: 'red_lowlands', name: 'The Bonecrusher', icon: '🐲', x: 2180, y: 1980, level: 8, monsterId: 'frost_giant',
      window: { everyMs: 180_000, openMs: 90_000 },
      lootTable: [
        { kind: 'item',     itemId: 'scroll_rare',   qty: 1,   weight: 3 },
        { kind: 'resource', resource: 'money',       amount: 500, weight: 5 },
        { kind: 'item',     itemId: 'scroll_common', qty: 2,   weight: 2 },
      ] },

    // ── Mistwood (goblins, wood) ─────────────────────────────────────────────
    { id: 'sh_mist',   type: 'stronghold',    regionId: 'mistwood',     name: 'Haunted Keep',icon:'🏯', x: 650,  y: 300,  level: 5, monsterId: 'undead_legion', capturesRegion: 'mistwood' },
    { id: 'rn_timber', type: 'resource_node', regionId: 'mistwood',     name: 'Timberfall', icon: '🪵', x: 900,  y: 560,  level: 3, resource: 'wood',  gatherRate: 6, capacity: 1200, regenPerSec: 2.0 },
    { id: 'op_tower',  type: 'outpost',       regionId: 'mistwood',     name: 'Mistwood Watchtower', icon: '🗼', x: 1100, y: 300, level: 4, subtype: 'watchtower', garrison: 'goblin_camp',
      boon: { flavor: 'logistic', pct: 0.05 }, revealRadius: 760 },

    // ── Frost Hold (bandits, water) ──────────────────────────────────────────
    { id: 'sh_frost',  type: 'stronghold',    regionId: 'frost_hold',   name: 'Frost Hold', icon: '🏰', x: 2950, y: 2060, level: 5, monsterId: 'frost_giant',  capturesRegion: 'frost_hold' },
    { id: 'rn_ice',    type: 'resource_node', regionId: 'frost_hold',   name: 'Salt Flats', icon: '🧂', x: 3160, y: 2380, level: 3, resource: 'water', gatherRate: 6, capacity: 1100, regenPerSec: 1.8 },

    // ── Goblin Crest (goblins, touches ruin) ─────────────────────────────────
    { id: 'sh_crest',  type: 'stronghold',    regionId: 'goblin_crest', name: 'Crest Citadel',icon:'🏯',x: 1800, y: 300,  level: 6, monsterId: 'demon_gates',  capturesRegion: 'goblin_crest' },
    { id: 'rn_crest',  type: 'resource_node', regionId: 'goblin_crest', name: 'Sulfur Pits', icon: '⛏️', x: 1600, y: 560,  level: 4, resource: 'iron',  gatherRate: 5, capacity: 900,  regenPerSec: 1.4 },

    // ── Ember Reach (bandits, touches ruin) ──────────────────────────────────
    { id: 'sh_ember',  type: 'stronghold',    regionId: 'ember_reach',  name: 'Ember Bastion',icon:'🏰',x: 2950, y: 1130, level: 6, monsterId: 'demon_gates',  capturesRegion: 'ember_reach' },
    { id: 'rn_ore',    type: 'resource_node', regionId: 'ember_reach',  name: 'Stone Ridge', icon: '🪨', x: 3160, y: 1430, level: 4, resource: 'stone', gatherRate: 5, capacity: 1000, regenPerSec: 1.6 },

    // ── Dragon Spire (neutral elite, hardest outer) ──────────────────────────
    { id: 'sh_dragon', type: 'stronghold',    regionId: 'dragon_spire', name: "Dragon's Lair",icon:'🐉',x: 2950, y: 300,  level: 7, monsterId: 'dragon_lair',  capturesRegion: 'dragon_spire' },
    { id: 'rn_hunt',   type: 'resource_node', regionId: 'dragon_spire', name: 'Hunting Grounds',icon:'🍖',x:2740,y: 560,  level: 5, resource: 'food',  gatherRate: 6, capacity: 1200, regenPerSec: 2.0 },

    // ── Command Ruin (centre, end-game) ──────────────────────────────────────
    { id: 'sh_ruin',   type: 'stronghold',    regionId: 'command_ruin', name: 'Command Ruin',icon: '🏛️', x: 1800, y: 1300, level: 10, monsterId: 'chaos_titan', capturesRegion: 'command_ruin' },
  ],
};
