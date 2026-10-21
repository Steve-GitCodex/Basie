/**
 * data/buildings.js
 * Building configurations, queue slot definitions, and HQ unlock table.
 */

import { hqChain } from './hqChain.js';
import { HQ_MAX } from './buildingCurve.js';
import {
  growTable, eraMoneyTable, scaleTable, STORAGE_GROWTH_BANDS, BARRACKS_SLOT_CAPACITY, RALLY_STATS,
  TRAINING_SLOTS, houseCafeteriaLadder, bankPopulationLadder, cafeteriaCapacity, hqUnlockTable,
} from './buildingTables.js';
import { applyGeneratedLabels } from './buildingLabels.js';

const STOREHOUSE_MONEY_RATIO = 1.7;
const HALL_MAX_LEVEL = 30;
const HOUSE_MAX_LEVEL = 20;
const CAFETERIA_MAX_LEVEL = 20;
const BANK_MAX_LEVEL = 20;

export const BUILDINGS_CONFIG = {
  townhall: {
    id: 'townhall', name: 'Headquarters (HQ)', shortName: 'HQ', icon: '🏛️',
    footprint: [4,4],
    doorSide: 's',
    description: 'The heart of your base. Upgrade to unlock new buildings, increase all caps, and lead a larger population.',
    maxLevel: 30,
    levelRequirements: hqChain(),
    baseCost: { wood: 500, stone: 300 },
    buildTime: 120,
    effects: { unlockBuildings: true },
    storageCap: {
      wood:  growTable([0,  3000,  5500, 10000,  18000,  32000,  57000, 100000, 175000,  305000,  530000], HQ_MAX, STORAGE_GROWTH_BANDS),
      stone: growTable([0,  2500,  4500,  8000,  14500,  26000,  46000,  80000, 140000,  245000,  425000], HQ_MAX, STORAGE_GROWTH_BANDS),
      iron:  growTable([0,   800,  1200,  2000,   3300,   5500,   9000,  15000,  24000,   39000,   63000], HQ_MAX, STORAGE_GROWTH_BANDS),
      food:  growTable([0,   800,  1200,  2000,   3300,   5500,   9000,  15000,  24000,   39000,   63000], HQ_MAX, STORAGE_GROWTH_BANDS),
      water: growTable([0,  1000,  1800,  3000,   5000,   8500,  14000,  24000,  40000,   68000,  113000], HQ_MAX, STORAGE_GROWTH_BANDS),
      money: eraMoneyTable(HQ_MAX),
    },
    effectLabel: '📦 Exponential storage cap per level · 🔓 Unlocks buildings',
    category: 'core', requires: null,
    maxInstances: 1,
    instanceSlots: [{ index: 0, condition: null }],
    heroCapacity: 3,  // Can hold up to 3 heroes who provide various bonuses and abilities to the base
  },
  farm: {
    id: 'farm', name: 'Farm', icon: '🌾',
    footprint: [3,3],
    doorSide: 's',
    description: 'Generates food to support a larger army.',
    maxLevel: 30,
    baseCost: { wood: 80, stone: 30 },
    buildTime: 10,
    effects: { food: 0.5 },
    effectLabel: '🌾 +0.5 Food/s per level',
    category: 'production', requires: null,
    heroCapacity: 1,
    maxInstances: 4,
    instanceSlots: [
      { index: 0, condition: null },
      { index: 1, condition: { townhall: 4, farm: 2 } },
      { index: 2, condition: { townhall: 9, farm: 2 } },
      { index: 3, condition: { townhall: 15, farm: 2 } },
    ],
  },
  mine: {
    id: 'mine', name: 'Iron Mine', icon: '⛏️',
    footprint: [3,3],
    doorSide: 'sw',
    description: 'Extracts iron ore for tools, weapons, and construction.',
    maxLevel: 30,
    baseCost: { wood: 100, stone: 50 },
    buildTime: 15,
    effects: { iron: 0.5 },
    effectLabel: '⚙️ +0.5 Iron/s per level',
    category: 'production', requires: null,
    heroCapacity: 1,
    maxInstances: 3,
    instanceSlots: [
      { index: 0, condition: null },
      { index: 1, condition: { townhall: 6, mine: 2 } },
      { index: 2, condition: { townhall: 12, mine: 2 } },
    ],
  },
  lumbermill: {
    id: 'lumbermill', name: 'Lumber Mill', icon: '🪵',
    footprint: [3,3],
    doorSide: 'sw',
    description: 'Chops down trees for wood production.',
    maxLevel: 30,
    baseCost: { stone: 80 },
    buildTime: 12,
    effects: { wood: 0.8 },
    effectLabel: '🪵 +0.8 Wood/s per level',
    category: 'production', requires: null,
    heroCapacity: 1,
    maxInstances: 3,
    instanceSlots: [
      { index: 0, condition: null },
      { index: 1, condition: { townhall: 4, lumbermill: 2 } },
      { index: 2, condition: { townhall: 9, lumbermill: 2 } },
    ],
  },
  quarry: {
    id: 'quarry', name: 'Stone Quarry', icon: '🪨',
    footprint: [3,3],
    doorSide: 's',
    description: 'Mines stone for construction.',
    maxLevel: 30,
    baseCost: { wood: 100, iron: 20 },
    buildTime: 20,
    effects: { stone: 0.7 },
    effectLabel: '🪨 +0.7 Stone/s per level',
    category: 'production', requires: null,
    heroCapacity: 1,
    maxInstances: 3,
    instanceSlots: [
      { index: 0, condition: null },
      { index: 1, condition: { townhall: 6, quarry: 2 } },
      { index: 2, condition: { townhall: 12, quarry: 2 } },
    ],
  },
  storehouse: {
    id: 'storehouse', name: 'Storehouse', icon: '🏚️',
    footprint: [2,2],
    doorSide: 'se',
    description: 'Expands your resource storage. Each level significantly increases all caps.',
    maxLevel: 30,
    baseCost: { wood: 300, stone: 200 },
    buildTime: 25,
    effects: {},
    storageCap: {
      wood:  growTable([0,  5500,  9000, 15000,  25000,  42000,  70000, 117000, 195000,  325000,  545000], HQ_MAX, STORAGE_GROWTH_BANDS),
      stone: growTable([0,  4500,  7000, 12000,  20000,  33000,  55000,  92000, 153000,  255000,  425000], HQ_MAX, STORAGE_GROWTH_BANDS),
      iron:  growTable([0,  2200,  3500,  5700,   9200,  15000,  24000,  39000,  63000,  102000,  165000], HQ_MAX, STORAGE_GROWTH_BANDS),
      food:  growTable([0,  2200,  3500,  5700,   9200,  15000,  24000,  39000,  63000,  102000,  165000], HQ_MAX, STORAGE_GROWTH_BANDS),
      water: growTable([0,  2500,  4000,  6500,  10500,  17000,  27500,  45000,  73000,  119000,  193000], HQ_MAX, STORAGE_GROWTH_BANDS),
      money: scaleTable(eraMoneyTable(HQ_MAX), STOREHOUSE_MONEY_RATIO),
    },
    effectLabel: '📦 Exponential storage cap per level',
    category: 'core', requires: null,
    maxInstances: 2,
    instanceSlots: [
      { index: 0, condition: null },
      { index: 1, condition: { townhall: 9 } },
    ],
    heroCapacity: 1,
  },
  well: {
    id: 'well', name: 'Well', icon: '🪣',
    footprint: [2,2],
    doorSide: 's',
    description: 'Draws fresh water from underground springs.',
    maxLevel: 20,
    baseCost: { stone: 80, iron: 20 },
    buildTime: 15,
    effects: { water: 0.6 },
    effectLabel: '💧 +0.6 Water/s per level',
    category: 'production', requires: null,
    maxInstances: 3,
    instanceSlots: [
      { index: 0, condition: null },
      { index: 1, condition: { townhall: 4 } },
      { index: 2, condition: { townhall: 12 } },
    ],
    heroCapacity: 1,  // Can hold 1 hero
  },
  house: {
    id: 'house', name: 'House', icon: '🏠',
    footprint: [3,3],
    doorSide: 'sw',
    description: 'Provides housing for your population.',
    maxLevel: HOUSE_MAX_LEVEL,
    baseCost: { wood: 120, stone: 80 },
    buildTime: 20,
    effects: {},
    effectLabel: '👥 +10 population capacity per level',
    populationCapacityPerLevel: 10,
    category: 'population', requires: { townhall: 1, cafeteria: 1 },
    levelRequirements: houseCafeteriaLadder(HOUSE_MAX_LEVEL),
    maxInstances: 6,
    instanceSlots: [
      { index: 0, condition: null },
      { index: 1, condition: { townhall: 2 } },
      { index: 2, condition: { townhall: 4 } },
      { index: 3, condition: { townhall: 9 } },
      { index: 4, condition: { townhall: 15 } },
      { index: 5, condition: { townhall: 22 } },
    ],
    heroCapacity: 0,  // Can't hold heroes itself
  },
  cafeteria: {
    id: 'cafeteria', name: 'Cafeteria', icon: '🍽️',
    footprint: [3,3],
    doorSide: 'sw',
    description: 'Maintains an internal stock of food and water that houses draw from each tick. Must be restocked from your global supply — manually or via automation.',
    maxLevel: CAFETERIA_MAX_LEVEL,
    baseCost: { wood: 200, stone: 120 },
    buildTime: 30,
    effects: {},
    effectLabel: '🍽️ 15-min food+water reserve at each population tier · Feeds housed population',
    foodCapacityPerLevel:  cafeteriaCapacity(CAFETERIA_MAX_LEVEL),
    waterCapacityPerLevel: cafeteriaCapacity(CAFETERIA_MAX_LEVEL),
    category: 'core', requires: { townhall: 2, well: 1 },
    maxInstances: 1,
    instanceSlots: [
      { index: 0, condition: null },
    ],
    heroCapacity: 0,  // Can't hold heroes itself, but boosts food/water consumption efficiency
  },
  bank: {
    id: 'bank', name: 'Bank', icon: '🏦',
    footprint: [2,2],
    doorSide: 'se',
    description: 'Generates money based on your thriving population. Requires a minimum population to operate.',
    maxLevel: BANK_MAX_LEVEL,
    baseCost: { wood: 400, stone: 300, iron: 100 },
    buildTime: 60,
    effects: { money: 5 },
    effectLabel: '🪙 +5 Money/s per level · Efficiency scales with population fill ratio',
    coinsPerSecondBase: 5,
    category: 'population', requires: { townhall: 2 },
    levelRequirements: bankPopulationLadder(BANK_MAX_LEVEL),
    maxInstances: 2,
    instanceSlots: [
      { index: 0, condition: null },
      { index: 1, condition: { townhall: 12 } },
    ],
    heroCapacity: 1,  // Can hold 1 hero who boosts money production
  },
  barracks: {
    id: 'barracks', name: 'Barracks', icon: '⚔️',
    footprint: [3,3],
    doorSide: 'sw',
    description: 'Squad management building. Each barracks houses one squad. Level determines squad capacity.',
    maxLevel: 30,
    baseCost: { wood: 200, stone: 150 },
    buildTime: 30,
    effects: { squadSlots: true, moreSquads: true },
    effectLabel: 'Each Barracks = 1 squad · Upgrade to increase per-slot unit capacity',
    levelStats: BARRACKS_SLOT_CAPACITY.map(slotCapacity => ({ slotCapacity })),
    category: 'military', requires: null,
    maxInstances: 4,
    instanceSlots: [
      { index: 0, condition: null },
      { index: 1, condition: { townhall: 6 } },
      { index: 2, condition: { townhall: 12 } },
      { index: 3, condition: { townhall: 18 } },
    ],
    // Hero/unit pair rows inside each squad — gated by that barracks's upgrade level
    squadSlots: [
      { index: 0, condition: null },
      { index: 1, condition: { barracks: 4 } },
      { index: 2, condition: { barracks: 9 } },
      { index: 3, condition: { barracks: 15 } },
    ],
    heroCapacity: 4,  // Can hold up to 4 heroes who lead the squad
  },
  archeryrange: {
    id: 'archeryrange', name: 'Archery Range', icon: '🏹',
    footprint: [3,3],
    doorSide: 'se',
    description: 'Train ranged units with superior attack range.',
    maxLevel: HALL_MAX_LEVEL,
    baseCost: { wood: 200, stone: 100 },
    buildTime: 45,
    effects: {},
    effectLabel: '🏹 Trains Ranged units',
    category: 'military', requires: { barracks: 1 },
    trainingSlots: TRAINING_SLOTS(HALL_MAX_LEVEL, 'archeryrange'),
    maxInstances: 1,
    instanceSlots: [{ index: 0, condition: null }],
    heroCapacity: 1,  // Can hold 1 hero
  },
  heroquarters: {
    id: 'heroquarters', name: 'Hero Quarters', icon: '🦸',
    footprint: [4,4],
    doorSide: 's',
    description: 'Recruit legendary heroes to lead your army.',
    maxLevel: 25,
    baseCost: { wood: 400, stone: 320, iron: 80 },
    buildTime: 120,
    effects: { heroSlots: 2 },
    effectLabel: '👑 Hero Quarters',
    category: 'military', requires: { barracks: 4, townhall: 6 },
    maxInstances: 1,
    instanceSlots: [{ index: 0, condition: null }],
    heroCapacity: 1,
  },
  rallypoint: {
    id: 'rallypoint', name: 'Rally Point', icon: '🚩',
    footprint: [2,2],
    doorSide: 'sw',
    description: 'Marshal armies for expeditions across the world map. Higher levels field more simultaneous marches and quicken travel.',
    maxLevel: 10,
    baseCost: { wood: 350, stone: 250, iron: 60 },
    buildTime: 60,
    effects: { marchSlots: true },
    effectLabel: '🚩 Unlocks the World Map',
    levelStats: RALLY_STATS,
    category: 'military', requires: { townhall: 4 },
    maxInstances: 1,
    instanceSlots: [{ index: 0, condition: null }],
    heroCapacity: 1,  // a stationed hero further boosts march speed (Phase 2 stretch)
  },
  workshop: {
    id: 'workshop', name: 'Workshop', icon: '⚙️',
    footprint: [3,3],
    doorSide: 'sw',
    description: 'Research technology and craft powerful equipment. Higher levels unlock more research queue slots.',
    maxLevel: 30,
    baseCost: { wood: 400, stone: 300, iron: 100 },
    buildTime: 90,
    effects: {},
    effectLabel: '🔬 Unlocks Research tab · Lv.2: 2nd research slot · Lv.6: 3rd slot (Premium) · Lv.12: 4th slot (Premium)',
    category: 'core', requires: { townhall: 9 },
    maxInstances: 1,
    instanceSlots: [{ index: 0, condition: null }],
    heroCapacity: 1,  // Can hold 1 hero who boosts research speed
  },
  construction_hall: {
    id: 'construction_hall', name: 'Construction Hall', icon: '🏗️',
    footprint: [3,3],
    doorSide: 's',
    description: 'A dedicated facility for managing large-scale construction projects. Each level unlocks an additional build queue slot.',
    maxLevel: 3,
    capRule: 'none',
    baseCost: { wood: 500, stone: 400 },
    buildTime: 100,
    effects: {},
    effectLabel: '🏗️ Lv.1: 2nd build slot · Lv.2: 3rd slot (Premium) · Lv.3: 4th slot (Premium)',
    category: 'core', requires: { townhall: 2 },
    maxInstances: 1,
    instanceSlots: [{ index: 0, condition: null }],
    heroCapacity: 1,
  },
  infantryhall: {
    id: 'infantryhall', name: 'Infantry Hall', icon: '🗡️',
    footprint: [3,3],
    doorSide: 'sw',
    description: 'Trains and upgrades infantry units. Each level increases training speed.',
    maxLevel: HALL_MAX_LEVEL,
    baseCost: { wood: 300, stone: 200, iron: 50 },
    buildTime: 45,
    effects: {},
    effectLabel: '⚔️ Trains Infantry units',
    category: 'military', requires: { townhall: 2 },
    trainingSlots: TRAINING_SLOTS(HALL_MAX_LEVEL, 'infantryhall'),
    maxInstances: 1,
    instanceSlots: [{ index: 0, condition: null }],
    heroCapacity: 1,
  },
  cavalrystable: {
    id: 'cavalrystable', name: 'Cavalry Stable', icon: '🐴',
    footprint: [3,3],
    doorSide: 'sw',
    description: 'Houses and trains cavalry units. Higher levels unlock stronger cavalry tiers.',
    maxLevel: HALL_MAX_LEVEL,
    baseCost: { wood: 400, stone: 300, iron: 100 },
    buildTime: 80,
    effects: {},
    effectLabel: '🐴 Trains Cavalry units',
    category: 'military', requires: { infantryhall: 4, townhall: 6 },
    trainingSlots: TRAINING_SLOTS(HALL_MAX_LEVEL, 'cavalrystable'),
    maxInstances: 1,
    instanceSlots: [{ index: 0, condition: null }],
    heroCapacity: 1,
  },
  siegeworkshop: {
    id: 'siegeworkshop', name: 'Siege Workshop', icon: '💣',
    footprint: [2,2],
    doorSide: 'se',
    description: 'Crafts powerful siege weapons. Requires a workshop to operate.',
    maxLevel: HALL_MAX_LEVEL,
    baseCost: { wood: 380, stone: 305, iron: 115 },
    buildTime: 120,
    effects: {},
    effectLabel: '💣 Trains Siege units',
    category: 'military', requires: { workshop: 1, townhall: 9 },
    trainingSlots: TRAINING_SLOTS(HALL_MAX_LEVEL, 'siegeworkshop'),
    maxInstances: 1,
    instanceSlots: [{ index: 0, condition: null }],
    heroCapacity: 1,
  },
  magictower: {
    id: 'magictower', name: 'Comms Tower', icon: '📡',
    footprint: [2,2],
    doorSide: 'sw',
    description: 'A fortified communications tower. Coordinates all military operations across the wasteland.',
    maxLevel: 20,
    baseCost: { wood: 370, stone: 307, iron: 123 },
    buildTime: 180,
    effects: {},
    effectLabel: '📡 +5% attack bonus per level · Unlocks advanced tactical research',
    category: 'special', requires: { workshop: 9, townhall: 18 },
    maxInstances: 1,
    instanceSlots: [{ index: 0, condition: null }],
    heroCapacity: 2,
  },
};

