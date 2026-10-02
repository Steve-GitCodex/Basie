/**
 * data/combat.js
 * Monster definitions, campaign stages, and encounter modifiers.
 */

export const MONSTERS_CONFIG = {
  goblin_camp: {
    id: 'goblin_camp', name: 'Scav Warband', icon: '🪓',
    description: 'A disorganized rabble of scavengers. A good first target.',
    difficulty: 1,
    waves: [
      { name: 'Scav Runners', stacks: [
        { name: 'Scav Runners', tier: 1, type: 'infantry', row: 'front', hp: 200, attack: 8, count: 5 },
      ] },
      { name: 'Scav Brawlers', stacks: [
        { name: 'Scav Brawlers', tier: 2, type: 'infantry', row: 'front', hp: 350, attack: 12, count: 8 },
      ] },
    ],
    rewards: { money: 150, wood: 50, xp: 100 },
    maxRewardedWins: 5,
    campaignStage: 1,
  },
  bandit_camp: {
    id: 'bandit_camp', name: 'Raider Pack', icon: '🗡️',
    description: 'Organized raiders preying on nearby settlements. Bring them to justice.',
    difficulty: 2,
    waves: [
      { name: 'Raider Ambush', stacks: [
        { name: 'Raider Scouts', tier: 2, type: 'cavalry', row: 'front', hp: 280, attack: 10, count: 6 },
        { name: 'Raider Gunners', tier: 2, type: 'ranged', row: 'back', hp: 450, attack: 18, count: 5 },
      ] },
    ],
    rewards: { money: 250, wood: 80, xp: 200 },
    maxRewardedWins: 5,
    campaignStage: 2,
  },
  orc_warband: {
    id: 'orc_warband', name: 'Mutant Warband', icon: '🧟',
    description: 'A savage party of mutants. Dangerous in groups.',
    difficulty: 3,
    waves: [
      { name: 'Mutant Pack', stacks: [
        { name: 'Mutant Brutes', tier: 3, type: 'infantry', row: 'front', hp: 500, attack: 20, count: 6 },
        { name: 'Mutant Howlers', tier: 3, type: 'ranged', row: 'back', hp: 300, attack: 35, count: 3, specialAbility: 'heal', abilityValue: 0.2 },
      ] },
      { name: 'Mutant Alpha', stacks: [
        { name: 'Mutant Alpha', tier: 5, type: 'infantry', row: 'front', hp: 1200, attack: 45, count: 1 },
      ] },
    ],
    rewards: { money: 400, stone: 100, xp: 300 },
    maxRewardedWins: 4,
    requires: { townhall: 3 },
    campaignStage: 3,
  },
  troll_bridge: {
    id: 'troll_bridge', name: 'Bridge Marauders', icon: '🧌',
    description: 'A hulking crew blockades the only pass. Their armor takes a beating and keeps coming.',
    difficulty: 4,
    waves: [
      { name: 'Bridge Blockade', stacks: [
        { name: 'Bridge Bruisers', tier: 4, type: 'infantry', row: 'front', hp: 900, attack: 30, count: 4 },
        { name: 'Ironclads', tier: 5, type: 'infantry', row: 'mid', hp: 1400, attack: 50, count: 2, defense: 60, specialAbility: 'heal', abilityValue: 0.25 },
      ] },
      { name: 'Warboss', stacks: [
        { name: 'Warboss', tier: 6, type: 'infantry', row: 'front', hp: 2500, attack: 70, count: 1, specialAbility: 'heal', abilityValue: 0.15 },
      ] },
    ],
    rewards: { money: 600, stone: 150, xp: 480 },
    maxRewardedWins: 4,
    requires: { townhall: 4 },
    campaignStage: 4,
  },
  undead_legion: {
    id: 'undead_legion', name: 'Ghoul Horde', icon: '☣️',
    description: 'Shambling hordes of the infected. They feel no pain and never stop.',
    difficulty: 5,
    waves: [
      { name: 'Ghoul Shamblers', stacks: [
        { name: 'Feral Ghouls', tier: 4, type: 'infantry', row: 'front', hp: 400, attack: 25, count: 15 },
        { name: 'Bloated Walkers', tier: 5, type: 'infantry', row: 'mid', hp: 800, attack: 40, count: 8 },
      ] },
      { name: 'Plague Bearer', stacks: [
        { name: 'Plague Bearer', tier: 6, type: 'ranged', row: 'front', hp: 600, attack: 80, count: 1, specialAbility: 'revive', abilityValue: 0.3 },
      ] },
    ],
    rewards: { money: 800, iron: 100, xp: 600 },
    maxRewardedWins: 3,
    requires: { townhall: 5 },
    campaignStage: 5,
  },
  frost_giant: {
    id: 'frost_giant', name: 'Coldsteel Brutes', icon: '🥶',
    description: 'Armored hulks out of the frozen wastes. Slow but devastating.',
    difficulty: 6,
    waves: [
      { name: 'Frostbitten Host', stacks: [
        { name: 'Frostbitten Thralls', tier: 5, type: 'infantry', row: 'front', hp: 700, attack: 35, count: 10 },
        { name: 'Cryo Medic', tier: 6, type: 'ranged', row: 'back', hp: 500, attack: 60, count: 2, specialAbility: 'heal', abilityValue: 0.2 },
      ] },
      { name: 'Coldsteel Titan', stacks: [
        { name: 'Coldsteel Titan', tier: 7, type: 'infantry', row: 'front', hp: 4000, attack: 120, count: 1 },
      ] },
    ],
    rewards: { money: 1200, stone: 300, iron: 80, xp: 900 },
    maxRewardedWins: 3,
    requires: { townhall: 6 },
    campaignStage: 6,
  },
  demon_gates: {
    id: 'demon_gates', name: 'Meltdown Site', icon: '☢️',
    description: 'A reactor breach has flooded the zone with hostiles. Seal it before all is lost.',
    difficulty: 7,
    waves: [
      { name: 'Meltdown Vanguard', stacks: [
        { name: 'Rad Swarm', tier: 5, type: 'cavalry', row: 'front', hp: 300, attack: 30, count: 20 },
        { name: 'Hazmat Knights', tier: 6, type: 'infantry', row: 'mid', hp: 1500, attack: 70, count: 4 },
      ] },
      { name: 'Reactor Fiend', stacks: [
        { name: 'Reactor Fiend', tier: 8, type: 'siege', row: 'front', hp: 3000, attack: 120, count: 1, specialAbility: 'aoe_blast', abilityValue: 0.5 },
      ] },
    ],
    rewards: { money: 2000, iron: 300, stone: 500, xp: 1200 },
    maxRewardedWins: 3,
    requires: { townhall: 7, heroquarters: 2 },
    campaignStage: 7,
  },
  dragon_lair: {
    id: 'dragon_lair', name: 'Behemoth Nest', icon: '🦂',
    description: 'A monstrous behemoth broods over its kill-ground. Prepare well.',
    difficulty: 8,
    waves: [
      { name: 'Behemoth Spawn', stacks: [
        { name: 'Behemoth Spawn', tier: 7, type: 'cavalry', row: 'front', hp: 600, attack: 50, count: 6 },
      ] },
      { name: 'Elder Behemoth', stacks: [
        { name: 'Elder Behemoth', tier: 9, type: 'cavalry', row: 'front', hp: 8000, attack: 200, count: 1, specialAbility: 'aoe_blast', abilityValue: 0.4 },
      ] },
    ],
    rewards: { money: 5000, iron: 500, xp: 2000 },
    maxRewardedWins: 2,
    requires: { townhall: 7, heroquarters: 3 },
    campaignStage: 8,
  },
  corrupted_arena: {
    id: 'corrupted_arena', name: 'The Blood Pit', icon: '⚔️',
    description: 'A brutal fighting pit where captured warriors are chained to fight until they drop.',
    difficulty: 9,
    waves: [
      { name: 'Pit Gauntlet', stacks: [
        { name: 'Pit Fighters', tier: 8, type: 'infantry', row: 'front', hp: 2000, attack: 100, count: 5 },
        { name: 'Chained Champions', tier: 9, type: 'infantry', row: 'mid', hp: 4000, attack: 180, count: 2, specialAbility: 'revive', abilityValue: 0.4 },
      ] },
      { name: 'Pit Warlord', stacks: [
        { name: 'Pit Warlord', tier: 10, type: 'infantry', row: 'front', hp: 10000, attack: 250, count: 1, specialAbility: 'aoe_blast', abilityValue: 0.45 },
      ] },
    ],
    rewards: { money: 10000, iron: 1000, stone: 1500, xp: 5000 },
    maxRewardedWins: 1,
    requires: { townhall: 9, heroquarters: 4 },
    campaignStage: 9,
  },
  chaos_titan: {
    id: 'chaos_titan', name: 'The Colossus', icon: '🌋',
    description: 'The ultimate threat. A world-ending colossus of pure destruction.',
    difficulty: 10,
    waves: [
      { name: 'Doom Host', stacks: [
        { name: 'Doom Swarm', tier: 8, type: 'cavalry', row: 'front', hp: 1000, attack: 60, count: 20 },
        { name: 'Colossus Limb', tier: 9, type: 'siege', row: 'back', hp: 5000, attack: 150, count: 2 },
      ] },
      { name: 'The Colossus', stacks: [
        { name: 'The Colossus', tier: 10, type: 'infantry', row: 'front', hp: 15000, attack: 300, count: 1, specialAbility: 'aoe_blast', abilityValue: 0.6 },
      ] },
    ],
    rewards: { money: 15000, iron: 2000, xp: 8000 },
    maxRewardedWins: 1,
    requires: { townhall: 10, heroquarters: 5 },
    campaignStage: 10,
  },
};

