/** Quests, achievements, challenges, daily login rewards, and pass configs. */
export const QUESTS_CONFIG = {
  first_building: {
    id: 'first_building', name: 'The First Stone',
    description: 'Build your first structure to begin your conquest.',
    briefing: 'Every great citadel begins with a single structure. Prove your intent and lay the foundation of your empire.',
    icon: '🏗️',
    objectives: [{ type: 'build', target: 'any', count: 1 }],
    rewards: { money: 200, xp: 50 }, category: 'tutorial',
    prerequisiteQuest: null,
  },
  recruit_army: {
    id: 'recruit_army', name: 'Army of One Hundred',
    description: 'Train 10 units to establish your military force.',
    briefing: 'Your keep needs defenders. A fortress without soldiers is just stone waiting to be taken.',
    icon: '⚔️',
    objectives: [{ type: 'train', target: 'any', count: 10 }],
    rewards: { money: 500, food: 100, xp: 200 }, category: 'military',
    prerequisiteQuest: 'first_building',
  },
  first_victory: {
    id: 'first_victory', name: 'Baptism by Fire',
    description: 'Win your first combat encounter.',
    briefing: 'The enemy does not wait for invitations. Take the fight to them and claim your first triumph in battle.',
    icon: '🔥',
    objectives: [{ type: 'combat_win', target: 'any', count: 1 }],
    rewards: { money: 1000, xp: 500 }, category: 'combat',
    prerequisiteQuest: 'recruit_army',
  },
  veteran_warrior: {
    id: 'veteran_warrior', name: 'Veteran Warrior',
    description: 'Win 5 battles to prove your military prowess.',
    briefing: 'One battle does not make a warrior. Five victories forge a commander whose name is whispered in fear.',
    icon: '🗡️',
    objectives: [{ type: 'combat_win', target: 'any', count: 5 }],
    rewards: { money: 2000, iron: 100, xp: 1000 }, category: 'combat',
    prerequisiteQuest: 'first_victory',
  },
  master_builder: {
    id: 'master_builder', name: 'Master Builder',
    description: 'Build or upgrade any structure 5 times.',
    briefing: 'Expand your base relentlessly. Every upgrade brings you closer to an unassailable fortress.',
    icon: '🏛️',
    objectives: [{ type: 'build', target: 'any', count: 5 }],
    rewards: { stone: 500, wood: 500, xp: 400 }, category: 'economy',
    prerequisiteQuest: null,
  },
  scholar: {
    id: 'scholar', name: 'Scholar of the Realm',
    description: 'Research 2 technologies.',
    briefing: 'Technology separates great commanders from merely lucky ones. Invest in the Workshop and let knowledge be your sharpest weapon.',
    icon: '🔬',
    objectives: [{ type: 'research', target: 'any', count: 2 }],
    rewards: { money: 1500, iron: 200, xp: 800 }, category: 'research',
    prerequisiteQuest: null,
  },
  rising_power: {
    id: 'rising_power', name: 'Rising Power',
    description: 'Reach Commander Level 5.',
    briefing: 'Prestige is earned through growth. Rise to Level 5 and the realm will take notice of your growing dominion.',
    icon: '👑',
    objectives: [{ type: 'reach_level', target: 5 }],
    rewards: { money: 3000, xp: 500 }, category: 'progression',
    prerequisiteQuest: 'first_victory',
  },
};

