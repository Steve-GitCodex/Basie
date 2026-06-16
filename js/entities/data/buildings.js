/**
 * data/buildings.js
 * Building configurations, queue slot definitions, and HQ unlock table.
 */

export const BUILDINGS_CONFIG = {
  townhall: {
    id: 'townhall', name: 'Headquarters (HQ)', icon: '🏛️',
    description: 'The heart of your base. Upgrade to unlock new buildings, increase all caps, and lead a larger population.',
    maxLevel: 10,
    baseCost: { wood: 500, stone: 300 },
    costMultiplier: 1.65, buildTime: 120,
    effects: { unlockBuildings: true },
    storageCap: {
      wood:  [0,  3000,  5500, 10000,  18000,  32000,  57000, 100000, 175000,  305000,  530000],
      stone: [0,  2500,  4500,  8000,  14500,  26000,  46000,  80000, 140000,  245000,  425000],
      iron:  [0,   800,  1200,  2000,   3300,   5500,   9000,  15000,  24000,   39000,   63000],
      food:  [0,   800,  1200,  2000,   3300,   5500,   9000,  15000,  24000,   39000,   63000],
      water: [0,  1000,  1800,  3000,   5000,   8500,  14000,  24000,  40000,   68000,  113000],
      money: [0,  5000, 10000, 20000,  42000,  88000, 185000, 390000, 820000, 1700000, 3600000],
    },
    effectLabel: '📦 Exponential storage cap per level · 🔓 Unlocks buildings',
    category: 'core', requires: null,
    maxInstances: 1,
    instanceSlots: [{ index: 0, condition: null }],
    heroCapacity: 3,  // Can hold up to 3 heroes who provide various bonuses and abilities to the base
  },
  farm: {
    id: 'farm', name: 'Farm', icon: '🌾',
    description: 'Generates food to support a larger army.',
    maxLevel: 10,
    baseCost: { wood: 80, stone: 30 },
    costMultiplier: 1.6, buildTime: 10,
    effects: { food: 0.5 },
    effectLabel: '🌾 +0.5 Food/s per level',
    category: 'production', requires: null,
    heroCapacity: 1,
    maxInstances: 4,
    instanceSlots: [
      { index: 0, condition: null },
      { index: 1, condition: { townhall: 3, farm: 2 } },
      { index: 2, condition: { townhall: 5, farm: 2 } },
      { index: 3, condition: { townhall: 7, farm: 2 } },
    ],
  },
  mine: {
    id: 'mine', name: 'Iron Mine', icon: '⛏️',
    description: 'Extracts iron ore for tools, weapons, and construction.',
    maxLevel: 10,
    baseCost: { wood: 100, stone: 50 },
    costMultiplier: 1.8, buildTime: 15,
    effects: { iron: 0.5 },
    effectLabel: '⚙️ +0.5 Iron/s per level',
    category: 'production', requires: null,
    heroCapacity: 1,
    maxInstances: 3,
    instanceSlots: [
      { index: 0, condition: null },
      { index: 1, condition: { townhall: 4, mine: 2 } },
      { index: 2, condition: { townhall: 6, mine: 2 } },
    ],
  },
  lumbermill: {
    id: 'lumbermill', name: 'Lumber Mill', icon: '🪵',
    description: 'Chops down trees for wood production.',
    maxLevel: 10,
    baseCost: { stone: 80 },
    costMultiplier: 1.7, buildTime: 12,
    effects: { wood: 0.8 },
    effectLabel: '🪵 +0.8 Wood/s per level',
    category: 'production', requires: null,
    heroCapacity: 1,
    maxInstances: 3,
    instanceSlots: [
      { index: 0, condition: null },
      { index: 1, condition: { townhall: 3, lumbermill: 2 } },
      { index: 2, condition: { townhall: 5, lumbermill: 2 } },
    ],
  },
  quarry: {
    id: 'quarry', name: 'Stone Quarry', icon: '🪨',
    description: 'Mines stone for construction.',
    maxLevel: 10,
    baseCost: { wood: 100, iron: 20 },
    costMultiplier: 1.8, buildTime: 20,
    effects: { stone: 0.7 },
    effectLabel: '🪨 +0.7 Stone/s per level',
    category: 'production', requires: null,
    heroCapacity: 1,
    maxInstances: 3,
    instanceSlots: [
      { index: 0, condition: null },
      { index: 1, condition: { townhall: 4, quarry: 2 } },
      { index: 2, condition: { townhall: 6, quarry: 2 } },
    ],
  },
  storehouse: {
    id: 'storehouse', name: 'Storehouse', icon: '🏚️',
    description: 'Expands your resource storage. Each level significantly increases all caps.',
    maxLevel: 10,
    baseCost: { wood: 300, stone: 200 },
    costMultiplier: 1.6, buildTime: 25,
    effects: {},
    storageCap: {
      wood:  [0,  5500,  9000, 15000,  25000,  42000,  70000, 117000, 195000,  325000,  545000],
      stone: [0,  4500,  7000, 12000,  20000,  33000,  55000,  92000, 153000,  255000,  425000],
      iron:  [0,  2200,  3500,  5700,   9200,  15000,  24000,  39000,  63000,  102000,  165000],
      food:  [0,  2200,  3500,  5700,   9200,  15000,  24000,  39000,  63000,  102000,  165000],
      water: [0,  2500,  4000,  6500,  10500,  17000,  27500,  45000,  73000,  119000,  193000],
      money: [0,  8000, 17000, 35000,  73000, 152000, 318000, 667000, 1400000, 2930000, 6150000],
    },
    effectLabel: '📦 Exponential storage cap per level',
    category: 'core', requires: null,
    maxInstances: 2,
    instanceSlots: [
      { index: 0, condition: null },
      { index: 1, condition: { townhall: 5 } },
    ],
    heroCapacity: 0,  // Can't hold heroes itself, but boosts storage efficiency
  },
  well: {
    id: 'well', name: 'Well', icon: '🪣',
    description: 'Draws fresh water from underground springs.',
    maxLevel: 8,
    baseCost: { stone: 80, iron: 20 },
    costMultiplier: 1.7, buildTime: 15,
    effects: { water: 0.6 },
    effectLabel: '💧 +0.6 Water/s per level',
    category: 'production', requires: null,
    maxInstances: 3,
    instanceSlots: [
      { index: 0, condition: null },
      { index: 1, condition: { townhall: 3 } },
      { index: 2, condition: { townhall: 6 } },
    ],
    heroCapacity: 1,  // Can hold 1 hero
  },
  house: {
    id: 'house', name: 'House', icon: '🏠',
    description: 'Provides housing for your population.',
    maxLevel: 10,
    baseCost: { wood: 120, stone: 80 },
    costMultiplier: 1.6, buildTime: 20,
    effects: {},
    effectLabel: '👥 +10 population capacity per level',
    populationCapacityPerLevel: 10,
    category: 'population', requires: { townhall: 1, cafeteria: 1 },
    levelRequirements: {
      3: { cafeteria: 2 }, 4: { cafeteria: 2 },
      5: { cafeteria: 3 }, 6: { cafeteria: 3 },
      7: { cafeteria: 5 }, 8: { cafeteria: 5 },
      9: { cafeteria: 7 }, 10: { cafeteria: 7 },
    },
    maxInstances: 6,
    instanceSlots: [
      { index: 0, condition: null },
      { index: 1, condition: { townhall: 2 } },
      { index: 2, condition: { townhall: 3 } },
      { index: 3, condition: { townhall: 5 } },
      { index: 4, condition: { townhall: 7 } },
      { index: 5, condition: { townhall: 9 } },
    ],
    heroCapacity: 0,  // Can't hold heroes itself
  },
  cafeteria: {
    id: 'cafeteria', name: 'Cafeteria', icon: '🍽️',
    description: 'Maintains an internal stock of food and water that houses draw from each tick. Must be restocked from your global supply — manually or via automation.',
    maxLevel: 8,
    baseCost: { wood: 200, stone: 120 },
    costMultiplier: 1.8, buildTime: 30,
    effects: {},
    effectLabel: '🍽️ 15-min food+water reserve at each population tier · Feeds housed population',
    foodCapacityPerLevel:  [0, 10800, 21600, 32400, 39000, 43200, 51600, 54000, 62000],
    waterCapacityPerLevel: [0, 10800, 21600, 32400, 39000, 43200, 51600, 54000, 62000],
    category: 'core', requires: { townhall: 2, well: 1 },
    maxInstances: 1,
    instanceSlots: [
      { index: 0, condition: null },
    ],
    heroCapacity: 0,  // Can't hold heroes itself, but boosts food/water consumption efficiency
  },
  bank: {
    id: 'bank', name: 'Bank', icon: '🏦',
    description: 'Generates money based on your thriving population. Requires a minimum population to operate.',
    maxLevel: 8,
    baseCost: { wood: 400, stone: 300, iron: 100 },
    costMultiplier: 2.0, buildTime: 60,
    effects: { money: 5 },
    effectLabel: '🪙 +5 Money/s per level · Efficiency scales with population fill ratio · Higher levels require more residents',
    coinsPerSecondBase: 5,
    category: 'population', requires: { townhall: 3 },
    levelRequirements: {
      2: { population: 10 },   3: { population: 20 },
      4: { population: 50 },  5: { population: 100 },
      6: { population: 180 }, 7: { population: 300 },
      8: { population: 450 },
    },
    maxInstances: 2,
    instanceSlots: [
      { index: 0, condition: null },
      { index: 1, condition: { townhall: 6 } },
    ],
    heroCapacity: 1,  // Can hold 1 hero who boosts money production
  },
  barracks: {
    id: 'barracks', name: 'Barracks', icon: '⚔️',
    description: 'Squad management building. Each barracks houses one squad. Level determines squad capacity.',
    maxLevel: 8,
    baseCost: { wood: 200, stone: 150 },
    costMultiplier: 1.9, buildTime: 30,
    effects: { squadSlots: true, moreSquads: true },
    effectLabel: 'Each Barracks = 1 squad · Upgrade to increase per-slot unit capacity and unlock more slots (Lv.3 → 2nd · Lv.5 → 3rd · Lv.7 → 4th) · Build more Barracks via HQ (Lv.4 / 6 / 8)',
    levelStats: [
      { slotCapacity:   200 }, // Lv.1 — 1 slot open
      { slotCapacity:   500 }, // Lv.2
      { slotCapacity:   800 }, // Lv.3 — 2nd slot opens
      { slotCapacity: 1200 }, // Lv.4
      { slotCapacity: 1700 }, // Lv.5 — 3rd slot opens
      { slotCapacity: 2300 }, // Lv.6
      { slotCapacity: 3000 }, // Lv.7 — 4th slot opens
      { slotCapacity: 4000 }, // Lv.8
    ],
    category: 'military', requires: null,
    maxInstances: 4,
    instanceSlots: [
      { index: 0, condition: null },
      { index: 1, condition: { townhall: 4 } },
      { index: 2, condition: { townhall: 6 } },
      { index: 3, condition: { townhall: 8 } },
    ],
    // Hero/unit pair rows inside each squad — gated by that barracks's upgrade level
    squadSlots: [
      { index: 0, condition: null },
      { index: 1, condition: { barracks: 3 } },
      { index: 2, condition: { barracks: 5 } },
      { index: 3, condition: { barracks: 7 } },
    ],
    heroCapacity: 4,  // Can hold up to 4 heroes who lead the squad
  },
  archeryrange: {
    id: 'archeryrange', name: 'Archery Range', icon: '🏹',
    description: 'Train ranged units with superior attack range.',
    maxLevel: 10,
    baseCost: { wood: 200, stone: 100 },
    costMultiplier: 1.9, buildTime: 45,
    effects: {},
    effectLabel: '🏹 Trains Ranged units · +5% training speed per level · Lv.3: 2 training slots · Lv.6: 3 slots · Lv.9: 4 slots',
    category: 'military', requires: { barracks: 1 },
    trainingSlots: [
      { concurrentSlots: 1, trainTimeMultiplier: 1.00, maxTrainableTier: 1,  maxBatchSize:  25 }, // Lv.1
      { concurrentSlots: 1, trainTimeMultiplier: 1.00, maxTrainableTier: 2,  maxBatchSize:  50 }, // Lv.2
      { concurrentSlots: 2, trainTimeMultiplier: 0.90, maxTrainableTier: 3,  maxBatchSize:  75 }, // Lv.3
      { concurrentSlots: 2, trainTimeMultiplier: 0.90, maxTrainableTier: 4,  maxBatchSize: 100 }, // Lv.4
      { concurrentSlots: 2, trainTimeMultiplier: 0.90, maxTrainableTier: 5,  maxBatchSize: 125 }, // Lv.5
      { concurrentSlots: 3, trainTimeMultiplier: 0.80, maxTrainableTier: 6,  maxBatchSize: 150 }, // Lv.6
      { concurrentSlots: 3, trainTimeMultiplier: 0.80, maxTrainableTier: 7,  maxBatchSize: 175 }, // Lv.7
      { concurrentSlots: 3, trainTimeMultiplier: 0.80, maxTrainableTier: 8,  maxBatchSize: 200 }, // Lv.8
      { concurrentSlots: 4, trainTimeMultiplier: 0.70, maxTrainableTier: 9,  maxBatchSize: 225 }, // Lv.9
      { concurrentSlots: 4, trainTimeMultiplier: 0.70, maxTrainableTier: 10, maxBatchSize: 250 }, // Lv.10
    ],
    maxInstances: 1,
    instanceSlots: [{ index: 0, condition: null }],
    heroCapacity: 1,  // Can hold 1 hero
  },
  heroquarters: {
    id: 'heroquarters', name: 'Hero Quarters', icon: '🦸',
    description: 'Recruit legendary heroes to lead your army.',
    maxLevel: 10,
    baseCost: { wood: 500, stone: 400, iron: 100 },
    costMultiplier: 2.5, buildTime: 120,
    effects: { heroSlots: 5 },
    effectLabel: '👑 +5 hero slots per level.',
    category: 'military', requires: { barracks: 3, townhall: 4 },
    maxInstances: 1,
    instanceSlots: [{ index: 0, condition: null }],
    heroCapacity: 0,  // can't hold heroes itself, but unlocks hero recruitment and provides hero slots for other buildings
  },
  workshop: {
    id: 'workshop', name: 'Workshop', icon: '⚙️',
    description: 'Research technology and craft powerful equipment. Higher levels unlock more research queue slots.',
    maxLevel: 8,
    baseCost: { wood: 400, stone: 300, iron: 100 },
    costMultiplier: 2.1, buildTime: 90,
    effects: {},
    effectLabel: '🔬 Unlocks Research tab · Lv.2: 2nd research slot · Lv.4: 3rd slot (Premium) · Lv.6: 4th slot (Premium)',
    category: 'core', requires: { townhall: 5 },
    maxInstances: 1,
    instanceSlots: [{ index: 0, condition: null }],
    heroCapacity: 1,  // Can hold 1 hero who boosts research speed
  },
  construction_hall: {
    id: 'construction_hall', name: 'Construction Hall', icon: '🏗️',
    description: 'A dedicated facility for managing large-scale construction projects. Each level unlocks an additional build queue slot.',
    maxLevel: 3,
    baseCost: { wood: 500, stone: 400 },
    costMultiplier: 2.2, buildTime: 100,
    effects: {},
    effectLabel: '🏗️ Lv.1: 2nd build slot · Lv.2: 3rd slot (Premium) · Lv.3: 4th slot (Premium)',
    category: 'core', requires: { townhall: 2 },
    maxInstances: 1,
    instanceSlots: [{ index: 0, condition: null }],
    heroCapacity: 0,  // Can't hold heroes, but unlocks more build queues for faster construction
  },
  infantryhall: {
    id: 'infantryhall', name: 'Infantry Hall', icon: '🗡️',
    description: 'Trains and upgrades infantry units. Each level increases training speed.',
    maxLevel: 10,
    baseCost: { wood: 300, stone: 200, iron: 50 },
    costMultiplier: 2.0, buildTime: 45,
    effects: {},
    effectLabel: '⚔️ Trains Infantry units · +5% training speed per level · Lv.3: 2 training slots · Lv.6: 3 slots · Lv.9: 4 slots',
    category: 'military', requires: { townhall: 2 },
    trainingSlots: [
      { concurrentSlots: 1, trainTimeMultiplier: 1.00, maxTrainableTier: 1, maxBatchSize:  25 }, // Lv.1
      { concurrentSlots: 1, trainTimeMultiplier: 1.00, maxTrainableTier: 2, maxBatchSize:  50 }, // Lv.2
      { concurrentSlots: 2, trainTimeMultiplier: 0.90, maxTrainableTier: 3, maxBatchSize:  75 }, // Lv.3
      { concurrentSlots: 2, trainTimeMultiplier: 0.90, maxTrainableTier: 4, maxBatchSize: 100 }, // Lv.4
      { concurrentSlots: 2, trainTimeMultiplier: 0.90, maxTrainableTier: 5, maxBatchSize: 125 }, // Lv.5
      { concurrentSlots: 3, trainTimeMultiplier: 0.80, maxTrainableTier: 6, maxBatchSize: 150 }, // Lv.6
      { concurrentSlots: 3, trainTimeMultiplier: 0.80, maxTrainableTier: 7, maxBatchSize: 175 }, // Lv.7
      { concurrentSlots: 3, trainTimeMultiplier: 0.80, maxTrainableTier: 8, maxBatchSize: 200 }, // Lv.8
      { concurrentSlots: 4, trainTimeMultiplier: 0.70, maxTrainableTier: 9, maxBatchSize: 225 }, // Lv.9
      { concurrentSlots: 4, trainTimeMultiplier: 0.70, maxTrainableTier:10, maxBatchSize: 250 }, // Lv.10
    ],
    maxInstances: 1,
    instanceSlots: [{ index: 0, condition: null }],
    heroCapacity: 1,
  },
  cavalrystable: {
    id: 'cavalrystable', name: 'Cavalry Stable', icon: '🐴',
    description: 'Houses and trains cavalry units. Higher levels unlock stronger cavalry tiers.',
    maxLevel: 10,
    baseCost: { wood: 400, stone: 300, iron: 100 },
    costMultiplier: 2.1, buildTime: 80,
    effects: {},
    effectLabel: '🐴 Trains Cavalry units · +5% training speed per level · Lv.3: 2 training slots · Lv.6: 3 slots · Lv.9: 4 slots',
    category: 'military', requires: { infantryhall: 3, townhall: 4 },
    trainingSlots: [
      { concurrentSlots: 1, trainTimeMultiplier: 1.00, maxTrainableTier: 1, maxBatchSize:  25 }, // Lv.1
      { concurrentSlots: 1, trainTimeMultiplier: 1.00, maxTrainableTier: 2, maxBatchSize:  50 }, // Lv.2
      { concurrentSlots: 2, trainTimeMultiplier: 0.90, maxTrainableTier: 3, maxBatchSize:  75 }, // Lv.3
      { concurrentSlots: 2, trainTimeMultiplier: 0.90, maxTrainableTier: 4, maxBatchSize: 100 }, // Lv.4
      { concurrentSlots: 2, trainTimeMultiplier: 0.90, maxTrainableTier: 5, maxBatchSize: 125 }, // Lv.5
      { concurrentSlots: 3, trainTimeMultiplier: 0.80, maxTrainableTier: 6, maxBatchSize: 150 }, // Lv.6
      { concurrentSlots: 3, trainTimeMultiplier: 0.80, maxTrainableTier: 7, maxBatchSize: 175 }, // Lv.7
      { concurrentSlots: 3, trainTimeMultiplier: 0.80, maxTrainableTier: 8, maxBatchSize: 200 }, // Lv.8
      { concurrentSlots: 4, trainTimeMultiplier: 0.70, maxTrainableTier: 9, maxBatchSize: 225 }, // Lv.9
      { concurrentSlots: 4, trainTimeMultiplier: 0.70, maxTrainableTier:10, maxBatchSize: 250 }, // Lv.10
    ],
    maxInstances: 1,
    instanceSlots: [{ index: 0, condition: null }],
    heroCapacity: 1,
  },
  siegeworkshop: {
    id: 'siegeworkshop', name: 'Siege Workshop', icon: '💣',
    description: 'Crafts powerful siege weapons. Requires a workshop to operate.',
    maxLevel: 10,
    baseCost: { wood: 500, stone: 400, iron: 150 },
    costMultiplier: 2.2, buildTime: 120,
    effects: {},
    effectLabel: '💣 Trains Siege units · +5% training speed per level · Lv.3: 2 training slots · Lv.6: 3 slots · Lv.9: 4 slots',
    category: 'military', requires: { workshop: 1, townhall: 5 },
    trainingSlots: [
      { concurrentSlots: 1, trainTimeMultiplier: 1.00, maxTrainableTier: 1, maxBatchSize:  25 }, // Lv.1
      { concurrentSlots: 1, trainTimeMultiplier: 1.00, maxTrainableTier: 2, maxBatchSize:  50 }, // Lv.2
      { concurrentSlots: 2, trainTimeMultiplier: 0.90, maxTrainableTier: 3, maxBatchSize:  75 }, // Lv.3
      { concurrentSlots: 2, trainTimeMultiplier: 0.90, maxTrainableTier: 4, maxBatchSize: 100 }, // Lv.4
      { concurrentSlots: 2, trainTimeMultiplier: 0.90, maxTrainableTier: 5, maxBatchSize: 125 }, // Lv.5
      { concurrentSlots: 3, trainTimeMultiplier: 0.80, maxTrainableTier: 6, maxBatchSize: 150 }, // Lv.6
      { concurrentSlots: 3, trainTimeMultiplier: 0.80, maxTrainableTier: 7, maxBatchSize: 175 }, // Lv.7
      { concurrentSlots: 3, trainTimeMultiplier: 0.80, maxTrainableTier: 8, maxBatchSize: 200 }, // Lv.8
      { concurrentSlots: 4, trainTimeMultiplier: 0.70, maxTrainableTier: 9, maxBatchSize: 225 }, // Lv.9
      { concurrentSlots: 4, trainTimeMultiplier: 0.70, maxTrainableTier:10, maxBatchSize: 250 }, // Lv.10
    ],
    maxInstances: 1,
    instanceSlots: [{ index: 0, condition: null }],
    heroCapacity: 1,
  },
  magictower: {
    id: 'magictower', name: 'Magic Tower', icon: '🔮',
    description: 'A tower of arcane power. Empowers all military operations with magical energy.',
    maxLevel: 8,
    baseCost: { wood: 600, stone: 500, iron: 200 },
    costMultiplier: 2.5, buildTime: 180,
    effects: {},
    effectLabel: '🔮 +5% attack bonus per level · Unlocks advanced magical research',
    category: 'special', requires: { workshop: 5, townhall: 8 },
    maxInstances: 1,
    instanceSlots: [{ index: 0, condition: null }],
    heroCapacity: 2,
  },
};

