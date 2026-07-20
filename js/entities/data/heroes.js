/**
 * data/heroes.js
 * Hero classifications, buff categories, hero definitions,
 * skills, awakening config, and gacha tables.
 */

// ─────────────────────────────────────────────────────────────────────────────
// HERO CLASSIFICATION SYSTEM
// Heroes belong to one class but can be assigned anywhere.
// Classification is informational — it drives effectiveness badges and buff
// categorisation, but never prevents assignment.
// ─────────────────────────────────────────────────────────────────────────────
export const HERO_CLASSIFICATIONS = {
  combat: {
    label: 'Combat',
    icon: '⚔️',
    color: '#ef4444',
    cssClass: 'class-combat',
    description: 'Most effective in Barracks and leading squads into battle.',
    preferredBuildings: ['barracks', 'heroquarters'],
    preferredUnitTypes: ['infantry', 'cavalry'],
  },
  tech: {
    label: 'Tech',
    icon: '🔬',
    color: '#a855f7',
    cssClass: 'class-tech',
    description: 'Most effective in research and technology buildings.',
    preferredBuildings: ['workshop'],
    preferredUnitTypes: ['siege', 'ranged'],
  },
  development: {
    label: 'Development',
    icon: '🏗️',
    color: '#22c55e',
    cssClass: 'class-development',
    description: 'Most effective in production and economy buildings.',
    preferredBuildings: ['mine', 'farm', 'lumbermill', 'quarry', 'bank'],
    preferredUnitTypes: ['ranged', 'infantry'],
  },
};

export const BUFF_CATEGORIES = {
  military:    { label: 'Military',    icon: '⚔️',  color: '#ef4444', description: 'Attack, defense and combat effectiveness bonuses' },
  development: { label: 'Development', icon: '🏗️',  color: '#22c55e', description: 'Training speed and research speed bonuses' },
  production:  { label: 'Production',  icon: '🏭',  color: '#f59e0b', description: 'Resource production rate bonuses' },
};

/** Maps an aura type to its buff category */
export const AURA_BUFF_CATEGORY = {
  attack_boost:    'military',
  magic_amplify:   'military',
  crit_chance:     'military',
  defense_boost:   'military',
  training_speed:  'development',
  research_speed:  'development',
  gold_production: 'production',
};