export const ACHIEVEMENTS_CONFIG = {
  first_blood: {
    id: 'first_blood', name: 'First Blood', icon: '⚔️',
    description: 'Win your first battle.',
    trigger: 'combat_win', count: 1,
    reward: { xp: 200 }, rarity: 'common',
  },
  serial_victor: {
    id: 'serial_victor', name: 'Serial Victor', icon: '🏆',
    description: 'Win 10 battles.',
    trigger: 'combat_win', count: 10,
    reward: { money: 1000, xp: 500 }, rarity: 'uncommon',
  },
  warlord_title: {
    id: 'warlord_title', name: 'Warlord', icon: '🎖️',
    description: 'Win 50 battles.',
    trigger: 'combat_win', count: 50,
    reward: { money: 5000, xp: 2000 }, rarity: 'rare',
  },
  first_recruit: {
    id: 'first_recruit', name: 'First Recruit', icon: '🗡️',
    description: 'Train your first unit.',
    trigger: 'unit_trained', count: 1,
    reward: { money: 100, xp: 50 }, rarity: 'common',
  },
  standing_army: {
    id: 'standing_army', name: 'Standing Army', icon: '⚔️',
    description: 'Train 50 units in total.',
    trigger: 'unit_trained', count: 50,
    reward: { money: 2000, xp: 1000 }, rarity: 'uncommon',
  },
  first_upgrade: {
    id: 'first_upgrade', name: 'Builder Instinct', icon: '🏗️',
    description: 'Upgrade your first building.',
    trigger: 'build', count: 1,
    reward: { money: 100, xp: 50 }, rarity: 'common',
  },
  city_planner: {
    id: 'city_planner', name: 'City Planner', icon: '🏛️',
    description: 'Build or upgrade 20 structures.',
    trigger: 'build', count: 20,
    reward: { stone: 2000, xp: 1000 }, rarity: 'uncommon',
  },
  first_quest: {
    id: 'first_quest', name: 'Quest Taker', icon: '📜',
    description: 'Complete your first quest.',
    trigger: 'quest_completed', count: 1,
    reward: { xp: 150 }, rarity: 'common',
  },
  all_quests: {
    id: 'all_quests', name: 'Questmaster', icon: '📚',
    description: 'Complete all available quests.',
    trigger: 'quest_completed', count: 7,
    reward: { money: 5000, diamond: 5, xp: 3000 }, rarity: 'legendary',
  },
  tech_pioneer: {
    id: 'tech_pioneer', name: 'Tech Pioneer', icon: '🔬',
    description: 'Research your first technology.',
    trigger: 'research', count: 1,
    reward: { iron: 100, xp: 200 }, rarity: 'common',
  },
  mad_scientist: {
    id: 'mad_scientist', name: 'Mad Scientist', icon: '⚗️',
    description: 'Research 5 technologies.',
    trigger: 'research', count: 5,
    reward: { iron: 1000, xp: 1500 }, rarity: 'rare',
  },
  hero_recruiter: {
    id: 'hero_recruiter', name: 'Hero Recruiter', icon: '🦸',
    description: 'Recruit your first hero.',
    trigger: 'hero_recruited', count: 1,
    reward: { money: 500, xp: 300 }, rarity: 'uncommon',
  },
  hall_of_heroes: {
    id: 'hall_of_heroes', name: 'Hall of Heroes', icon: '👑',
    description: 'Recruit all 6 heroes.',
    trigger: 'hero_recruited', count: 6,
    reward: { money: 10000, diamond: 10, xp: 5000 }, rarity: 'legendary',
  },

  // ── Combat milestones ─────────────────────────────────────────────
  unstoppable: {
    id: 'unstoppable', name: 'Unstoppable', icon: '💀',
    description: 'Win 100 battles.',
    trigger: 'combat_win', count: 100,
    reward: { money: 20000, diamond: 20, xp: 8000 }, rarity: 'legendary',
  },

  // ── Commander level milestones ────────────────────────────────────
  rising_commander: {
    id: 'rising_commander', name: 'Rising Commander', icon: '🌟',
    description: 'Reach Commander Level 5.',
    trigger: 'user_level', count: 5,
    reward: { money: 2000, xp: 500 }, rarity: 'uncommon',
  },
  seasoned_commander: {
    id: 'seasoned_commander', name: 'Seasoned Commander', icon: '🎗️',
    description: 'Reach Commander Level 10.',
    trigger: 'user_level', count: 10,
    reward: { money: 5000, diamond: 5, xp: 2000 }, rarity: 'rare',
  },

  // ── Unit training milestones ──────────────────────────────────────
  full_army: {
    id: 'full_army', name: 'Full Army', icon: '🪖',
    description: 'Train 200 units in total.',
    trigger: 'unit_trained', count: 200,
    reward: { money: 5000, iron: 2000, xp: 2500 }, rarity: 'rare',
  },

  // ── Research milestones ───────────────────────────────────────────
  tech_master: {
    id: 'tech_master', name: 'Tech Master', icon: '🧪',
    description: 'Research 20 technologies.',
    trigger: 'research', count: 20,
    reward: { money: 8000, diamond: 8, xp: 4000 }, rarity: 'legendary',
  },

  // ── Market trade milestones ───────────────────────────────────────
  merchant: {
    id: 'merchant', name: 'Merchant', icon: '🏪',
    description: 'Complete 10 market trades.',
    trigger: 'market_trade', count: 10,
    reward: { money: 1000, xp: 400 }, rarity: 'common',
  },
  trade_empire: {
    id: 'trade_empire', name: 'Trade Empire', icon: '💰',
    description: 'Complete 100 market trades.',
    trigger: 'market_trade', count: 100,
    reward: { money: 10000, diamond: 10, xp: 3000 }, rarity: 'legendary',
  },

  // ── Login streak milestones ───────────────────────────────────────
  dedicated: {
    id: 'dedicated', name: 'Dedicated', icon: '📅',
    description: 'Maintain a 7-day login streak.',
    trigger: 'login_streak', count: 7,
    reward: { money: 3000, diamond: 3, xp: 1000 }, rarity: 'uncommon',
  },
  loyal: {
    id: 'loyal', name: 'Loyal Commander', icon: '🛡️',
    description: 'Maintain a 30-day login streak.',
    trigger: 'login_streak', count: 30,
    reward: { money: 15000, diamond: 30, xp: 5000 }, rarity: 'legendary',
  },

  // ── Cumulative resource milestones (ratchet) ──────────────────────
  resource_baron: {
    id: 'resource_baron', name: 'Resource Baron', icon: '🪙',
    description: 'Earn 100,000 gold in total.',
    trigger: 'total_money', count: 100000,
    reward: { money: 5000, xp: 2000 }, rarity: 'rare',
  },
  iron_forge: {
    id: 'iron_forge', name: 'Iron Forge', icon: '⚒️',
    description: 'Earn 50,000 iron in total.',
    trigger: 'total_iron', count: 50000,
    reward: { iron: 2000, diamond: 5, xp: 2000 }, rarity: 'rare',
  },
};

