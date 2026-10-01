const MULTI_PULL_MAX = 10;

const TOTAL_KEY_BY_OUTCOME = { hero: 'heroes', shard: 'shards', fragment: 'fragments', xp: 'xp', overflow: 'overflow' };

const isNewHero = result => result.outcome === 'hero' && !result.isDuplicate;

export function pullCountFor(tokens) {
  const owned = Number.isFinite(tokens) ? Math.max(0, Math.floor(tokens)) : 0;
  return { single: owned >= 1, multi: owned >= 2 ? Math.min(MULTI_PULL_MAX, owned) : 0 };
}

export function revealPlan(results) {
  return (results ?? []).map(result => {
    if (result.grantFailed) return { hint: 'plain', spotlight: false };
    if (isNewHero(result)) return { hint: 'burst', spotlight: true };
    if (result.outcome === 'shard') return { hint: 'glow', spotlight: false };
    return { hint: 'plain', spotlight: false };
  });
}

export function resultTotals(results) {
  const totals = { heroes: 0, shards: 0, fragments: 0, xp: 0, overflow: 0 };
  for (const result of results ?? []) {
    if (result.grantFailed) continue;
    if (result.outcome === 'hero' && result.isDuplicate) continue;
    const key = TOTAL_KEY_BY_OUTCOME[result.outcome];
    if (key) totals[key] += 1;
  }
  return totals;
}
