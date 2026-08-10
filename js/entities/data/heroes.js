/** Hero classifications, buff categories, hero definitions, skills, awakening config, gacha tables. */

// Classification is informational — drives effectiveness badges/buffs, never blocks assignment.
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
    id: 'warlord', name: 'Marcus Kestrel', title: 'The Warlord', icon: '⚔️',
    tier: 'legendary',
    classification: 'combat',
    recruitCard: 'card_hero_warlord',
    description: 'A seasoned general who boosts the attack of all nearby melee units.',
    backstory: 'Marcus Kestrel commanded the last coordinated defense before the old world fell, and never stood down after. He rallies whatever survivors will follow him, convinced the wasteland can still be held if enough people refuse to run.',
    stats: { hp: 1500, attack: 80, defense: 40, speed: 1.2 },
    skills: ['charge', 'battle_cry', 'iron_will'],
    aura: { type: 'attack_boost', value: 0.15, buffCategory: 'military' },
    xpPerLevel: 500,
    buildingBonus: { stat: 'training_speed', label: 'Training Speed', buildingType: 'barracks', buffCategory: 'development' },
  },
  archsorceress: {
    id: 'archsorceress', name: 'Vera Sable', title: 'Arch Sorceress', icon: '🔮',
    tier: 'legendary',
    classification: 'tech',
    recruitCard: 'card_hero_archsorceress',
    description: 'Master of arcane magic. Devastating AoE spells.',
    backstory: 'Vera Sable was a research director before the collapse, and she salvaged more than data from her old labs. She bent the ruined world\'s residual energies into something she calls arcane current, and she is still the only person alive who fully understands it.',
    stats: { hp: 900, attack: 160, defense: 12, speed: 0.9 },
    skills: ['fireball', 'arcane_nova', 'mana_shield'],
    aura: { type: 'magic_amplify', value: 0.20, buffCategory: 'military' },
    xpPerLevel: 600,
    buildingBonus: { stat: 'research_speed', label: 'Research Speed', buildingType: 'workshop', buffCategory: 'development' },
  },
  paladin: {
    id: 'paladin', name: 'Aldric Cross', title: 'The Paladin', icon: '✝️',
    tier: 'epic',
    classification: 'combat',
    recruitCard: 'card_hero_paladin',
    description: 'Holy warrior. Reduces casualties and boosts unit defense.',
    backstory: 'Aldric Cross led a convoy of refugees through three collapsed settlements before he found the sector worth defending. He carries a salvaged riot shield like a relic and treats every wall he helps raise as a promise he intends to keep.',
    stats: { hp: 2000, attack: 60, defense: 70, speed: 0.9 },
    skills: ['divine_shield', 'holy_light', 'consecration'],
    aura: { type: 'defense_boost', value: 0.20, buffCategory: 'military' },
    xpPerLevel: 650,
    buildingBonus: { stat: 'defense', label: 'Base Defense', buildingType: 'heroquarters', buffCategory: 'military' },
  },
  junovane: {
    id: 'junovane', name: 'Juno Vane', title: 'The Signal Runner', icon: '📡',
    tier: 'epic',
    classification: 'tech',
    recruitCard: 'card_hero_junovane',
    description: 'Field engineer who splices scavenged tech into working weapons and rigs. Boosts research output wherever she\'s stationed.',
    backstory: 'Juno Vane grew up scavenging dead cities for parts that still hummed with power. She can coax a signal out of anything with a circuit board, and she has never met a workshop she couldn\'t improve by taking it apart first.',
    stats: { hp: 1050, attack: 140, defense: 22, speed: 1.4 },
    skills: ['emp_burst', 'overclock', 'static_ward'],
    aura: { type: 'research_speed', value: 0.18, buffCategory: 'development' },
    xpPerLevel: 600,
    buildingBonus: { stat: 'research_speed', label: 'Research Speed', buildingType: 'workshop', buffCategory: 'development' },
  },
  kaelenthorne: {
    id: 'kaelenthorne', name: 'Kaelen Thorne', title: 'The Wastewalker', icon: '🏹',
    tier: 'normal',
    classification: 'development',
    recruitCard: 'card_hero_kaelenthorne',
    description: 'Ranger and scavenger who knows every safe route through the wastes. Reliable early hire that pulls extra yield from production buildings.',
    backstory: 'Kaelen Thorne has walked further into the dead zones than anyone willing to talk about it. He trades in routes and rumors, and he stations himself wherever a settlement needs someone who already knows what\'s worth digging for.',
    stats: { hp: 1300, attack: 95, defense: 30, speed: 1.6 },
    skills: ['scavenge', 'trail_marks', 'grit'],
    aura: { type: 'crit_chance', value: 0.15, buffCategory: 'military' },
    xpPerLevel: 500,
    buildingBonus: { stat: 'food_production', label: 'Food Output', buildingType: 'farm', buffCategory: 'production' },
  },
  shadowblade: {
    id: 'shadowblade', name: 'Kira Nightwhisper', title: 'The Shadow Blade', icon: '🗡️',
    tier: 'normal',
    classification: 'development',
    recruitCard: 'card_hero_shadowblade',
    description: 'Assassin class hero. High single-target burst and evasion.',
    backstory: 'Kira Nightwhisper survived the early raids by never being where the fighting started. She moved from scavenger to killer out of necessity, and now she trades her blade and her silence to anyone who can keep a base standing.',
    stats: { hp: 1100, attack: 130, defense: 18, speed: 2.0 },
    skills: ['shadowstep', 'poison_blade', 'evasion'],
    aura: { type: 'crit_chance', value: 0.15, buffCategory: 'military' },
    xpPerLevel: 550,
    buildingBonus: { stat: 'iron_production', label: 'Iron Output', buildingType: 'mine', buffCategory: 'production' },
  },
};