// Each challenge: id, type ('daily'|'weekly'), objective { event, count, countField? }, reward.
export const CHALLENGES_CONFIG = [
  {
    id:          'daily_research',
    type:        'daily',
    name:        'Research Rush',
    description: 'Complete 1 research today',
    objective:   { event: 'tech:researched', count: 1 },
    reward:      [{ type: 'resource', itemId: 'money', quantity: 600 }, { type: 'resource', itemId: 'iron', quantity: 150 }],
    xpReward:    40,   // easiest daily
  },
  {
    id:          'daily_market_trades',
    type:        'daily',
    name:        'Market Day',
    description: 'Make 5 market trades today',
    objective:   { event: 'market:traded', count: 5 },
    reward:      [{ type: 'resource', itemId: 'money', quantity: 1200 }, { type: 'resource', itemId: 'wood', quantity: 400 }],
    xpReward:    50,
  },
  {
    id:          'daily_start_builds',
    type:        'daily',
    name:        'Construction Spree',
    description: 'Start 3 construction projects today',
    objective:   { event: 'building:started', count: 3 },
    reward:      [{ type: 'resource', itemId: 'wood', quantity: 600 }, { type: 'resource', itemId: 'stone', quantity: 600 }],
    xpReward:    60,
  },
  {
    id:          'daily_complete_quests',
    type:        'daily',
    name:        'Task Force',
    description: 'Complete 2 quests today',
    objective:   { event: 'quest:completed', count: 2 },
    reward:      [{ type: 'resource', itemId: 'wood', quantity: 500 }, { type: 'resource', itemId: 'stone', quantity: 500 }, { type: 'resource', itemId: 'iron', quantity: 300 }],
    xpReward:    65,
  },
  {
    id:          'daily_train_units',
    type:        'daily',
    name:        'Boot Camp',
    description: 'Train 200 units today',
    objective:   { event: 'unit:trained', count: 200, countField: 'count' },
    reward:      [{ type: 'resource', itemId: 'money', quantity: 800 }, { type: 'resource', itemId: 'iron', quantity: 200 }],
    xpReward:    75,
  },
  {
    id:          'daily_recruit_hero',
    type:        'daily',
    name:        'Hero Hunter',
    description: 'Recruit 1 hero today',
    objective:   { event: 'hero:recruited', count: 1 },
    reward:      [{ type: 'resource', itemId: 'diamond', quantity: 2 }, { type: 'resource', itemId: 'money', quantity: 800 }],
    xpReward:    80,
  },
  {
    id:          'daily_win_battles',
    type:        'daily',
    name:        "Warrior's Trial",
    description: 'Win 3 battles today',
    objective:   { event: 'combat:victory', count: 3 },
    reward:      [{ type: 'resource', itemId: 'money', quantity: 1000 }, { type: 'resource', itemId: 'diamond', quantity: 1 }],
    xpReward:    90,
  },
  {
    id:          'daily_unlock_achievement',
    type:        'daily',
    name:        'Achievement Seeker',
    description: 'Unlock 1 achievement today',
    objective:   { event: 'achievement:unlocked', count: 1 },
    reward:      [{ type: 'resource', itemId: 'money', quantity: 1500 }, { type: 'resource', itemId: 'diamond', quantity: 2 }],
    xpReward:    120,  // hardest daily — achievements are rare
  },
  // ══ Weekly (total max XP: 1,750) ═════════════════════════════════
  {
    id:          'weekly_market_trades',
    type:        'weekly',
    name:        'Market Maven',
    description: 'Make 10 market trades this week',
    objective:   { event: 'market:traded', count: 10 },
    reward:      [{ type: 'resource', itemId: 'money', quantity: 3000 }, { type: 'resource', itemId: 'diamond', quantity: 3 }],
    xpReward:    150,
  },
  {
    id:          'weekly_buildings_built',
    type:        'weekly',
    name:        'Master Builder',
    description: 'Complete 5 construction projects this week',
    objective:   { event: 'building:completed', count: 5 },
    reward:      [{ type: 'resource', itemId: 'diamond', quantity: 5 }, { type: 'resource', itemId: 'money', quantity: 2000 }],
    xpReward:    175,
  },
  {
    id:          'weekly_complete_quests',
    type:        'weekly',
    name:        'Quest Chain',
    description: 'Complete 10 quests this week',
    objective:   { event: 'quest:completed', count: 10 },
    reward:      [{ type: 'resource', itemId: 'money', quantity: 3500 }, { type: 'resource', itemId: 'wood', quantity: 1000 }, { type: 'resource', itemId: 'iron', quantity: 500 }],
    xpReward:    200,
  },
  {
    id:          'weekly_research',
    type:        'weekly',
    name:        'Tech Tree Climber',
    description: 'Research 5 technologies this week',
    objective:   { event: 'tech:researched', count: 5 },
    reward:      [{ type: 'resource', itemId: 'money', quantity: 4000 }, { type: 'resource', itemId: 'iron', quantity: 1000 }],
    xpReward:    225,
  },
  {
    id:          'weekly_achievements',
    type:        'weekly',
    name:        'Hall of Fame',
    description: 'Unlock 3 achievements this week',
    objective:   { event: 'achievement:unlocked', count: 3 },
    reward:      [{ type: 'resource', itemId: 'diamond', quantity: 10 }, { type: 'resource', itemId: 'money', quantity: 4000 }],
    xpReward:    275,
  },
  {
    id:          'weekly_win_battles',
    type:        'weekly',
    name:        'Battle Hardened',
    description: 'Win 20 battles this week',
    objective:   { event: 'combat:victory', count: 20 },
    reward:      [{ type: 'resource', itemId: 'money', quantity: 5000 }, { type: 'resource', itemId: 'diamond', quantity: 5 }],
    xpReward:    325,
  },
  {
    id:          'weekly_train_units',
    type:        'weekly',
    name:        'War Machine',
    description: 'Train 1,000 units this week',
    objective:   { event: 'unit:trained', count: 1000, countField: 'count' },
    reward:      [{ type: 'resource', itemId: 'money', quantity: 6000 }, { type: 'resource', itemId: 'diamond', quantity: 8 }],
    xpReward:    400,  // hardest weekly
  },
];

