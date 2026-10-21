/**
 * data/tech.js
 * Technology research definitions.
 */

export const TECH_CONFIG = {
  improved_smelting: {
    id: 'improved_smelting', name: 'Improved Smelting', icon: '⚒️',
    description: 'Iron Mine production +25% per level.',
    cost: { money: 500, iron: 100 }, researchTime: 120,
    effects: { ironBonus: 0.25 }, requires: { workshop: 1 }, tier: 1,
    maxLevel: 3, levelCostMultiplier: 1.6, levelTimeMultiplier: 1.5,
    levelRequirements: { 2: { workshop: 2 }, 3: { workshop: 6 } },
    prereqTechs: [],
  },
  reinforced_lumber: {
    id: 'reinforced_lumber', name: 'Reinforced Lumber', icon: '🪵',
    description: 'Lumber Mill production +25% per level.',
    cost: { money: 400, stone: 100 }, researchTime: 90,
    effects: { woodBonus: 0.25 }, requires: { workshop: 1 }, tier: 1,
    maxLevel: 3, levelCostMultiplier: 1.6, levelTimeMultiplier: 1.5,
    levelRequirements: { 2: { workshop: 2 }, 3: { workshop: 4 } },
    prereqTechs: [],
  },
  steel_armor: {
    id: 'steel_armor', name: 'Steel Armor', icon: '🛡️',
    description: 'All unit defense +25 and losses in battle reduced by 15% per level.',
    cost: { money: 800, iron: 200 }, researchTime: 180,
    effects: { defenseBonus: 25, lossReduction: 0.15 }, requires: { workshop: 4 }, tier: 2,
    maxLevel: 4, levelCostMultiplier: 1.6, levelTimeMultiplier: 1.5,
    levelRequirements: { 3: { workshop: 6 }, 4: { workshop: 9 } },
    prereqTechs: ['improved_smelting'],
  },
  advanced_tactics: {
    id: 'advanced_tactics', name: 'Advanced Tactics', icon: '🎯',
    description: 'Improved combat strategies. Army attack +30% in the first wave per level.',
    cost: { money: 1200, iron: 300 }, researchTime: 240,
    effects: { firstWaveBonus: 0.30 },
    requires: { workshop: 9 }, tier: 3,
    maxLevel: 5, levelCostMultiplier: 1.7, levelTimeMultiplier: 1.5,
    levelRequirements: {
      2: { workshop: 12 },
      3: { workshop: 15 },
      4: { workshop: 18 },
      5: { workshop: 18 },
    },
    prereqTechs: ['battle_formations', 'steel_armor'],
  },
  battle_formations: {
    id: 'battle_formations', name: 'Battle Formations', icon: '⚔️',
    description: 'Units attack +20% in the first wave of combat per level.',
    cost: { money: 600, wood: 200 }, researchTime: 150,
    effects: { firstWaveBonus: 0.20 }, requires: { workshop: 2, barracks: 4 }, tier: 2,
    maxLevel: 4, levelCostMultiplier: 1.6, levelTimeMultiplier: 1.5,
    levelRequirements: { 3: { workshop: 4, barracks: 6 }, 4: { workshop: 6, barracks: 9 } },
    prereqTechs: ['improved_smelting'],
  },
  rapid_construction: {
    id: 'rapid_construction', name: 'Rapid Construction', icon: '🏗️',
    description: 'All building construction time reduced by 15% per level (stacks, max 60%).',
    cost: { money: 700, stone: 300 }, researchTime: 200,
    effects: { buildTimeReduction: 0.15 }, requires: { workshop: 2 }, tier: 2,
    maxLevel: 4, levelCostMultiplier: 1.6, levelTimeMultiplier: 1.5,
    levelRequirements: { 3: { workshop: 4 }, 4: { workshop: 6 } },
    prereqTechs: ['reinforced_lumber'],
  },
  infrastructure: {
    id: 'infrastructure', name: 'Infrastructure', icon: '🏘️',
    description: 'Water production +30% and storage capacity increased by 20% per level.',
    cost: { money: 1000, stone: 200 }, researchTime: 220,
    effects: { waterBonus: 0.30, storageCapacityBonus: 0.20 }, requires: { workshop: 6, well: 2 }, tier: 3,
    maxLevel: 5, levelCostMultiplier: 1.7, levelTimeMultiplier: 1.5,
    levelRequirements: {
      2: { workshop: 9, well: 4 },
      3: { workshop: 12, well: 6 },
      4: { workshop: 15, well: 9 },
      5: { workshop: 18, well: 12 },
    },
    prereqTechs: ['rapid_construction'],
  },
  elite_training: {
    id: 'elite_training', name: 'Elite Training', icon: '🏆',
    description: 'All unit HP +20% and attack +10% per level.',
    cost: { money: 1500, food: 200 }, researchTime: 300,
    effects: { hpBonus: 0.20, attackBonus: 0.10 }, requires: { workshop: 12, barracks: 9 }, tier: 3,
    maxLevel: 5, levelCostMultiplier: 1.8, levelTimeMultiplier: 1.6,
    levelRequirements: {
      2: { workshop: 15, barracks: 12 },
      3: { workshop: 18, barracks: 15 },
      4: { workshop: 18, barracks: 15 },
      5: { workshop: 18, barracks: 18 },
    },
    prereqTechs: ['infantry_mastery'],
  },
  infantry_mastery: {
    id: 'infantry_mastery', name: 'Infantry Mastery', icon: '🗡️',
    description: 'Unlocks Infantry tiers 4–10. Each research level unlocks the next 1 tier.',
    cost: { money: 1000, iron: 200 }, researchTime: 200,
    effects: { infantryTierBonus: 1 }, requires: { workshop: 4, infantryhall: 9 }, tier: 2,
    maxLevel: 7, levelCostMultiplier: 1.8, levelTimeMultiplier: 1.6,
    levelRequirements: {
      2: { workshop: 6, infantryhall: 11 }, 3: { workshop: 9, infantryhall: 13 },
      4: { workshop: 12, infantryhall: 15 }, 5: { workshop: 12, infantryhall: 18 },
      6: { workshop: 15, infantryhall: 22 }, 7: { workshop: 18, infantryhall: 26 },
    },
    prereqTechs: [],
  },
  ranged_mastery: {
    id: 'ranged_mastery', name: 'Ranged Mastery', icon: '🏹',
    description: 'Unlocks Ranged tiers 4–10. Each research level unlocks the next 1 tier.',
    cost: { money: 1000, wood: 200 }, researchTime: 200,
    effects: { rangedTierBonus: 1 }, requires: { workshop: 4, archeryrange: 9 }, tier: 2,
    maxLevel: 7, levelCostMultiplier: 1.8, levelTimeMultiplier: 1.6,
    levelRequirements: {
      2: { workshop: 6, archeryrange: 11 }, 3: { workshop: 9, archeryrange: 13 },
      4: { workshop: 12, archeryrange: 15 }, 5: { workshop: 12, archeryrange: 18 },
      6: { workshop: 15, archeryrange: 22 }, 7: { workshop: 18, archeryrange: 26 },
    },
    prereqTechs: [],
  },
  cavalry_mastery: {
    id: 'cavalry_mastery', name: 'Cavalry Mastery', icon: '🐴',
    description: 'Unlocks Cavalry tiers 4–10. Each research level unlocks the next 1 tier.',
    cost: { money: 1200, iron: 300 }, researchTime: 250,
    effects: { cavalryTierBonus: 1 }, requires: { workshop: 6, cavalrystable: 9 }, tier: 3,
    maxLevel: 7, levelCostMultiplier: 1.8, levelTimeMultiplier: 1.6,
    levelRequirements: {
      2: { workshop: 9, cavalrystable: 11 }, 3: { workshop: 9, cavalrystable: 13 },
      4: { workshop: 12, cavalrystable: 15 }, 5: { workshop: 15, cavalrystable: 18 },
      6: { workshop: 18, cavalrystable: 22 }, 7: { workshop: 18, cavalrystable: 26 },
    },
    prereqTechs: ['battle_formations'],
  },
  siege_mastery: {
    id: 'siege_mastery', name: 'Siege Mastery', icon: '💣',
    description: 'Unlocks Siege tiers 4–10. Each research level unlocks the next 1 tier.',
    cost: { money: 1500, iron: 400, wood: 300 }, researchTime: 300,
    effects: { siegeTierBonus: 1 }, requires: { workshop: 9, siegeworkshop: 9 }, tier: 3,
    maxLevel: 7, levelCostMultiplier: 1.9, levelTimeMultiplier: 1.7,
    levelRequirements: {
      2: { workshop: 9, siegeworkshop: 11 }, 3: { workshop: 12, siegeworkshop: 13 },
      4: { workshop: 12, siegeworkshop: 15 }, 5: { workshop: 15, siegeworkshop: 18 },
      6: { workshop: 18, siegeworkshop: 22 }, 7: { workshop: 18, siegeworkshop: 26 },
    },
    prereqTechs: [],
  },
};

/**
 * TECH_BRANCHES — research branches shown as the Level-1 card grid in ResearchUI.
 * Each tech belongs to exactly one branch (see TECH_BRANCH_OF below); drilling into
 * a card opens that branch's interconnected (scroll-down, no pan/zoom) node tree.
 */
export const TECH_BRANCHES = [
  { id: 'economy', label: 'Economy', icon: '🪙' },
  { id: 'combat',  label: 'Combat',  icon: '⚔️' },
  { id: 'units',   label: 'Units',   icon: '🛡️' },
];

const TECH_BRANCH_OF = {
  improved_smelting: 'economy', reinforced_lumber: 'economy', rapid_construction: 'economy', infrastructure: 'economy',
  steel_armor: 'combat', battle_formations: 'combat', advanced_tactics: 'combat',
  infantry_mastery: 'units', ranged_mastery: 'units', cavalry_mastery: 'units', siege_mastery: 'units', elite_training: 'units',
};

// Author the branch onto each tech config so it flows through TechnologyManager.getTechWithState().
for (const [techId, branch] of Object.entries(TECH_BRANCH_OF)) {
  if (TECH_CONFIG[techId]) TECH_CONFIG[techId].branch = branch;
}
