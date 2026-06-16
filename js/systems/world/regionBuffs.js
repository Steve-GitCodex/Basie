/**
 * systems/world/regionBuffs.js
 * Pure aggregation of active region buffs (from player-owned regions) into the
 * multipliers each consumer needs. No state — callers pass owned regions in.
 *
 * Buff flavors:
 *   economic  { resource, pct }  → +pct production/gather of that resource
 *   military  { pct }            → +pct troop attack in in-region battles
 *   logistic  { pct }            → −pct march time  (≡ +pct march speed)
 */

/** Buffs from regions the player currently owns. */
export function activeBuffs(regionOwner, WORLD_MAP) {
  return WORLD_MAP.regions
    .filter(r => r.buff && regionOwner[r.id] === 'player')
    .map(r => ({ regionId: r.id, ...r.buff }));
}

/** Combined economic bonus (additive fraction) for a given resource. */
export function economicBonus(buffs, resource) {
  return buffs
    .filter(b => b.flavor === 'economic' && b.resource === resource)
    .reduce((sum, b) => sum + (b.pct ?? 0), 0);
}

/** March-speed multiplier from logistic buffs (≥ 1). */
export function logisticSpeedMult(buffs) {
  const pct = buffs
    .filter(b => b.flavor === 'logistic')
    .reduce((sum, b) => sum + (b.pct ?? 0), 0);
  return 1 + pct;
}

/** Combined military attack multiplier (≥ 1). */
export function militaryMult(buffs) {
  const pct = buffs
    .filter(b => b.flavor === 'military')
    .reduce((sum, b) => sum + (b.pct ?? 0), 0);
  return 1 + pct;
}
