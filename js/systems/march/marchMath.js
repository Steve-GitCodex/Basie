/**
 * systems/march/marchMath.js
 * Pure march geometry & timing. No state, no events.
 *
 * Travel speed is in world px/sec. An army moves at its slowest unit's speed
 * (default 1.0 if a unit has no `speed` stat), scaled by the Rally Point's
 * speed bonus and any logistic region buffs.
 */

export const BASE_SPEED_PX = 80;     // px/sec at unit-speed 1.0, no bonuses
export const CARRY_PER_UNIT = 25;    // gather load capacity per unit in the squad
export const MIN_DWELL_MS = 2000;
export const MAX_DWELL_MS = 15000;

export function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

/** Per-category march-speed multiplier, used when a unit has no explicit speed. */
export const CATEGORY_SPEED = {
  infantry: 1.0,
  ranged:   1.0,
  cavalry:  1.4,
  siege:    0.6,
};

/** Slowest unit speed in a squad — an army moves at its slowest member. */
export function squadBaseSpeed(squad) {
  const units = squad?.units ?? [];
  if (!units.length) return 1.0;
  return units.reduce(
    (min, u) => Math.min(min, u.stats?.speed ?? CATEGORY_SPEED[u.category] ?? 1.0),
    Infinity,
  );
}

/** Effective army speed (px/sec). */
export function armySpeed(squad, { rallySpeedBonus = 0, logisticMult = 1 } = {}) {
  return BASE_SPEED_PX * squadBaseSpeed(squad) * (1 + rallySpeedBonus) * logisticMult;
}

/** One-way travel time in ms. */
export function travelMs(dist, speed) {
  return speed > 0 ? (dist / speed) * 1000 : Infinity;
}

/** Total units in a squad. */
export function squadSize(squad) {
  return (squad?.units ?? []).reduce((n, u) => n + (u.count ?? 0), 0);
}

/** Gather load capacity for a squad. */
export function loadCapacity(squad) {
  return squadSize(squad) * CARRY_PER_UNIT;
}

/** On-site gather dwell time, scaled by load ÷ node rate, clamped. */
export function gatherDwellMs(granted, gatherRate) {
  const secs = gatherRate > 0 ? granted / gatherRate : 0;
  return Math.max(MIN_DWELL_MS, Math.min(MAX_DWELL_MS, secs * 1000));
}
