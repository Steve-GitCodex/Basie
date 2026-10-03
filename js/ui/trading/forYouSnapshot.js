import { FEATURED_ENTRY_IDS } from '../../entities/GAME_DATA.js';
import { getActiveQueues } from './activeQueues.js';

export function buildForYouSnapshot(systems) {
  const active = getActiveQueues(systems);
  const queues = { build: active.building, train: active.training, research: active.research };
  const heroes = (systems.heroes?.getRosterWithState?.() ?? [])
    .filter(h => h.isOwned)
    .map(({ name, level, xp, xpToNext }) => ({ name, level, xp, xpToNext }));
  return {
    queues,
    resources: systems.rm.getSnapshot(),
    heroes,
    featured: FEATURED_ENTRY_IDS,
  };
}