/**
 * QUEUE_CONFIG — Defines how many queue slots are available for each system
 * and what prerequisites unlock each additional slot.
 * `premium: true` means this slot also requires a premium purchase in addition to buildings.
 */
export const QUEUE_CONFIG = {
  research: [
    { slots: 1, requires: null, premium: false },
    { slots: 2, requires: { workshop: 2 }, premium: false },
    { slots: 3, requires: { workshop: 4 }, premium: true },
    { slots: 4, requires: { workshop: 6 }, premium: true },
  ],
  building: [
    { slots: 1, requires: null, premium: false },
    { slots: 2, requires: { construction_hall: 1 }, premium: false },
    { slots: 3, requires: { construction_hall: 2 }, premium: true },
    { slots: 4, requires: { construction_hall: 3 }, premium: true },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// HQ UNLOCK TABLE
// Defines what buildings, unit types, and technologies become available as the
// Headquarters (townhall) is upgraded. Also provides per-level combat/production
// bonuses that apply globally to the player's base.
// ─────────────────────────────────────────────────────────────────────────────
export const HQ_UNLOCK_TABLE = {
  2: {
    buildings: ['archeryrange', 'infantryhall', 'bank'],
    units:     ['infantry', 'ranged'],
    techs:     ['reinforced_lumber', 'improved_smelting'],
    benefits:  { productionBonus: 0.02, attackBonus: 0.00, defenseBonus: 0.00, storageBonus: 0.00 },
  },
  3: {
    buildings: ['cafeteria', 'house'],
    units:     [],
    techs:     ['battle_formations', 'rapid_construction'],
    benefits:  { productionBonus: 0.04, attackBonus: 0.01, defenseBonus: 0.01, storageBonus: 0.00 },
  },
  4: {
    buildings: ['heroquarters', 'cavalrystable'],
    units:     ['cavalry'],
    techs:     ['steel_armor'],
    benefits:  { productionBonus: 0.06, attackBonus: 0.02, defenseBonus: 0.02, storageBonus: 0.05 },
  },
  5: {
    buildings: ['workshop', 'siegeworkshop'],
    units:     ['siege'],
    techs:     ['advanced_tactics', 'infantry_mastery', 'ranged_mastery'],
    benefits:  { productionBonus: 0.08, attackBonus: 0.04, defenseBonus: 0.03, storageBonus: 0.10 },
  },
  6: {
    buildings: [],
    units:     [],
    techs:     ['cavalry_mastery', 'infrastructure'],
    benefits:  { productionBonus: 0.10, attackBonus: 0.06, defenseBonus: 0.05, storageBonus: 0.15 },
  },
  7: {
    buildings: [],
    units:     [],
    techs:     ['elite_training', 'siege_mastery'],
    benefits:  { productionBonus: 0.12, attackBonus: 0.08, defenseBonus: 0.07, storageBonus: 0.20 },
  },
  8: {
    buildings: ['magictower'],
    units:     [],
    techs:     [],
    benefits:  { productionBonus: 0.15, attackBonus: 0.10, defenseBonus: 0.10, storageBonus: 0.25 },
  },
  9: {
    buildings: [],
    units:     [],
    techs:     [],
    benefits:  { productionBonus: 0.18, attackBonus: 0.13, defenseBonus: 0.13, storageBonus: 0.30 },
  },
  10: {
    buildings: [],
    units:     [],
    techs:     [],
    benefits:  { productionBonus: 0.20, attackBonus: 0.15, defenseBonus: 0.15, storageBonus: 0.35 },
  },
};

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