export const CAMPAIGNS_CONFIG = [
  { stage: 1,  monsterId: 'goblin_camp',     name: 'Scav Territory',        icon: '🪓', requires: null },
  { stage: 2,  monsterId: 'bandit_camp',     name: 'Raider Hideout',        icon: '🗡️', requires: null },
  { stage: 3,  monsterId: 'orc_warband',     name: 'The Mutant Wastes',     icon: '🧟', requires: { townhall: 3 } },
  { stage: 4,  monsterId: 'troll_bridge',    name: 'The Blockade',          icon: '🧌', requires: { townhall: 4 } },
  { stage: 5,  monsterId: 'undead_legion',   name: 'Quarantine Zone',       icon: '☣️', requires: { townhall: 5 } },
  { stage: 6,  monsterId: 'frost_giant',     name: 'Coldsteel Hold',        icon: '🥶', requires: { townhall: 6 } },
  { stage: 7,  monsterId: 'demon_gates',     name: 'Reactor Breach',        icon: '☢️', requires: { townhall: 7 } },
  { stage: 8,  monsterId: 'dragon_lair',     name: 'Behemoth Peak',         icon: '🦂', requires: { townhall: 7, heroquarters: 3 } },
  { stage: 9,  monsterId: 'corrupted_arena', name: 'The Blood Pit',         icon: '⚔️', requires: { townhall: 9, heroquarters: 4 } },
  { stage: 10, monsterId: 'chaos_titan',     name: 'The Final Battle',      icon: '🌋', requires: { townhall: 10 } },
];

