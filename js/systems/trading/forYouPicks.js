import { SHOP_CONFIG, INVENTORY_ITEMS } from '../../entities/GAME_DATA.js';
import { SPEEDUP_DURATIONS, speedupItemId, durationSeconds } from './speedupCatalog.js';

const MAX_PICKS = 6;
const QUEUE_TYPES = ['build', 'train', 'research'];
const RANKED_DURATIONS = SPEEDUP_DURATIONS.filter(d => d !== 'instant');
const LOWEST_RESOURCE_KEYS = ['wood', 'stone', 'food', 'water', 'iron'];
const HERO_XP_ENTRY_ID = 'xp_bundle_medium';
const HERO_NEAR_LEVEL_RATIO = 0.25;

function formatRemaining(secs) {
  const totalMinutes = Math.floor(secs / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function bestDuration(secsLeft) {
  const fitting = RANKED_DURATIONS.filter(d => durationSeconds(d) <= secsLeft);
  return fitting.length ? fitting[fitting.length - 1] : RANKED_DURATIONS[0];
}

function queuePicks(queues) {
  return QUEUE_TYPES
    .filter(type => queues?.[type])
    .map(type => {
      const { label, secsLeft } = queues[type];
      return {
        entryId: speedupItemId(bestDuration(secsLeft), type),
        reason: `${label} · ${formatRemaining(secsLeft)} left`,
      };
    });
}

function resourceEntryId(resourceKey) {
  const resources = SHOP_CONFIG.supply.find(c => c.id === 'resources');
  const entry = resources?.items.find(e => {
    const grants = INVENTORY_ITEMS[e.itemId]?.grants;
    return grants && resourceKey in grants;
  });
  return entry?.entryId ?? null;
}

function lowestResourcePick(resources) {
  let lowest = null;
  for (const key of LOWEST_RESOURCE_KEYS) {
    const r = resources?.[key];
    if (!r || !(r.cap > 0)) continue;
    const ratio = r.amount / r.cap;
    if (!lowest || ratio < lowest.ratio) lowest = { key, ratio };
  }
  const entryId = lowest && resourceEntryId(lowest.key);
  if (!entryId) return null;
  const name = lowest.key[0].toUpperCase() + lowest.key.slice(1);
  return { entryId, reason: `${name} is your lowest resource` };
}

function heroPick(heroes) {
  const qualifying = (heroes ?? [])
    .map(h => ({ hero: h, gap: h.xpToNext - h.xp }))
    .filter(({ hero, gap }) => hero.xpToNext > 0 && gap > 0 && gap / hero.xpToNext <= HERO_NEAR_LEVEL_RATIO)
    .sort((a, b) => a.gap - b.gap);
  if (!qualifying.length) return null;
  const { hero, gap } = qualifying[0];
  return { entryId: HERO_XP_ENTRY_ID, reason: `${hero.name} is ${gap} XP from Lv${hero.level + 1}` };
}

export function pickForYou(snapshot) {
  const candidates = [
    ...queuePicks(snapshot.queues),
    lowestResourcePick(snapshot.resources),
    heroPick(snapshot.heroes),
    ...(snapshot.featured ?? []).map(entryId => ({ entryId, reason: null })),
  ].filter(Boolean);

  const seen = new Set();
  const picks = [];
  for (const pick of candidates) {
    if (seen.has(pick.entryId)) continue;
    seen.add(pick.entryId);
    picks.push(pick);
  }
  return picks.slice(0, MAX_PICKS);
}
