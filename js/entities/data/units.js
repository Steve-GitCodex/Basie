/**
 * data/units.js
 * Unit tier configurations for all trainable unit types.
 */

export const UNITS_CONFIG = {
  infantry: {
    id: 'infantry', name: 'Infantry', icon: '🗡️',
    description: 'Melee fighters. Reliable front-line warriors that scale from basic footmen to legendary archons.',
    category: 'melee', buildingId: 'infantryhall',
    tiers: [
      { tier: 1,  name: 'Footman',   cost: { money: 50,   food: 1 },              trainTime: 10,  stats: { hp: 120,  attack: 14,  defense: 10,  speed: 1.0 } },
      { tier: 2,  name: 'Soldier',   cost: { money: 100,  food: 1, iron: 1 },     trainTime: 15,  stats: { hp: 180,  attack: 20,  defense: 15,  speed: 1.0 }, upgradeCost: { money: 40,   iron: 1  }, upgradeTime: 6  },
      { tier: 3,  name: 'Sergeant',  cost: { money: 160,  food: 2, iron: 2 },     trainTime: 22,  stats: { hp: 260,  attack: 28,  defense: 20,  speed: 1.0 }, upgradeCost: { money: 65,   iron: 1  }, upgradeTime: 8  },
      { tier: 4,  name: 'Knight',    cost: { money: 250,  food: 2, iron: 5 },     trainTime: 35,  stats: { hp: 380,  attack: 40,  defense: 28,  speed: 1.0 }, upgradeCost: { money: 100,  iron: 2  }, upgradeTime: 13, techRequired: 'infantry_mastery' },
      { tier: 5,  name: 'Paladin',   cost: { money: 400,  food: 3, iron: 10 },    trainTime: 50,  stats: { hp: 540,  attack: 56,  defense: 38,  speed: 1.0 }, upgradeCost: { money: 160,  iron: 4  }, upgradeTime: 18, techRequired: 'infantry_mastery' },
      { tier: 6,  name: 'Champion',  cost: { money: 600,  food: 3, iron: 15 },    trainTime: 70,  stats: { hp: 750,  attack: 76,  defense: 50,  speed: 1.0 }, upgradeCost: { money: 240,  iron: 6  }, upgradeTime: 25, techRequired: 'infantry_mastery' },
      { tier: 7,  name: 'Vanguard',  cost: { money: 900,  food: 4, iron: 25 },    trainTime: 95,  stats: { hp: 1020, attack: 102, defense: 66,  speed: 1.0 }, upgradeCost: { money: 360,  iron: 10 }, upgradeTime: 34, techRequired: 'infantry_mastery' },
      { tier: 8,  name: 'Warlord',   cost: { money: 1300, food: 4, iron: 40 },    trainTime: 130, stats: { hp: 1380, attack: 136, defense: 85,  speed: 1.0 }, upgradeCost: { money: 520,  iron: 16 }, upgradeTime: 46, techRequired: 'infantry_mastery' },
      { tier: 9,  name: 'Crusader',  cost: { money: 1900, food: 5, iron: 60 },    trainTime: 175, stats: { hp: 1860, attack: 180, defense: 110, speed: 1.0 }, upgradeCost: { money: 760,  iron: 24 }, upgradeTime: 62, techRequired: 'infantry_mastery' },
      { tier: 10, name: 'Archon',    cost: { money: 2800, food: 6, iron: 90 },    trainTime: 240, stats: { hp: 2500, attack: 240, defense: 145, speed: 1.0 },                                            techRequired: 'infantry_mastery' },
    ],
  },
  ranged: {
    id: 'ranged', name: 'Ranged', icon: '🏹',
    description: 'Ranged attackers. High burst damage at low defense. Train at the Archery Range.',
    category: 'ranged', buildingId: 'archeryrange',
    tiers: [
      { tier: 1,  name: 'Archer',       cost: { money: 80,   wood: 10,  food: 1 },           trainTime: 15,  stats: { hp: 80,   attack: 22,  defense: 5,  speed: 1.2 } },
      { tier: 2,  name: 'Crossbowman',  cost: { money: 140,  wood: 15,  food: 1 },           trainTime: 22,  stats: { hp: 120,  attack: 32,  defense: 8,  speed: 1.2 }, upgradeCost: { money: 56,   wood: 6  },        upgradeTime: 8  },
      { tier: 3,  name: 'Sharpshooter', cost: { money: 220,  wood: 25,  food: 2 },           trainTime: 30,  stats: { hp: 170,  attack: 46,  defense: 11, speed: 1.2 }, upgradeCost: { money: 88,   wood: 10 },        upgradeTime: 11 },
      { tier: 4,  name: 'Ranger',       cost: { money: 340,  wood: 40,  food: 2, iron: 3 },  trainTime: 42,  stats: { hp: 240,  attack: 64,  defense: 15, speed: 1.2 }, upgradeCost: { money: 136,  wood: 16, iron: 1 }, upgradeTime: 15, techRequired: 'ranged_mastery' },
      { tier: 5,  name: 'Strider',      cost: { money: 520,  wood: 60,  food: 3, iron: 6 },  trainTime: 58,  stats: { hp: 330,  attack: 88,  defense: 20, speed: 1.2 }, upgradeCost: { money: 208,  wood: 24, iron: 2 }, upgradeTime: 21, techRequired: 'ranged_mastery' },
      { tier: 6,  name: 'Predator',     cost: { money: 780,  wood: 90,  food: 3, iron: 10 }, trainTime: 78,  stats: { hp: 450,  attack: 118, defense: 26, speed: 1.2 }, upgradeCost: { money: 312,  wood: 36, iron: 4 }, upgradeTime: 28, techRequired: 'ranged_mastery' },
      { tier: 7,  name: 'Sniper',       cost: { money: 1150, wood: 130, food: 4, iron: 18 }, trainTime: 105, stats: { hp: 600,  attack: 156, defense: 33, speed: 1.2 }, upgradeCost: { money: 460,  wood: 52, iron: 7 }, upgradeTime: 37, techRequired: 'ranged_mastery' },
      { tier: 8,  name: 'Hawkeye',      cost: { money: 1650, wood: 190, food: 4, iron: 28 }, trainTime: 140, stats: { hp: 800,  attack: 206, defense: 42, speed: 1.2 }, upgradeCost: { money: 660,  wood: 76, iron: 11 }, upgradeTime: 49, techRequired: 'ranged_mastery' },
      { tier: 9,  name: 'Phantom',      cost: { money: 2400, wood: 280, food: 5, iron: 45 }, trainTime: 185, stats: { hp: 1060, attack: 270, defense: 54, speed: 1.2 }, upgradeCost: { money: 960,  wood: 112, iron: 18 }, upgradeTime: 65, techRequired: 'ranged_mastery' },
      { tier: 10, name: 'Deathbolt',    cost: { money: 3500, wood: 400, food: 6, iron: 70 }, trainTime: 255, stats: { hp: 1400, attack: 356, defense: 68, speed: 1.2 },                                                       techRequired: 'ranged_mastery' },
    ],
  },
  cavalry: {
    id: 'cavalry', name: 'Cavalry', icon: '🐴',
    description: 'Mounted warriors. High speed and attack, but costly to field. Train at the Cavalry Stable.',
    category: 'cavalry', buildingId: 'cavalrystable',
    tiers: [
      { tier: 1,  name: 'Scout',        cost: { money: 150,  food: 2 },             trainTime: 20,  stats: { hp: 200,  attack: 28,  defense: 14,  speed: 1.8 } },
      { tier: 2,  name: 'Horseman',     cost: { money: 240,  food: 2, iron: 3 },    trainTime: 30,  stats: { hp: 300,  attack: 42,  defense: 20,  speed: 1.8 }, upgradeCost: { money: 96,   iron: 1  }, upgradeTime: 11 },
      { tier: 3,  name: 'Lancer',       cost: { money: 370,  food: 3, iron: 6 },    trainTime: 42,  stats: { hp: 440,  attack: 60,  defense: 27,  speed: 1.8 }, upgradeCost: { money: 148,  iron: 2  }, upgradeTime: 15 },
      { tier: 4,  name: 'Knight',       cost: { money: 560,  food: 3, iron: 12 },   trainTime: 60,  stats: { hp: 640,  attack: 84,  defense: 36,  speed: 1.8 }, upgradeCost: { money: 224,  iron: 5  }, upgradeTime: 21, techRequired: 'cavalry_mastery' },
      { tier: 5,  name: 'Cavalier',     cost: { money: 840,  food: 4, iron: 20 },   trainTime: 82,  stats: { hp: 920,  attack: 116, defense: 48,  speed: 1.8 }, upgradeCost: { money: 336,  iron: 8  }, upgradeTime: 29, techRequired: 'cavalry_mastery' },
      { tier: 6,  name: 'Heavy Rider',  cost: { money: 1250, food: 4, iron: 32 },   trainTime: 110, stats: { hp: 1300, attack: 156, defense: 62,  speed: 1.8 }, upgradeCost: { money: 500,  iron: 13 }, upgradeTime: 39, techRequired: 'cavalry_mastery' },
      { tier: 7,  name: 'Templar',      cost: { money: 1850, food: 5, iron: 50 },   trainTime: 145, stats: { hp: 1820, attack: 206, defense: 80,  speed: 1.8 }, upgradeCost: { money: 740,  iron: 20 }, upgradeTime: 51, techRequired: 'cavalry_mastery' },
      { tier: 8,  name: 'Warden',       cost: { money: 2700, food: 5, iron: 78 },   trainTime: 195, stats: { hp: 2500, attack: 270, defense: 102, speed: 1.8 }, upgradeCost: { money: 1080, iron: 31 }, upgradeTime: 69, techRequired: 'cavalry_mastery' },
      { tier: 9,  name: 'Juggernaut',   cost: { money: 3900, food: 6, iron: 120 },  trainTime: 260, stats: { hp: 3400, attack: 352, defense: 130, speed: 1.8 }, upgradeCost: { money: 1560, iron: 48 }, upgradeTime: 91, techRequired: 'cavalry_mastery' },
      { tier: 10, name: 'Dreadnought',  cost: { money: 5600, food: 7, iron: 180 },  trainTime: 350, stats: { hp: 4600, attack: 460, defense: 165, speed: 1.8 },                                           techRequired: 'cavalry_mastery' },
    ],
  },
  siege: {
    id: 'siege', name: 'Siege', icon: '💣',
    description: 'Heavy siege weapons. Devastating damage but slow. Train at the Siege Workshop.',
    category: 'siege', buildingId: 'siegeworkshop',
    tiers: [
      { tier: 1,  name: 'Catapult',        cost: { money: 300,   wood: 50,   iron: 10  }, trainTime: 60,  stats: { hp: 70,   attack: 60,   defense: 4,  speed: 0.7 } },
      { tier: 2,  name: 'Ballista',         cost: { money: 480,   wood: 80,   iron: 18  }, trainTime: 85,  stats: { hp: 100,  attack: 88,   defense: 6,  speed: 0.7 }, upgradeCost: { money: 192,  wood: 32,  iron: 7  }, upgradeTime: 30  },
      { tier: 3,  name: 'Trebuchet',        cost: { money: 740,   wood: 120,  iron: 30  }, trainTime: 115, stats: { hp: 140,  attack: 125,  defense: 8,  speed: 0.7 }, upgradeCost: { money: 296,  wood: 48,  iron: 12 }, upgradeTime: 41  },
      { tier: 4,  name: 'Battering Ram',    cost: { money: 1100,  wood: 180,  iron: 50  }, trainTime: 155, stats: { hp: 200,  attack: 174,  defense: 11, speed: 0.7 }, upgradeCost: { money: 440,  wood: 72,  iron: 20 }, upgradeTime: 55,  techRequired: 'siege_mastery' },
      { tier: 5,  name: 'Bombard',          cost: { money: 1650,  wood: 260,  iron: 80  }, trainTime: 205, stats: { hp: 280,  attack: 240,  defense: 15, speed: 0.7 }, upgradeCost: { money: 660,  wood: 104, iron: 32 }, upgradeTime: 72,  techRequired: 'siege_mastery' },
      { tier: 6,  name: 'Heavy Cannon',     cost: { money: 2400,  wood: 380,  iron: 120 }, trainTime: 270, stats: { hp: 390,  attack: 328,  defense: 20, speed: 0.7 }, upgradeCost: { money: 960,  wood: 152, iron: 48 }, upgradeTime: 95,  techRequired: 'siege_mastery' },
      { tier: 7,  name: 'Siege Tower',      cost: { money: 3500,  wood: 550,  iron: 180 }, trainTime: 355, stats: { hp: 540,  attack: 444,  defense: 26, speed: 0.7 }, upgradeCost: { money: 1400, wood: 220, iron: 72 }, upgradeTime: 125, techRequired: 'siege_mastery' },
      { tier: 8,  name: 'War Engine',       cost: { money: 5000,  wood: 800,  iron: 270 }, trainTime: 460, stats: { hp: 740,  attack: 600,  defense: 34, speed: 0.7 }, upgradeCost: { money: 2000, wood: 320, iron: 108 }, upgradeTime: 161, techRequired: 'siege_mastery' },
      { tier: 9,  name: 'Doomsday Cannon',  cost: { money: 7200,  wood: 1150, iron: 400 }, trainTime: 600, stats: { hp: 1000, attack: 804,  defense: 44, speed: 0.7 }, upgradeCost: { money: 2880, wood: 460, iron: 160 }, upgradeTime: 210, techRequired: 'siege_mastery' },
      { tier: 10, name: 'Obliterator',      cost: { money: 10500, wood: 1700, iron: 600 }, trainTime: 800, stats: { hp: 1400, attack: 1080, defense: 56, speed: 0.7 },                                                           techRequired: 'siege_mastery' },
    ],
  },
};