applyGeneratedLabels(BUILDINGS_CONFIG);

/**
 * QUEUE_CONFIG — Defines how many queue slots are available for each system
 * and what prerequisites unlock each additional slot.
 * `premium: true` means this slot also requires a premium purchase in addition to buildings.
 */
export const QUEUE_CONFIG = {
  research: [
    { slots: 1, requires: null, premium: false },
    { slots: 2, requires: { workshop: 2 }, premium: false },
    { slots: 3, requires: { workshop: 6 }, premium: true },
    { slots: 4, requires: { workshop: 12 }, premium: true },
  ],
  building: [
    { slots: 1, requires: null, premium: false },
    { slots: 2, requires: { construction_hall: 1 }, premium: false },
    { slots: 3, requires: { construction_hall: 2 }, premium: true },
    { slots: 4, requires: { construction_hall: 3 }, premium: true },
  ],
};

const HQ_UNLOCKS = {
  2: {
    buildings: ['archeryrange', 'infantryhall', 'bank'],
    units:     ['infantry', 'ranged'],
    techs:     ['reinforced_lumber', 'improved_smelting'],
  },
  4:  { buildings: ['cafeteria', 'house'], techs: ['battle_formations', 'rapid_construction'] },
  6:  { buildings: ['heroquarters', 'cavalrystable'], units: ['cavalry'], techs: ['steel_armor'] },
  9:  {
    buildings: ['workshop', 'siegeworkshop'],
    units:     ['siege'],
    techs:     ['advanced_tactics', 'infantry_mastery', 'ranged_mastery'],
  },
  12: { techs: ['cavalry_mastery', 'infrastructure'] },
  15: { techs: ['elite_training', 'siege_mastery'] },
  18: { buildings: ['magictower'] },
};

