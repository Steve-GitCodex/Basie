import { CRATE_TABLE } from '../../entities/GAME_DATA.js';
import { pickWeighted } from './pickWeighted.js';

export function rollCrate({ hqLevel, rng, eligible }) {
  const kinds = Object.entries(CRATE_TABLE.weights).map(([kind, weight]) => ({ kind, weight }));
  const { kind } = pickWeighted(kinds, rng);
  if (kind === 'resources') {
    const all = Object.keys(CRATE_TABLE.resourceBase);
    const resources = eligible?.length ? all.filter(r => eligible.includes(r)) : all;
    const res = resources[Math.min(resources.length - 1, Math.floor(rng() * resources.length))];
    return { kind, grants: { [res]: CRATE_TABLE.resourceBase[res] * hqLevel } };
  }
  if (kind === 'speedup') return { kind, itemId: pickWeighted(CRATE_TABLE.speedups, rng).itemId };
  if (kind === 'xp') return { kind, itemId: CRATE_TABLE.xpItemId };
  return { kind, grants: { money: CRATE_TABLE.moneyPerHqLevel * hqLevel } };
}