// ─── DAILY LOGIN REWARDS ──────────────────────────────────────────
// 7-day cycle; day 8+ wraps back to day 1.
// Every 30th consecutive day the MILESTONE entry fires instead.
export const DAILY_LOGIN_REWARDS = [
  { day: 1, label: 'Day 1',  rewards: [{ type: 'resource', itemId: 'money',   quantity: 500  }] },
  { day: 2, label: 'Day 2',  rewards: [{ type: 'resource', itemId: 'wood',    quantity: 300  }, { type: 'resource', itemId: 'stone',   quantity: 200  }] },
  { day: 3, label: 'Day 3',  rewards: [{ type: 'resource', itemId: 'iron',    quantity: 200  }] },
  { day: 4, label: 'Day 4',  rewards: [{ type: 'resource', itemId: 'money',   quantity: 1000 }, { type: 'resource', itemId: 'wood',    quantity: 500  }] },
  { day: 5, label: 'Day 5',  rewards: [{ type: 'resource', itemId: 'iron',    quantity: 400  }, { type: 'resource', itemId: 'stone',   quantity: 300  }] },
  { day: 6, label: 'Day 6',  rewards: [{ type: 'resource', itemId: 'money',   quantity: 1500 }, { type: 'resource', itemId: 'diamond', quantity: 2    }] },
  { day: 7, label: 'Day 7',  rewards: [{ type: 'resource', itemId: 'diamond', quantity: 5    }, { type: 'resource', itemId: 'money',   quantity: 2000 }, { type: 'item', itemId: 'xp_bundle_small', quantity: 1 }] },
];