/** Cumulative HQ benefits at each era's HQ (ERA_HQ); levels between eras interpolate linearly. */
export const HQ_BENEFITS_BY_ERA = [
  { productionBonus: 0,    attackBonus: 0,    defenseBonus: 0,    storageBonus: 0    },
  { productionBonus: 0.02, attackBonus: 0,    defenseBonus: 0,    storageBonus: 0    },
  { productionBonus: 0.06, attackBonus: 0.01, defenseBonus: 0.01, storageBonus: 0    },
  { productionBonus: 0.12, attackBonus: 0.03, defenseBonus: 0.03, storageBonus: 0.05 },
  { productionBonus: 0.20, attackBonus: 0.07, defenseBonus: 0.06, storageBonus: 0.15 },
  { productionBonus: 0.30, attackBonus: 0.13, defenseBonus: 0.11, storageBonus: 0.30 },
  { productionBonus: 0.42, attackBonus: 0.21, defenseBonus: 0.18, storageBonus: 0.50 },
  { productionBonus: 0.57, attackBonus: 0.31, defenseBonus: 0.28, storageBonus: 0.75 },
  { productionBonus: 0.75, attackBonus: 0.44, defenseBonus: 0.41, storageBonus: 1.05 },
  { productionBonus: 0.95, attackBonus: 0.59, defenseBonus: 0.56, storageBonus: 1.40 },
];

