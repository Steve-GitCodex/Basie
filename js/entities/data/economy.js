/**
 * data/economy.js
 * Inventory item definitions and shop configuration.
 */

// ─────────────────────────────────────────────────────────────────────────────
// INVENTORY ITEMS
// Items that can be held in the player inventory. Hero cards are the primary
// recruitment mechanism. XP bundles are purchasable from the shop (coming soon).
// ─────────────────────────────────────────────────────────────────────────────
export const INVENTORY_ITEMS = {
  // ── Specific Hero Cards ──────────────────────────────────────────────────
  card_hero_warlord: {
    id: 'card_hero_warlord', type: 'hero_card',
    name: 'Hero Card: Lord Arcturus', icon: '⚔️',
    description: 'Recruit the legendary Warlord, Lord Arcturus.',
    rarity: 'common', targetHeroId: 'warlord',
  },
  card_hero_archsorceress: {
    id: 'card_hero_archsorceress', type: 'hero_card',
    name: 'Hero Card: Lyra Dawnveil', icon: '🔮',
    description: 'Recruit the legendary Arch Sorceress, Lyra Dawnveil.',
    rarity: 'legendary', targetHeroId: 'archsorceress',
  },
  card_hero_shadowblade: {
    id: 'card_hero_shadowblade', type: 'hero_card',
    name: 'Hero Card: Kira Nightwhisper', icon: '🗡️',
    description: 'Recruit the elusive Shadow Blade, Kira Nightwhisper.',
    rarity: 'rare', targetHeroId: 'shadowblade',
  },
  card_hero_paladin: {
    id: 'card_hero_paladin', type: 'hero_card',
    name: 'Hero Card: Sir Aldric', icon: '✝️',
    description: 'Recruit the noble Paladin, Sir Aldric.',
    rarity: 'rare', targetHeroId: 'paladin',
  },
  // ── Universal Hero Cards ─────────────────────────────────────────────────
  card_common: {
    id: 'card_common', type: 'hero_card_universal',
    name: 'Common Hero Card', icon: '🃏',
    description: 'Recruits a random unowned Common-tier hero.',
    rarity: 'common', targetTier: 'common',
  },
  card_rare: {
    id: 'card_rare', type: 'hero_card_universal',
    name: 'Rare Hero Card', icon: '🎴',
    description: 'Recruits a random unowned Rare-tier hero.',
    rarity: 'rare', targetTier: 'rare',
  },
  card_legendary: {
    id: 'card_legendary', type: 'hero_card_universal',
    name: 'Legendary Hero Card', icon: '👑',
    description: 'Recruits a random unowned Legendary-tier hero.',
    rarity: 'legendary', targetTier: 'legendary',
  },
  // ── XP Bundles ───────────────────────────────────────────────────────────
  xp_bundle_small: {
    id: 'xp_bundle_small', type: 'xp_bundle',
    name: 'Tome of Experience (Small)', icon: '📖',
    description: 'Grants 250 Hero XP to a chosen hero.',
    moneyCost: 250, grants: { xp: 250 }, rarity: 'common',
  },
  xp_bundle_medium: {
    id: 'xp_bundle_medium', type: 'xp_bundle',
    name: 'Tome of Experience (Medium)', icon: '📚',
    description: 'Grants 1,000 Hero XP to a chosen hero.',
    moneyCost: 900, grants: { xp: 1000 }, rarity: 'rare',
  },
  xp_bundle_large: {
    id: 'xp_bundle_large', type: 'xp_bundle',
    name: 'Tome of Experience (Grand)', icon: '📜',
    description: 'Grants 5,000 Hero XP to a chosen hero.',
    moneyCost: 4000, grants: { xp: 5000 }, rarity: 'rare',
  },
  // ── Resource Bundles (5-tier system) ──────────────────────────────────────
  // Common (Wood, Stone, Food, Money): T1=200 / T2=500 / T3=1000 / T4=2500 / T5=5000
  // Rare   (Iron, Water):              T1=50  / T2=100 / T3=250  / T4=500  / T5=1000
  // Diamond:                           T1=5   / T2=10  / T3=20   / T4=50   / T5=100
  // Rarity: T1-T2=common, T3=rare, T4-T5=legendary

  // ── Wood ────────────────────────────────────────────────────────────────
  res_bundle_wood_t1: { id: 'res_bundle_wood_t1', type: 'resource_bundle', name: 'Wood Bundle (Small)',    icon: '🪵', description: 'Grants 200 Wood.',   moneyCost: 0, grants: { wood: 200  }, rarity: 'common'    },
  res_bundle_wood_t2: { id: 'res_bundle_wood_t2', type: 'resource_bundle', name: 'Wood Bundle (Medium)',   icon: '🪵', description: 'Grants 500 Wood.',   moneyCost: 0, grants: { wood: 500  }, rarity: 'common'    },
  res_bundle_wood_t3: { id: 'res_bundle_wood_t3', type: 'resource_bundle', name: 'Wood Bundle (Large)',    icon: '🪵', description: 'Grants 1,000 Wood.', moneyCost: 0, grants: { wood: 1000 }, rarity: 'rare'      },
  res_bundle_wood_t4: { id: 'res_bundle_wood_t4', type: 'resource_bundle', name: 'Wood Bundle (Grand)',    icon: '🪵', description: 'Grants 2,500 Wood.', moneyCost: 0, grants: { wood: 2500 }, rarity: 'legendary' },
  res_bundle_wood_t5: { id: 'res_bundle_wood_t5', type: 'resource_bundle', name: 'Wood Bundle (Colossal)', icon: '🪵', description: 'Grants 5,000 Wood.', moneyCost: 0, grants: { wood: 5000 }, rarity: 'legendary' },

  // ── Stone ───────────────────────────────────────────────────────────────
  res_bundle_stone_t1: { id: 'res_bundle_stone_t1', type: 'resource_bundle', name: 'Stone Bundle (Small)',    icon: '🪨', description: 'Grants 200 Stone.',   moneyCost: 0, grants: { stone: 200  }, rarity: 'common'    },
  res_bundle_stone_t2: { id: 'res_bundle_stone_t2', type: 'resource_bundle', name: 'Stone Bundle (Medium)',   icon: '🪨', description: 'Grants 500 Stone.',   moneyCost: 0, grants: { stone: 500  }, rarity: 'common'    },
  res_bundle_stone_t3: { id: 'res_bundle_stone_t3', type: 'resource_bundle', name: 'Stone Bundle (Large)',    icon: '🪨', description: 'Grants 1,000 Stone.', moneyCost: 0, grants: { stone: 1000 }, rarity: 'rare'      },
  res_bundle_stone_t4: { id: 'res_bundle_stone_t4', type: 'resource_bundle', name: 'Stone Bundle (Grand)',    icon: '🪨', description: 'Grants 2,500 Stone.', moneyCost: 0, grants: { stone: 2500 }, rarity: 'legendary' },
  res_bundle_stone_t5: { id: 'res_bundle_stone_t5', type: 'resource_bundle', name: 'Stone Bundle (Colossal)', icon: '🪨', description: 'Grants 5,000 Stone.', moneyCost: 0, grants: { stone: 5000 }, rarity: 'legendary' },

  // ── Food ────────────────────────────────────────────────────────────────
  res_bundle_food_t1: { id: 'res_bundle_food_t1', type: 'resource_bundle', name: 'Ration Pack (Small)',    icon: '🌾', description: 'Grants 200 Food.',   moneyCost: 0, grants: { food: 200  }, rarity: 'common'    },
  res_bundle_food_t2: { id: 'res_bundle_food_t2', type: 'resource_bundle', name: 'Ration Pack (Medium)',   icon: '🌾', description: 'Grants 500 Food.',   moneyCost: 0, grants: { food: 500  }, rarity: 'common'    },
  res_bundle_food_t3: { id: 'res_bundle_food_t3', type: 'resource_bundle', name: 'Ration Pack (Large)',    icon: '🌾', description: 'Grants 1,000 Food.', moneyCost: 0, grants: { food: 1000 }, rarity: 'rare'      },
  res_bundle_food_t4: { id: 'res_bundle_food_t4', type: 'resource_bundle', name: 'Ration Pack (Grand)',    icon: '🌾', description: 'Grants 2,500 Food.', moneyCost: 0, grants: { food: 2500 }, rarity: 'legendary' },
  res_bundle_food_t5: { id: 'res_bundle_food_t5', type: 'resource_bundle', name: 'Ration Pack (Colossal)', icon: '🌾', description: 'Grants 5,000 Food.', moneyCost: 0, grants: { food: 5000 }, rarity: 'legendary' },

  // ── Money (Gold) ─────────────────────────────────────────────────────────
  res_bundle_money_t1: { id: 'res_bundle_money_t1', type: 'resource_bundle', name: 'Gold Pouch (Small)',    icon: '🪙', description: 'Grants 200 Gold.',   moneyCost: 0, grants: { money: 200  }, rarity: 'common'    },
  res_bundle_money_t2: { id: 'res_bundle_money_t2', type: 'resource_bundle', name: 'Gold Pouch (Medium)',   icon: '🪙', description: 'Grants 500 Gold.',   moneyCost: 0, grants: { money: 500  }, rarity: 'common'    },
  res_bundle_money_t3: { id: 'res_bundle_money_t3', type: 'resource_bundle', name: 'Gold Pouch (Large)',    icon: '🪙', description: 'Grants 1,000 Gold.', moneyCost: 0, grants: { money: 1000 }, rarity: 'rare'      },
  res_bundle_money_t4: { id: 'res_bundle_money_t4', type: 'resource_bundle', name: 'Gold Pouch (Grand)',    icon: '🪙', description: 'Grants 2,500 Gold.', moneyCost: 0, grants: { money: 2500 }, rarity: 'legendary' },
  res_bundle_money_t5: { id: 'res_bundle_money_t5', type: 'resource_bundle', name: 'Gold Pouch (Colossal)', icon: '🪙', description: 'Grants 5,000 Gold.', moneyCost: 0, grants: { money: 5000 }, rarity: 'legendary' },

  // ── Iron ────────────────────────────────────────────────────────────────
  res_bundle_iron_t1: { id: 'res_bundle_iron_t1', type: 'resource_bundle', name: 'Iron Bundle (Small)',    icon: '⚙️', description: 'Grants 50 Iron.',    moneyCost: 0, grants: { iron: 50   }, rarity: 'common'    },
  res_bundle_iron_t2: { id: 'res_bundle_iron_t2', type: 'resource_bundle', name: 'Iron Bundle (Medium)',   icon: '⚙️', description: 'Grants 100 Iron.',   moneyCost: 0, grants: { iron: 100  }, rarity: 'common'    },
  res_bundle_iron_t3: { id: 'res_bundle_iron_t3', type: 'resource_bundle', name: 'Iron Bundle (Large)',    icon: '⚙️', description: 'Grants 250 Iron.',   moneyCost: 0, grants: { iron: 250  }, rarity: 'rare'      },
  res_bundle_iron_t4: { id: 'res_bundle_iron_t4', type: 'resource_bundle', name: 'Iron Bundle (Grand)',    icon: '⚙️', description: 'Grants 500 Iron.',   moneyCost: 0, grants: { iron: 500  }, rarity: 'legendary' },
  res_bundle_iron_t5: { id: 'res_bundle_iron_t5', type: 'resource_bundle', name: 'Iron Bundle (Colossal)', icon: '⚙️', description: 'Grants 1,000 Iron.', moneyCost: 0, grants: { iron: 1000 }, rarity: 'legendary' },

  // ── Water ───────────────────────────────────────────────────────────────
  res_bundle_water_t1: { id: 'res_bundle_water_t1', type: 'resource_bundle', name: 'Water Bundle (Small)',    icon: '💧', description: 'Grants 50 Water.',    moneyCost: 0, grants: { water: 50   }, rarity: 'common'    },
  res_bundle_water_t2: { id: 'res_bundle_water_t2', type: 'resource_bundle', name: 'Water Bundle (Medium)',   icon: '💧', description: 'Grants 100 Water.',   moneyCost: 0, grants: { water: 100  }, rarity: 'common'    },
  res_bundle_water_t3: { id: 'res_bundle_water_t3', type: 'resource_bundle', name: 'Water Bundle (Large)',    icon: '💧', description: 'Grants 250 Water.',   moneyCost: 0, grants: { water: 250  }, rarity: 'rare'      },
  res_bundle_water_t4: { id: 'res_bundle_water_t4', type: 'resource_bundle', name: 'Water Bundle (Grand)',    icon: '💧', description: 'Grants 500 Water.',   moneyCost: 0, grants: { water: 500  }, rarity: 'legendary' },
  res_bundle_water_t5: { id: 'res_bundle_water_t5', type: 'resource_bundle', name: 'Water Bundle (Colossal)', icon: '💧', description: 'Grants 1,000 Water.', moneyCost: 0, grants: { water: 1000 }, rarity: 'legendary' },

  // ── Diamond ─────────────────────────────────────────────────────────────
  res_bundle_diamond_t1: { id: 'res_bundle_diamond_t1', type: 'resource_bundle', name: 'Gem Pouch (Small)',    icon: '💎', description: 'Grants 5 Diamonds.',   diamondCost: 0, grants: { diamond: 5   }, rarity: 'common'    },
  res_bundle_diamond_t2: { id: 'res_bundle_diamond_t2', type: 'resource_bundle', name: 'Gem Pouch (Medium)',   icon: '💎', description: 'Grants 10 Diamonds.',  diamondCost: 0, grants: { diamond: 10  }, rarity: 'common'    },
  res_bundle_diamond_t3: { id: 'res_bundle_diamond_t3', type: 'resource_bundle', name: 'Gem Pouch (Large)',    icon: '💎', description: 'Grants 20 Diamonds.',  diamondCost: 0, grants: { diamond: 20  }, rarity: 'rare'      },
  res_bundle_diamond_t4: { id: 'res_bundle_diamond_t4', type: 'resource_bundle', name: 'Gem Pouch (Grand)',    icon: '💎', description: 'Grants 50 Diamonds.',  diamondCost: 0, grants: { diamond: 50  }, rarity: 'legendary' },
  res_bundle_diamond_t5: { id: 'res_bundle_diamond_t5', type: 'resource_bundle', name: 'Gem Pouch (Colossal)', icon: '💎', description: 'Grants 100 Diamonds.', diamondCost: 0, grants: { diamond: 100 }, rarity: 'legendary' },

  // ── Automations ──────────────────────────────────────────────────────────
  cafeteria_automation: {
    id: 'cafeteria_automation', type: 'automation',
    name: 'Cafeteria Auto-Restock', icon: '🤖',
    description: 'Automatically restocks your Cafeteria every 60 seconds using global reserves.',
    diamondCost: 0, automation: 'cafeteriaRestock', rarity: 'rare', singleUse: true,
  },
  // ── Queue-Slot Expansions (one-time, purchasable by anyone) ───────────────
  build_queue_expansion: {
    id: 'build_queue_expansion', type: 'slot_purchase',
    name: 'Build Queue Expansion', icon: '🏗️',
    description: 'Permanently unlocks a 3rd simultaneous build slot. Bonus: 20 💎, 5 000 Food, 2 000 Gold.',
    diamondCost: 0, rarity: 'legendary', slotType: 'build',
    bonus: { diamond: 20, food: 5000, money: 2000 },
  },
  research_queue_expansion: {
    id: 'research_queue_expansion', type: 'slot_purchase',
    name: 'Research Queue Expansion', icon: '🔬',
    description: 'Permanently unlocks a 3rd simultaneous research slot. Bonus: 20 💎, 5 000 Food, 2 000 Gold.',
    diamondCost: 0, rarity: 'legendary', slotType: 'research',
    bonus: { diamond: 20, food: 5000, money: 2000 },
  },
  // ── Buffs ─────────────────────────────────────────────────────────────────
  buff_prod_sm: {
    id: 'buff_prod_sm', type: 'buff',
    name: 'Production Boost (Minor)', icon: '⚗️',
    description: '+25% all resource production for 1 hour.',
    moneyCost: 600, durationMs: 3600000, value: 0.25, rarity: 'common',
  },
  buff_prod_lg: {
    id: 'buff_prod_lg', type: 'buff',
    name: 'Production Boost (Major)', icon: '🔥',
    description: '+50% all resource production for 2 hours.',
    moneyCost: 1500, durationMs: 7200000, value: 0.50, rarity: 'rare',
  },
  // ── Recruitment Scrolls ───────────────────────────────────────────────────
  scroll_common: {
    id: 'scroll_common', type: 'recruitment_scroll',
    name: 'Common Recruitment Scroll', icon: '📜',
    description: 'Roll the dice to recruit a hero, fragment, resource, XP, or buff. Common tier — heroes are mostly common.',
    rarity: 'common', tier: 'common',
  },
  scroll_rare: {
    id: 'scroll_rare', type: 'recruitment_scroll',
    name: 'Rare Recruitment Scroll', icon: '🌀',
    description: 'Roll the dice to recruit a hero, fragment, resource, XP, or buff. Rare tier — heroes skew rare.',
    rarity: 'rare', tier: 'rare',
  },
  scroll_legendary: {
    id: 'scroll_legendary', type: 'recruitment_scroll',
    name: 'Legendary Recruitment Scroll', icon: '✨',
    description: 'Roll the dice to recruit a hero, fragment, resource, XP, or buff. Legendary tier — all hero tiers possible at high rates.',
    rarity: 'legendary', tier: 'legendary',
  },
  // ── Hero Fragments ────────────────────────────────────────────────────────
  fragment_warlord: {
    id: 'fragment_warlord', type: 'hero_fragment',
    name: 'Fragment: Lord Arcturus', icon: '⚔️',
    description: 'A fragment of Lord Arcturus\' essence. Collect 10 to summon the hero or use for awakening.',
    rarity: 'common', targetHeroId: 'warlord', xpValue: 50,
  },
  fragment_archsorceress: {
    id: 'fragment_archsorceress', type: 'hero_fragment',
    name: 'Fragment: Lyra Dawnveil', icon: '🔮',
    description: 'A fragment of Lyra Dawnveil\' power. Collect 30 to summon the hero or use for awakening.',
    rarity: 'legendary', targetHeroId: 'archsorceress', xpValue: 50,
  },
  fragment_shadowblade: {
    id: 'fragment_shadowblade', type: 'hero_fragment',
    name: 'Fragment: Kira Nightwhisper', icon: '🗡️',
    description: 'A fragment of Kira Nightwhisper\' shadow. Collect 20 to summon the hero or use for awakening.',
    rarity: 'rare', targetHeroId: 'shadowblade', xpValue: 50,
  },
  fragment_paladin: {
    id: 'fragment_paladin', type: 'hero_fragment',
    name: 'Fragment: Sir Aldric', icon: '✝️',
    description: 'A fragment of Sir Aldric\' holy light. Collect 20 to summon the hero or use for awakening.',
    rarity: 'rare', targetHeroId: 'paladin', xpValue: 50,
  },
  // ── Speed-Up Items ─────────────────────────────────────────────────────────
  speedup_build_5m:   { id: 'speedup_build_5m',   type: 'speed_boost', target: 'building',  name: 'Build Speed-Up (5m)',        icon: '🏗️', description: 'Reduces the active build timer by 5 minutes.',    rarity: 'common',    skipSeconds: 300    },
  speedup_build_15m:  { id: 'speedup_build_15m',  type: 'speed_boost', target: 'building',  name: 'Build Speed-Up (15m)',       icon: '🏗️', description: 'Reduces the active build timer by 15 minutes.',   rarity: 'common',    skipSeconds: 900    },
  speedup_build_1h:   { id: 'speedup_build_1h',   type: 'speed_boost', target: 'building',  name: 'Build Speed-Up (1h)',        icon: '🏗️', description: 'Reduces the active build timer by 1 hour.',       rarity: 'rare',      skipSeconds: 3600   },
  speedup_build_8h:   { id: 'speedup_build_8h',   type: 'speed_boost', target: 'building',  name: 'Build Speed-Up (8h)',        icon: '🏗️', description: 'Reduces the active build timer by 8 hours.',      rarity: 'rare',      skipSeconds: 28800  },
  speedup_train_5m:   { id: 'speedup_train_5m',   type: 'speed_boost', target: 'training',  name: 'Training Speed-Up (5m)',     icon: '⚔️', description: 'Reduces the active training timer by 5 minutes.',  rarity: 'common',    skipSeconds: 300    },
  speedup_train_15m:  { id: 'speedup_train_15m',  type: 'speed_boost', target: 'training',  name: 'Training Speed-Up (15m)',    icon: '⚔️', description: 'Reduces the active training timer by 15 minutes.', rarity: 'common',    skipSeconds: 900    },
  speedup_train_1h:   { id: 'speedup_train_1h',   type: 'speed_boost', target: 'training',  name: 'Training Speed-Up (1h)',     icon: '⚔️', description: 'Reduces the active training timer by 1 hour.',     rarity: 'rare',      skipSeconds: 3600   },
  speedup_train_8h:   { id: 'speedup_train_8h',   type: 'speed_boost', target: 'training',  name: 'Training Speed-Up (8h)',     icon: '⚔️', description: 'Reduces the active training timer by 8 hours.',    rarity: 'rare',      skipSeconds: 28800  },
  speedup_research_5m:  { id: 'speedup_research_5m',  type: 'speed_boost', target: 'research', name: 'Research Speed-Up (5m)',   icon: '🔬', description: 'Reduces the active research timer by 5 minutes.',  rarity: 'common',    skipSeconds: 300    },
  speedup_research_15m: { id: 'speedup_research_15m', type: 'speed_boost', target: 'research', name: 'Research Speed-Up (15m)',  icon: '🔬', description: 'Reduces the active research timer by 15 minutes.', rarity: 'common',    skipSeconds: 900    },
  speedup_research_1h:  { id: 'speedup_research_1h',  type: 'speed_boost', target: 'research', name: 'Research Speed-Up (1h)',   icon: '🔬', description: 'Reduces the active research timer by 1 hour.',     rarity: 'rare',      skipSeconds: 3600   },
  speedup_research_8h:  { id: 'speedup_research_8h',  type: 'speed_boost', target: 'research', name: 'Research Speed-Up (8h)',   icon: '🔬', description: 'Reduces the active research timer by 8 hours.',    rarity: 'rare',      skipSeconds: 28800  },
  speedup_universal_5m:  { id: 'speedup_universal_5m',  type: 'speed_boost', target: 'any', name: 'Universal Speed-Up (5m)',  icon: '⚡', description: 'Reduces any active build, train, or research timer by 5 minutes.',  rarity: 'common',    skipSeconds: 300    },
  speedup_universal_15m: { id: 'speedup_universal_15m', type: 'speed_boost', target: 'any', name: 'Universal Speed-Up (15m)', icon: '⚡', description: 'Reduces any active build, train, or research timer by 15 minutes.', rarity: 'common',    skipSeconds: 900    },
  speedup_universal_1h:  { id: 'speedup_universal_1h',  type: 'speed_boost', target: 'any', name: 'Universal Speed-Up (1h)',  icon: '⚡', description: 'Reduces any active build, train, or research timer by 1 hour.',     rarity: 'rare',      skipSeconds: 3600   },
  speedup_universal_8h:  { id: 'speedup_universal_8h',  type: 'speed_boost', target: 'any', name: 'Universal Speed-Up (8h)',  icon: '⚡', description: 'Reduces any active build, train, or research timer by 8 hours.',    rarity: 'rare',      skipSeconds: 28800  },
  speedup_universal_instant: { id: 'speedup_universal_instant', type: 'speed_boost', target: 'any', name: 'Instant Completion', icon: '✨', description: 'Instantly completes the current active build, train, or research.', rarity: 'legendary', skipSeconds: 999999 },
};