// starShardCosts/perStarStatBonus/perStarAuraBonus: shard-only 10-star track.
// @see docs/20-decisions/0025-awakening-config-dual-shape-transition.md (closed)
export const AWAKENING_CONFIG = {
  maxStars: 10,
  starShardCosts: [
    { normal: 1, epic: 2, legendary: 2 },
    { normal: 1, epic: 2, legendary: 2 },
    { normal: 2, epic: 3, legendary: 4 },
    { normal: 2, epic: 3, legendary: 4 },
    { normal: 3, epic: 5, legendary: 6 },
    { normal: 3, epic: 5, legendary: 6 },
    { normal: 4, epic: 6, legendary: 8 },
    { normal: 5, epic: 8, legendary: 10 },
    { normal: 6, epic: 9, legendary: 12 },
    { normal: 8, epic: 12, legendary: 16 },
  ],
  perStarStatBonus: 0.06,
  perStarAuraBonus: 0.04,
  // @see docs/superpowers/specs/2026-07-23-hero-economy-numbers.md §B
  levelScalePerLevel: 0.005,
  skillAuraFracBase: 0.08,
  skillAuraFracPerLevel: 0.012,
};

export const XP_CONFIG = {
  heroLevelCapPerHQLevel: 10,
  passiveXpCapOffset: 20,
  baseXpPerLevel: 100,
  xpPerLevelStep: 20,
  tierMult: { normal: 1.0, epic: 1.25, legendary: 1.5 },
  combatXpPerBattle: 800,
  passiveXpPerProductionTick: 2,
};

export const PITY_CONFIG = {
  newHeroRate: { normal: 0.10, epic: 0.12, legendary: 0.14 },
  softPityFrom: 7,
  softPityBonusPerPull: 0.08,
  stage1HardPityN: 10,
  stage2ShardFloorEveryPulls: 10,
  stage2ShardFloorAmount: 1,
  consolationSplit: {
    normal:    { fragments: 0.75, heroShard: 0.05, xp: 0.20 },
    epic:      { fragments: 0.60, heroShard: 0.20, xp: 0.20 },
    legendary: { fragments: 0.45, heroShard: 0.35, xp: 0.20 },
  },
};

export const EXCHANGE_CONFIG = {
  tierShardsPerHeroShard: 3,
  maxedOverflowToTierShards: 2,
};

// @see docs/superpowers/specs/2026-07-23-hero-economy-numbers.md §F
export const FRAGMENTS_PER_SHARD = { normal: 8, epic: 10, legendary: 12 };
export const SHARDS_TO_UNLOCK    = { normal: 4, epic: 6,  legendary: 8 };

export const PROD_BONUS_CONFIG = {
  base: {
    resourceOutput: 0.15,
    trainingSpeed: 0.12,
    researchSpeed: 0.12,
    buildSpeed: 0.12,
  },
  levelScalePerLevel: 0.01,
  starBonusPerStar: 0.02,
  statEffectMap: {
    bank:       { stat: 'gold_production',  effect: 'money' },
    farm:       { stat: 'food_production',  effect: 'food' },
    lumbermill: { stat: 'wood_production',  effect: 'wood' },
    quarry:     { stat: 'stone_production', effect: 'stone' },
    mine:       { stat: 'iron_production',  effect: 'iron' },
    barracks:   { stat: 'training_speed',   effect: 'trainingSpeed' },
    workshop:   { stat: 'research_speed',   effect: 'researchSpeed' },
  },
};

export const GACHA_CONFIG = {
  fragmentItemId: {
    warlord:       'fragment_warlord',
    archsorceress: 'fragment_archsorceress',
    shadowblade:   'fragment_shadowblade',
    paladin:       'fragment_paladin',
    junovane:      'fragment_junovane',
    kaelenthorne:  'fragment_kaelenthorne',
  },

};