const HQ_CAPSTONE_ATTACK = 0.67;
const HQ_CAPSTONE_RATIO = HQ_CAPSTONE_ATTACK / HQ_BENEFITS_BY_ERA.at(-1).attackBonus;

/** Per-level HQ unlocks plus the per-level benefit increment; benefits() sums increments up to the HQ level. */
export const HQ_UNLOCK_TABLE = hqUnlockTable(HQ_UNLOCKS, HQ_BENEFITS_BY_ERA, HQ_CAPSTONE_RATIO);

export const POPULATION_MAX = BUILDINGS_CONFIG.house.maxInstances * BUILDINGS_CONFIG.house.maxLevel * BUILDINGS_CONFIG.house.populationCapacityPerLevel;

/**
 * Economy design parameters — documented constants used when deriving the
 * storageCap arrays and cafeteria capacity arrays above.
 */
export const ECONOMY_PARAMS = {
  fillTargetSec:      { early: 900, mid: 3600, late: 7200 }, // ideal time to fill storage
  storageBuffer:      2.0,    // storageCap ≥ 2× most expensive upgrade accessible at that tier
  cafeteriaBufferSec: 900,    // 15-min food/water reserve at max pop for that cafeteria level
  thCostMultiplier:   1.65,   // replaced old 2.0 — keeps TH10 organically reachable
  shCostMultiplier:   1.6,    // replaced old 1.9
};