const TIER_MIN_HALL_LEVEL = [1, 2, 4, 9, 11, 13, 15, 18, 22, 26];
const FIRST_MASTERY_TIER = 4;

function minHallLevel(unitId, tier) {
  const level = TIER_MIN_HALL_LEVEL[tier - 1];
  if (level === undefined) throw new Error(`units: ${unitId} tier ${tier} has no TIER_MIN_HALL_LEVEL entry`);
  return level;
}

export function tierRequirements(unit) {
  return Object.fromEntries(unit.tiers.map(({ tier, techRequired }) => [tier, {
    minBuildingLevel: minHallLevel(unit.id, tier),
    techRequired: techRequired ?? null,
    minTechLevel: techRequired ? tier - FIRST_MASTERY_TIER + 1 : 0,
  }]));
}

/**
 * UNIT_TIER_REQUIREMENTS
 * Per-unit-type, per-tier unlock requirements.
 * Each entry specifies the minimum training building level and the required
 * mastery tech + minimum level needed to access that tier.
 *
 * { unitId: { tier: { minBuildingLevel, techRequired, minTechLevel } } }
 */
export const UNIT_TIER_REQUIREMENTS = Object.fromEntries(
  Object.entries(UNITS_CONFIG).map(([unitId, unit]) => [unitId, tierRequirements(unit)]),
);
