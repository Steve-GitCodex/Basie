const RARITY_RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
const INFINITE_SKIP_SECONDS = 999999;

export const TABS = [
  { id: 'all', label: 'All', icon: '🎒', types: null },
  { id: 'resources', label: 'Resources', icon: '📦', types: ['resource_bundle'] },
  { id: 'speedups', label: 'Speedups', icon: '⚡', types: ['speed_boost'] },
  { id: 'boosts', label: 'Boosts', icon: '🔺', types: ['buff'] },
  {
    id: 'heroes', label: 'Heroes', icon: '🦸',
    types: ['hero_card', 'hero_card_universal', 'hero_fragment', 'hero_shard', 'recruit_token', 'tier_shard', 'xp_bundle', 'xp_card'],
  },
  { id: 'other', label: 'Other', icon: '🧰', types: ['slot_purchase', 'automation', 'recruitment_scroll'] },
];

export const TAB_OF_TYPE = Object.fromEntries(
  TABS.filter(tab => tab.types).flatMap(tab => tab.types.map(type => [type, tab.id])),
);

export const ACTION_OF_TYPE = {
  resource_bundle: 'use',
  xp_bundle: 'hero',
  xp_card: 'hero',
  hero_fragment: 'hero',
  speed_boost: 'speedup',
  buff: 'boost',
  hero_card: 'recruit',
  hero_card_universal: 'recruit',
  recruit_token: 'recruit',
  hero_shard: 'recruit',
  tier_shard: 'recruit',
  slot_purchase: 'none',
  automation: 'none',
  recruitment_scroll: 'none',
};

function tierKey(item) {
  if (item.type === 'resource_bundle') return Number(item.id?.match(/_t(\d+)$/)?.[1] ?? 0);
  if (item.type === 'speed_boost') return item.skipSeconds ?? 0;
  return 0;
}

function compareItems(a, b) {
  const byRarity = (RARITY_RANK[b.rarity] ?? 0) - (RARITY_RANK[a.rarity] ?? 0);
  return byRarity || tierKey(a) - tierKey(b) || String(a.name).localeCompare(String(b.name));
}

export function bucket(items) {
  const owned = items.filter(item => item.quantity > 0).sort(compareItems);
  const result = Object.fromEntries(TABS.map(tab => [tab.id, []]));
  for (const item of owned) {
    result.all.push(item);
    result[TAB_OF_TYPE[item.type]]?.push(item);
  }
  return result;
}

function skipLabel(seconds) {
  if (!Number.isFinite(seconds)) return '';
  if (seconds >= INFINITE_SKIP_SECONDS) return '∞';
  return seconds >= 3600 ? `${seconds / 3600}h` : `${seconds / 60}m`;
}

export function tileTag(item) {
  if (item.type === 'resource_bundle') return item.id?.match(/_t(\d+)$/)?.[0].slice(1).toUpperCase() ?? '';
  if (item.type === 'speed_boost') return skipLabel(item.skipSeconds);
  return '';
}
