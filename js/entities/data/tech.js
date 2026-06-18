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
    levelRequirements: { 2: { workshop: 2 }, 3: { workshop: 4 } },
    prereqTechs: [],
  },
  reinforced_lumber: {
    id: 'reinforced_lumber', name: 'Reinforced Lumber', icon: '🪵',
    description: 'Lumber Mill production +25% per level.',
    cost: { money: 400, stone: 100 }, researchTime: 90,
    effects: { woodBonus: 0.25 }, requires: { workshop: 1 }, tier: 1,
    maxLevel: 3, levelCostMultiplier: 1.6, levelTimeMultiplier: 1.5,
    levelRequirements: { 2: { workshop: 2 }, 3: { workshop: 3 } },
    prereqTechs: [],
  },
  steel_armor: {
    id: 'steel_armor', name: 'Steel Armor', icon: '🛡️',
    description: 'All unit defense +25 and losses in battle reduced by 15% per level.',
    cost: { money: 800, iron: 200 }, researchTime: 180,
    effects: { defenseBonus: 25, lossReduction: 0.15 }, requires: { workshop: 3 }, tier: 2,
    maxLevel: 4, levelCostMultiplier: 1.6, levelTimeMultiplier: 1.5,
    levelRequirements: { 3: { workshop: 4 }, 4: { workshop: 5 } },
    prereqTechs: ['improved_smelting'],
  },
  advanced_tactics: {
    id: 'advanced_tactics', name: 'Advanced Tactics', icon: '🎯',
    description: 'Improved combat strategies. Army attack +30% in the first wave per level.',
    cost: { money: 1200, iron: 300 }, researchTime: 240,
    effects: { firstWaveBonus: 0.30 },
    requires: { workshop: 5 }, tier: 3,
    maxLevel: 5, levelCostMultiplier: 1.7, levelTimeMultiplier: 1.5,
    levelRequirements: {
      2: { workshop: 6 },
      3: { workshop: 7 },
      4: { workshop: 8 },
      5: { workshop: 8 },
    },
    prereqTechs: ['battle_formations', 'steel_armor'],
  },
  battle_formations: {
    id: 'battle_formations', name: 'Battle Formations', icon: '⚔️',
    description: 'Units attack +20% in the first wave of combat per level.',
    cost: { money: 600, wood: 200 }, researchTime: 150,
    effects: { firstWaveBonus: 0.20 }, requires: { workshop: 2, barracks: 3 }, tier: 2,
    maxLevel: 4, levelCostMultiplier: 1.6, levelTimeMultiplier: 1.5,
    levelRequirements: { 3: { workshop: 3, barracks: 4 }, 4: { workshop: 4, barracks: 5 } },
    prereqTechs: ['improved_smelting'],
  },
  rapid_construction: {
    id: 'rapid_construction', name: 'Rapid Construction', icon: '🏗️',
    description: 'All building construction time reduced by 15% per level (stacks, max 60%).',
    cost: { money: 700, stone: 300 }, researchTime: 200,
    effects: { buildTimeReduction: 0.15 }, requires: { workshop: 2 }, tier: 2,
    maxLevel: 4, levelCostMultiplier: 1.6, levelTimeMultiplier: 1.5,
    levelRequirements: { 3: { workshop: 3 }, 4: { workshop: 4 } },
    prereqTechs: ['reinforced_lumber'],
  },
  infrastructure: {
    id: 'infrastructure', name: 'Infrastructure', icon: '🏘️',
    description: 'Water production +30% and storage capacity increased by 20% per level.',
    cost: { money: 1000, stone: 200 }, researchTime: 220,
    effects: { waterBonus: 0.30, storageCapacityBonus: 0.20 }, requires: { workshop: 4, well: 2 }, tier: 3,
    maxLevel: 5, levelCostMultiplier: 1.7, levelTimeMultiplier: 1.5,
    levelRequirements: {
      2: { workshop: 5, well: 3 },
      3: { workshop: 6, well: 4 },
      4: { workshop: 7, well: 5 },
      5: { workshop: 8, well: 6 },
    },
    prereqTechs: ['rapid_construction'],
  },
  elite_training: {
    id: 'elite_training', name: 'Elite Training', icon: '🏆',
    description: 'All unit HP +20% and attack +10% per level.',
    cost: { money: 1500, food: 200 }, researchTime: 300,
    effects: { hpBonus: 0.20, attackBonus: 0.10 }, requires: { workshop: 6, barracks: 5 }, tier: 3,
    maxLevel: 5, levelCostMultiplier: 1.8, levelTimeMultiplier: 1.6,
    levelRequirements: {
      2: { workshop: 7, barracks: 6 },
      3: { workshop: 8, barracks: 7 },
      4: { workshop: 8, barracks: 7 },
      5: { workshop: 8, barracks: 8 },
    },
    prereqTechs: ['infantry_mastery'],
  },
  infantry_mastery: {
    id: 'infantry_mastery', name: 'Infantry Mastery', icon: '🗡️',
    description: 'Unlocks Infantry tiers 4–10. Each research level unlocks the next 1 tier.',
    cost: { money: 1000, iron: 200 }, researchTime: 200,
    effects: { infantryTierBonus: 1 }, requires: { workshop: 3, infantryhall: 3 }, tier: 2,
    maxLevel: 7, levelCostMultiplier: 1.8, levelTimeMultiplier: 1.6,
    levelRequirements: {
      2: { workshop: 4, infantryhall: 4 }, 3: { workshop: 5, infantryhall: 5 },
      4: { workshop: 6, infantryhall: 6 }, 5: { workshop: 6, infantryhall: 7 },
      6: { workshop: 7, infantryhall: 8 }, 7: { workshop: 8, infantryhall: 9 },
    },
    prereqTechs: [],
  },
  ranged_mastery: {
    id: 'ranged_mastery', name: 'Ranged Mastery', icon: '🏹',
    description: 'Unlocks Ranged tiers 4–10. Each research level unlocks the next 1 tier.',
    cost: { money: 1000, wood: 200 }, researchTime: 200,
    effects: { rangedTierBonus: 1 }, requires: { workshop: 3, archeryrange: 3 }, tier: 2,
    maxLevel: 7, levelCostMultiplier: 1.8, levelTimeMultiplier: 1.6,
    levelRequirements: {
      2: { workshop: 4, archeryrange: 4 }, 3: { workshop: 5, archeryrange: 5 },
      4: { workshop: 6, archeryrange: 6 }, 5: { workshop: 6, archeryrange: 7 },
      6: { workshop: 7, archeryrange: 8 }, 7: { workshop: 8, archeryrange: 8 },
    },
    prereqTechs: [],
  },
  cavalry_mastery: {
    id: 'cavalry_mastery', name: 'Cavalry Mastery', icon: '🐴',
    description: 'Unlocks Cavalry tiers 4–10. Each research level unlocks the next 1 tier.',
    cost: { money: 1200, iron: 300 }, researchTime: 250,
    effects: { cavalryTierBonus: 1 }, requires: { workshop: 4, cavalrystable: 3 }, tier: 3,
    maxLevel: 7, levelCostMultiplier: 1.8, levelTimeMultiplier: 1.6,
    levelRequirements: {
      2: { workshop: 5, cavalrystable: 4 }, 3: { workshop: 5, cavalrystable: 5 },
      4: { workshop: 6, cavalrystable: 6 }, 5: { workshop: 7, cavalrystable: 7 },
      6: { workshop: 8, cavalrystable: 8 }, 7: { workshop: 8, cavalrystable: 9 },
    },
    prereqTechs: ['battle_formations'],
  },
  siege_mastery: {
    id: 'siege_mastery', name: 'Siege Mastery', icon: '💣',
    description: 'Unlocks Siege tiers 4–10. Each research level unlocks the next 1 tier.',
    cost: { money: 1500, iron: 400, wood: 300 }, researchTime: 300,
    effects: { siegeTierBonus: 1 }, requires: { workshop: 5, siegeworkshop: 3 }, tier: 3,
    maxLevel: 7, levelCostMultiplier: 1.9, levelTimeMultiplier: 1.7,
    levelRequirements: {
      2: { workshop: 5, siegeworkshop: 4 }, 3: { workshop: 6, siegeworkshop: 5 },
      4: { workshop: 6, siegeworkshop: 6 }, 5: { workshop: 7, siegeworkshop: 7 },
      6: { workshop: 8, siegeworkshop: 8 }, 7: { workshop: 8, siegeworkshop: 9 },
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
