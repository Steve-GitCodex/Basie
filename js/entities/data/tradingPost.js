export const RESOURCE_VALUE = { wood: 1, stone: 1, food: 1, water: 1.5, iron: 3.5, money: 8 };
export const EXCHANGE_SPREAD = 0.15;
export const PRESSURE_PER_1000_WORTH = 0.02;
export const PRESSURE_CAP = 2;

export const CRATE_TABLE = {
  weights: { resources: 50, speedup: 25, xp: 15, money: 10 },
  resourceBase: { wood: 300, stone: 300, food: 300, water: 200, iron: 80 },
  speedups: [
    { itemId: 'speedup_universal_5m', weight: 2 },
    { itemId: 'speedup_universal_15m', weight: 1 },
  ],
  xpItemId: 'xp_bundle_small',
  moneyPerHqLevel: 100,
};

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export const TRADER_TIMING = {
  stayMs: 4 * HOUR_MS,
  awayMs: 6 * HOUR_MS,
  activityCutMs: 10 * MINUTE_MS,
  minAwayMs: 30 * MINUTE_MS,
};

const SPEEDUP_TARGETS = ['universal', 'build', 'train', 'research'];
const SPEEDUP_SIZES = ['5m', '15m', '1h'];
const HERO_SHARDS = ['archsorceress', 'junovane', 'kaelenthorne', 'paladin', 'shadowblade', 'warlord'];

export const TRADER_POOL = [
  ...SPEEDUP_TARGETS.flatMap(target =>
    SPEEDUP_SIZES.map(size => ({ itemId: `speedup_${target}_${size}`, weight: 3 }))),
  { itemId: 'xp_bundle_small', weight: 3 },
  { itemId: 'xp_bundle_medium', weight: 2 },
  { itemId: 'token_normal', weight: 2 },
  { itemId: 'token_epic', weight: 1 },
  ...HERO_SHARDS.map(hero => ({ itemId: `shard_${hero}`, worth: 6000, weight: 1 })),
  { itemId: 'res_bundle_wood_t3', weight: 2 },
  { itemId: 'res_bundle_stone_t3', weight: 2 },
  { itemId: 'res_bundle_food_t3', weight: 2 },
  { itemId: 'res_bundle_iron_t4', weight: 2 },
  { itemId: 'res_bundle_water_t4', weight: 2 },
];

export const TRADER_STOCK_SIZE = 6;
export const TRADER_DISCOUNT = { chance: 0.3, values: [20, 30] };
export const PRICE_ROUNDING = 50;

export const FEATURED_ENTRY_IDS = ['card_hero_warlord', 'token_epic', 'speedup_universal_1h'];