/** Fired instead of the normal day when streak is a multiple of 30. */
export const DAILY_LOGIN_MILESTONE = [
  { type: 'resource', itemId: 'diamond', quantity: 50   },
  { type: 'resource', itemId: 'money',   quantity: 5000 },
];

// ─── DAILY CHALLENGE PASS ─────────────────────────────────────────
// Resets each day. Max daily XP = 580 (all 8 dailies completed).
// 5 milestones spread across the full range.
export const DAILY_PASS_CONFIG = [
  { xp:  80, label: '+1,000 Gold',          rewards: [{ type: 'resource', itemId: 'money',   quantity: 1000 }],                                                                      icon: '🪙' },
  { xp: 200, label: 'Normal Recruit Token', rewards: [{ type: 'item',     itemId: 'token_normal',     quantity: 1 }],                                                              icon: '🎫' },
  { xp: 360, label: '+5 Diamonds',          rewards: [{ type: 'resource', itemId: 'diamond', quantity: 5    }],                                                                      icon: '💎' },
  { xp: 480, label: '+2,000 Gold & Iron',   rewards: [{ type: 'resource', itemId: 'money',   quantity: 2000 }, { type: 'resource', itemId: 'iron', quantity: 300 }],               icon: '⚗️' },
  { xp: 580, label: '+8 Diamonds',          rewards: [{ type: 'resource', itemId: 'diamond', quantity: 8    }],                                                                      icon: '👑' },
];

// ─── WEEKLY CHALLENGE PASS ────────────────────────────────────────
// Resets each Monday. Max weekly XP = 1,750 (all 7 weeklies completed).
// 6 milestones spread across the full range.
export const CHALLENGE_PASS_CONFIG = [
  { xp:  200, label: '+5 Diamonds',         rewards: [{ type: 'resource', itemId: 'diamond',          quantity: 5    }],                                                          icon: '💎' },
  { xp:  500, label: 'Epic Recruit Token',  rewards: [{ type: 'item',     itemId: 'token_epic',       quantity: 1    }],                                                          icon: '🎟️' },
  { xp:  875, label: '+10 Diamonds',        rewards: [{ type: 'resource', itemId: 'diamond',          quantity: 10   }, { type: 'resource', itemId: 'money', quantity: 2000 }],   icon: '💎' },
  { xp: 1200, label: 'Epic Hero Card',      rewards: [{ type: 'item',     itemId: 'card_epic',        quantity: 1    }],                                                          icon: '🃏' },
  { xp: 1500, label: '+20 Diamonds',        rewards: [{ type: 'resource', itemId: 'diamond',          quantity: 20   }],                                                          icon: '💎' },
  { xp: 1750, label: 'Legendary Recruit Token', rewards: [{ type: 'item', itemId: 'token_legendary',  quantity: 1    }],                                                          icon: '🏵️' },
];