// ─────────────────────────────────────────────────────────────────────────────
// SHOP CONFIG
// Defines what items are sold in the Shop and at what price.
// goldCost: in-game gold. premiumCost: future real-money / premium currency.
// ─────────────────────────────────────────────────────────────────────────────
export const SHOP_CONFIG = [
  {
    id: 'heroes', label: 'Recruit', icon: '🎲',
    items: [
      { itemId: 'scroll_common',    moneyCost: 400,  featured: false },
      { itemId: 'scroll_rare',      moneyCost: 1250, featured: true  },
      { itemId: 'scroll_legendary', diamondCost: 6, featured: false },
    ],
  },
  {
    id: 'hero_cards', label: 'Hero Cards', icon: '🃏',
    items: [
      { itemId: 'card_hero_warlord',      moneyCost: 750 },
      { itemId: 'card_hero_paladin',       moneyCost: 1250 },
      { itemId: 'card_hero_shadowblade',   moneyCost: 1250 },
      { itemId: 'card_hero_archsorceress', diamondCost: 5, featured: true },
    ],
  },
  {
    id: 'universal_cards', label: 'Universal Cards', icon: '🎴',
    items: [
      { itemId: 'card_common',    moneyCost: 400  },
      { itemId: 'card_rare',      moneyCost: 1000 },
      { itemId: 'card_legendary', diamondCost: 6 },
    ],
  },
  {
    id: 'experience', label: 'XP Bundles', icon: '📖',
    items: [
      { itemId: 'xp_bundle_small',  moneyCost: 250 },
      { itemId: 'xp_bundle_medium', moneyCost: 900, featured: true },
      { itemId: 'xp_bundle_large',  moneyCost: 4000 },
    ],
  },
  {
    id: 'resources', label: 'Resources', icon: '📦',
    items: [
      { itemId: 'res_bundle_wood_t3',    moneyCost: 150 },
      { itemId: 'res_bundle_stone_t3',   moneyCost: 150 },
      { itemId: 'res_bundle_iron_t4',    moneyCost: 200 },
      { itemId: 'res_bundle_food_t3',    moneyCost: 125 },
      { itemId: 'res_bundle_water_t4',   moneyCost: 200 },
      { itemId: 'res_bundle_money_t1', diamondCost: 2 },
    ],
  },
  {
    id: 'buffs', label: 'Buffs', icon: '⚗️',
    items: [
      { itemId: 'buff_prod_sm', moneyCost: 600 },
      { itemId: 'buff_prod_lg', moneyCost: 1500 },
    ],
  },
  {
    id: 'automations', label: 'Automations', icon: '🤖',
    items: [
      { itemId: 'cafeteria_automation', diamondCost: 5, featured: true },
    ],
  },
  {
    id: 'speedups', label: 'Speed Ups', icon: '⚡',
    items: [
      { itemId: 'speedup_build_5m',          moneyCost: 200  },
      { itemId: 'speedup_build_15m',         moneyCost: 500  },
      { itemId: 'speedup_build_1h',          moneyCost: 1500 },
      { itemId: 'speedup_build_8h',          moneyCost: 8000 },
      { itemId: 'speedup_train_5m',          moneyCost: 200  },
      { itemId: 'speedup_train_15m',         moneyCost: 500  },
      { itemId: 'speedup_train_1h',          moneyCost: 1500 },
      { itemId: 'speedup_train_8h',          moneyCost: 8000 },
      { itemId: 'speedup_research_5m',       moneyCost: 200  },
      { itemId: 'speedup_research_15m',      moneyCost: 500  },
      { itemId: 'speedup_research_1h',       moneyCost: 1500 },
      { itemId: 'speedup_research_8h',       moneyCost: 8000 },
      { itemId: 'speedup_universal_5m',      moneyCost: 400,  featured: false },
      { itemId: 'speedup_universal_15m',     moneyCost: 1000, featured: false },
      { itemId: 'speedup_universal_1h',      moneyCost: 3000, featured: true  },
      { itemId: 'speedup_universal_8h',      moneyCost: 18000 },
      { itemId: 'speedup_universal_instant', diamondCost: 8,  featured: true  },
    ],
  },
  {
    id: 'premium', label: 'Premium', icon: '💎',
    items: [
      { diamondPackageId: 'diamonds_100',  label: 'Starter Pack',    icon: '💎', description: '100 Diamonds — great for grabbing a speed-up.', displayPrice: '$0.99'  },
      { diamondPackageId: 'diamonds_500',  label: 'Explorer Pack',   icon: '💎', description: '500 Diamonds — unlock extra queue slots & heroes.', displayPrice: '$4.99',  featured: true },
      { diamondPackageId: 'diamonds_1000', label: 'Commander Pack',  icon: '💎', description: '1 000 Diamonds — VIP III perks await.', displayPrice: '$9.99'  },
      { diamondPackageId: 'diamonds_2500', label: 'Warlord Pack',    icon: '💎', description: '2 500 Diamonds — VIP IV: powerful build & train bonuses.', displayPrice: '$19.99' },
      { diamondPackageId: 'diamonds_5000', label: 'Conqueror Pack',  icon: '💎', description: '5 000 Diamonds — reach VIP V for max perks & +5% production.', displayPrice: '$39.99' },
      { itemId: 'build_queue_expansion',    diamondCost: 800, featured: true },
      { itemId: 'research_queue_expansion', diamondCost: 800 },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DIAMOND PACKAGES
// Used by ShopUI to render the "Buy Diamonds" section.
// displayPrice is cosmetic only — no real charge is made (simulated purchase).
// ─────────────────────────────────────────────────────────────────────────────
export const DIAMOND_PACKAGES = [
  { id: 'diamonds_100',  diamonds: 100,  displayPrice: '$0.99'  },
  { id: 'diamonds_500',  diamonds: 500,  displayPrice: '$4.99'  },
  { id: 'diamonds_1000', diamonds: 1000, displayPrice: '$9.99'  },
  { id: 'diamonds_2500', diamonds: 2500, displayPrice: '$19.99' },
  { id: 'diamonds_5000', diamonds: 5000, displayPrice: '$39.99' },
];

// ─────────────────────────────────────────────────────────────────────────────
// VIP TIERS
// Earned by cumulative diamond spending (real or simulated store).
// threshold: total diamonds spent to reach this tier.
// perks are applied via EventBus user:vipUpdate in each manager.
// ─────────────────────────────────────────────────────────────────────────────
export const VIP_TIERS = [
  {
    tier: 1, threshold: 500,     label: 'VIP I',    badge: '⭐',
    description: '-5% Build · Train · Research Time',
    perks: { buildTimeReduction: 0.05, trainReduction: 0.05, researchReduction: 0.05 },
  },
  {
    tier: 2, threshold: 2000,    label: 'VIP II',   badge: '⭐⭐',
    description: '-5% Build · Train · Research Time',
    perks: { buildTimeReduction: 0.05, trainReduction: 0.05, researchReduction: 0.05 },
  },
  {
    tier: 3, threshold: 6000,    label: 'VIP III',  badge: '🥉',
    description: '-5% All Times · +1 VIP Build Slot (Slot 4)',
    perks: { buildTimeReduction: 0.05, trainReduction: 0.05, researchReduction: 0.05, extraBuildSlots: 1 },
  },
  {
    tier: 4, threshold: 15000,   label: 'VIP IV',   badge: '🥈',
    description: '-5% All Times · +2% All Production',
    perks: { buildTimeReduction: 0.05, trainReduction: 0.05, researchReduction: 0.05, productionBonus: 0.02 },
  },
  {
    tier: 5, threshold: 35000,   label: 'VIP V',    badge: '🥇',
    description: '-5% All Times · +3% All Production',
    perks: { buildTimeReduction: 0.05, trainReduction: 0.05, researchReduction: 0.05, productionBonus: 0.03 },
  },
  {
    tier: 6, threshold: 80000,   label: 'VIP VI',   badge: '💠',
    description: '-5% All Times · +1 VIP Research Slot (Slot 4)',
    perks: { buildTimeReduction: 0.05, trainReduction: 0.05, researchReduction: 0.05, extraResearchSlots: 1 },
  },
  {
    tier: 7, threshold: 180000,  label: 'VIP VII',  badge: '💎',
    description: '-5% All Times · +5% All Production',
    perks: { buildTimeReduction: 0.05, trainReduction: 0.05, researchReduction: 0.05, productionBonus: 0.05 },
  },
  {
    tier: 8, threshold: 400000,  label: 'VIP VIII', badge: '🔮',
    description: '-5% All Times',
    perks: { buildTimeReduction: 0.05, trainReduction: 0.05, researchReduction: 0.05 },
  },
  {
    tier: 9, threshold: 900000,  label: 'VIP IX',   badge: '👑',
    description: '-10% All Times · +5% All Production',
    perks: { buildTimeReduction: 0.10, trainReduction: 0.10, researchReduction: 0.10, productionBonus: 0.05 },
  },
  {
    tier: 10, threshold: 2000000, label: 'VIP X',   badge: '🌟',
    description: '-10% All Times · +5% All Production',
    perks: { buildTimeReduction: 0.10, trainReduction: 0.10, researchReduction: 0.10, productionBonus: 0.05 },
  },
];