/**
 * Difficulty scaling applied on top of encounter modifiers when enemy stacks are built.
 * enemyHpMult / enemyAtkMult scale raw enemy stack stats.
 * resourceRate multiplies all passive resource production rates.
 */
export const DIFFICULTY_MODIFIERS = {
  easy:   { enemyHpMult: 0.7,  enemyAtkMult: 0.7,  resourceRate: 1.3  },
  normal: { enemyHpMult: 1.0,  enemyAtkMult: 1.0,  resourceRate: 1.0  },
  hard:   { enemyHpMult: 1.4,  enemyAtkMult: 1.3,  resourceRate: 0.85 },
};

/**
 * Baseline monster template for Survival mode.
 * Stats escalate by 5% per wave via CombatManager._survivalMult.
 */
export const SURVIVAL_MONSTER = {
  id:          'survival_wave',
  name:        'Survival Wave',
  icon:        '🌊',
  description: 'An endless escalating stream of enemies. How long can you hold?',
  // Stack hp/attack scale by _survivalMult; count grows 2% per survival wave
  baseWave: {
    name: 'Survival Enemies',
    stacks: [{ name: 'Survival Enemies', tier: 2, type: 'infantry', row: 'front', hp: 350, attack: 18, count: 8 }],
  },
  rewards: { money: 80, xp: 50 },
  maxRewardedWins: Infinity,
};

/**
 * Random encounter modifiers that can be rolled when a player enters a stage.
 * waveTransform is applied to each enemy stack before the battle resolves.
 * chance: 0–1 probability that any given stage roll produces this modifier
 *         (they are mutually exclusive; ~25% chance of no modifier total).
 */
export const ENCOUNTER_MODIFIERS = [
  {
    id: 'enraged',
    name: 'Enraged',
    description: 'Enemies are furious — their attack is +30%.',
    icon: '🔴',
    chance: 0.15,
    waveTransform: w => ({ ...w, attack: Math.round(w.attack * 1.3) }),
  },
  {
    id: 'weakened',
    name: 'Weakened',
    description: 'Enemies seem weakened — their HP is −20%.',
    icon: '🟢',
    chance: 0.15,
    waveTransform: w => ({ ...w, hp: Math.round(w.hp * 0.8) }),
  },
  {
    id: 'fortified',
    name: 'Fortified',
    description: 'Enemies have fortified positions — defense +40% but HP −20%.',
    icon: '🛡️',
    chance: 0.15,
    waveTransform: w => ({ ...w, hp: Math.round(w.hp * 0.8), attack: Math.round(w.attack * 1.15) }),
  },
  {
    id: 'fragile',
    name: 'Fragile',
    description: 'Enemies are poorly equipped — HP +20% but they take +30% damage (player attack scales).',
    icon: '💧',
    chance: 0.15,
    waveTransform: w => ({ ...w, hp: Math.round(w.hp * 1.2) }),
    playerAttackMult: 1.3,
  },
  {
    id: 'blessed',
    name: 'Blessed',
    description: 'Your forces feel the divine blessing — player HP +15% this battle.',
    icon: '✨',
    chance: 0.15,
    waveTransform: w => w,
    playerHpMult: 1.15,
  },
];