export const HEROES_CONFIG = {
  warlord: {
    id: 'warlord', name: 'Lord Arcturus', title: 'The Warlord', icon: '⚔️',
    tier: 'common',
    classification: 'combat',
    recruitCard: 'card_hero_warlord',
    description: 'A seasoned general who boosts the attack of all nearby melee units.',
    stats: { hp: 1500, attack: 80, defense: 40, speed: 1.2 },
    skills: ['charge', 'battle_cry', 'iron_will'],
    aura: { type: 'attack_boost', value: 0.15, buffCategory: 'military' },
    xpPerLevel: 500,
    buildingBonus: { stat: 'training_speed', label: 'Training Speed', buildingType: 'barracks', buffCategory: 'development' },
  },
  archsorceress: {
    id: 'archsorceress', name: 'Lyra Dawnveil', title: 'Arch Sorceress', icon: '🔮',
    tier: 'legendary',
    classification: 'tech',
    recruitCard: 'card_hero_archsorceress',
    description: 'Master of arcane magic. Devastating AoE spells.',
    stats: { hp: 900, attack: 160, defense: 12, speed: 0.9 },
    skills: ['fireball', 'arcane_nova', 'mana_shield'],
    aura: { type: 'magic_amplify', value: 0.25, buffCategory: 'military' },
    xpPerLevel: 600,
    buildingBonus: { stat: 'research_speed', label: 'Research Speed', buildingType: 'workshop', buffCategory: 'development' },
  },
  shadowblade: {
    id: 'shadowblade', name: 'Kira Nightwhisper', title: 'The Shadow Blade', icon: '🗡️',
    tier: 'rare',
    classification: 'development',
    recruitCard: 'card_hero_shadowblade',
    description: 'Assassin class hero. High single-target burst and evasion.',
    stats: { hp: 1100, attack: 130, defense: 18, speed: 2.0 },
    skills: ['shadowstep', 'poison_blade', 'evasion'],
    aura: { type: 'crit_chance', value: 0.15, buffCategory: 'military' },
    xpPerLevel: 550,
    buildingBonus: { stat: 'gold_production', label: 'Gold Output', buildingType: 'mine', buffCategory: 'production' },
  },
  paladin: {
    id: 'paladin', name: 'Sir Aldric', title: 'The Paladin', icon: '✝️',
    tier: 'rare',
    classification: 'combat',
    recruitCard: 'card_hero_paladin',
    description: 'Holy warrior. Reduces casualties and boosts unit defense.',
    stats: { hp: 2000, attack: 60, defense: 70, speed: 0.9 },
    skills: ['divine_shield', 'holy_light', 'consecration'],
    aura: { type: 'defense_boost', value: 0.20, buffCategory: 'military' },
    xpPerLevel: 650,
    buildingBonus: { stat: 'defense', label: 'Base Defense', buildingType: 'heroquarters', buffCategory: 'military' },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SKILLS CONFIG
// All hero skills available in the game. Referenced by hero.skills arrays.
// type: 'passive' — always-on stat modifier unlocked at a level threshold.
// type: 'active'  — triggered during combat at specific conditions.
// ─────────────────────────────────────────────────────────────────────────────
export const SKILLS_CONFIG = {
  // Lord Arcturus — Warlord
  charge: {
    id: 'charge', name: 'Charge', type: 'active',
    unlockLevel: 5,
    icon: '💨',
    description: 'On battle start, units deal +20% damage for the first round.',
    effect: { trigger: 'battle_start', attackBonus: 0.20, duration: 1 },
  },
  battle_cry: {
    id: 'battle_cry', name: 'Battle Cry', type: 'passive',
    unlockLevel: 10,
    icon: '📣',
    description: '+10% attack to all squad heroes.',
    effect: { stat: 'attack', value: 0.10, scope: 'squad' },
  },
  iron_will: {
    id: 'iron_will', name: 'Iron Will', type: 'passive',
    unlockLevel: 20,
    icon: '🦾',
    description: 'Reduces troop losses by 8% in every battle.',
    effect: { stat: 'lossReduction', value: 0.08 },
  },

  // Lyra Dawnveil — Arch Sorceress
  fireball: {
    id: 'fireball', name: 'Fireball', type: 'active',
    unlockLevel: 5,
    icon: '🔥',
    description: 'Deals a burst of magic damage at the start of battle (+25% attack, one round).',
    effect: { trigger: 'battle_start', attackBonus: 0.25, duration: 1 },
  },
  arcane_nova: {
    id: 'arcane_nova', name: 'Arcane Nova', type: 'passive',
    unlockLevel: 10,
    icon: '🌀',
    description: '+15% magic amplify aura bonus (stacks with base aura).',
    effect: { stat: 'auraValue', value: 0.15 },
  },
  mana_shield: {
    id: 'mana_shield', name: 'Mana Shield', type: 'passive',
    unlockLevel: 20,
    icon: '🔵',
    description: '+12% defense for all squad units.',
    effect: { stat: 'defense', value: 0.12, scope: 'squad' },
  },

  // Kira Nightwhisper — Shadow Blade
  shadowstep: {
    id: 'shadowstep', name: 'Shadowstep', type: 'active',
    unlockLevel: 5,
    icon: '🌑',
    description: 'First round: hero evades one attack, dealing no losses to own side.',
    effect: { trigger: 'battle_start', evasion: true, duration: 1 },
  },
  poison_blade: {
    id: 'poison_blade', name: 'Poison Blade', type: 'passive',
    unlockLevel: 10,
    icon: '☠️',
    description: '+12% crit chance aura bonus (stacks with base aura).',
    effect: { stat: 'auraValue', value: 0.12 },
  },
  evasion: {
    id: 'evasion', name: 'Evasion', type: 'passive',
    unlockLevel: 20,
    icon: '🌬️',
    description: 'Reduces troop losses by 10% in every battle.',
    effect: { stat: 'lossReduction', value: 0.10 },
  },

  // Sir Aldric — Paladin
  divine_shield: {
    id: 'divine_shield', name: 'Divine Shield', type: 'active',
    unlockLevel: 5,
    icon: '✨',
    description: 'At battle start, reduces incoming damage by 30% for the first round.',
    effect: { trigger: 'battle_start', defenseBonus: 0.30, duration: 1 },
  },
  holy_light: {
    id: 'holy_light', name: 'Holy Light', type: 'passive',
    unlockLevel: 10,
    icon: '☀️',
    description: '+10% defense aura bonus (stacks with base aura).',
    effect: { stat: 'auraValue', value: 0.10 },
  },
  consecration: {
    id: 'consecration', name: 'Consecration', type: 'passive',
    unlockLevel: 20,
    icon: '🕊️',
    description: 'Reduces troop losses by 12% and restores 5% of lost units after battle.',
    effect: { stat: 'lossReduction', value: 0.12, postBattleHeal: 0.05 },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// AWAKENING CONFIG
// Star-based hero awakening. Costs duplicate hero cards OR fragments.
// Each star level grants stat buffs and increases aura value.
// ─────────────────────────────────────────────────────────────────────────────
export const AWAKENING_CONFIG = {
  maxStars: 5,

  /** Cost per star level (1-indexed: index 0 = going from 0→1 star) */
  starCosts: [
    { cards: 1, fragments: { common: 10, rare: 20, legendary: 30 } },
    { cards: 1, fragments: { common: 15, rare: 30, legendary: 45 } },
    { cards: 2, fragments: { common: 20, rare: 40, legendary: 60 } },
    { cards: 2, fragments: { common: 25, rare: 50, legendary: 75 } },
    { cards: 3, fragments: { common: 30, rare: 60, legendary: 90 } },
  ],

  /** Per-star bonus applied on top of base stats */
  perStarBonus: {
    statMultiplier: 0.10,   // +10% base stats per star
    auraValueBonus: 0.05,   // +5% aura value per star (absolute, not relative)
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// GACHA CONFIG
// Weighted probability tables for tiered recruitment scrolls.
// ─────────────────────────────────────────────────────────────────────────────
export const GACHA_CONFIG = {
  /** How many fragments needed to summon each tier hero via fragments alone */
  fragmentsToSummon: { common: 10, rare: 20, legendary: 30 },

  /** Fragment item IDs per hero */
  fragmentItemId: {
    warlord:       'fragment_warlord',
    archsorceress: 'fragment_archsorceress',
    shadowblade:   'fragment_shadowblade',
    paladin:       'fragment_paladin',
  },

  /** Outcome weights per scroll tier. Must sum to 100. */
  outcomeWeights: {
    common:    { resource: 40, xp_item: 30, buff: 15, fragment: 10, hero: 5  },
    rare:      { resource: 30, xp_item: 25, buff: 20, fragment: 17, hero: 8  },
    legendary: { resource: 20, xp_item: 20, buff: 20, fragment: 20, hero: 20 },
  },

  /** When outcome=hero, which tier hero is drawn. Must sum to 100. */
  heroTierWeights: {
    common:    { common: 91, rare: 8,  legendary: 1  },
    rare:      { common: 20, rare: 70, legendary: 10 },
    legendary: { common: 5,  rare: 30, legendary: 65 },
  },

  /** Resource bundle pool drawn randomly when outcome=resource — smallest (T1) tier only */
  resourcePool: ['res_bundle_wood_t1', 'res_bundle_stone_t1', 'res_bundle_food_t1', 'res_bundle_iron_t1', 'res_bundle_water_t1'],

  /** XP bundle pool drawn randomly when outcome=xp_item */
  xpPool: {
    common:    ['xp_bundle_small'],
    rare:      ['xp_bundle_small', 'xp_bundle_medium'],
    legendary: ['xp_bundle_medium', 'xp_bundle_large'],
  },

  /** Buff pool drawn randomly when outcome=buff */
  buffPool: {
    common:    ['buff_prod_sm'],
    rare:      ['buff_prod_sm', 'buff_prod_lg'],
    legendary: ['buff_prod_lg'],
  },
};
