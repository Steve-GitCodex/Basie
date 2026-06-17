/**
 * systems/world/nodeEconomy.js
 * Pure resource-node math: regeneration and extraction. No state, no events.
 */

/** Regenerate a node's store toward its capacity. */
export function regen(remaining, poi, dt) {
  const rate = poi.regenPerSec ?? 0;
  return Math.min(poi.capacity, remaining + rate * dt);
}

/**
 * Take up to `want` from a node's remaining store.
 * @returns {{ granted:number, left:number }}
 */
export function take(remaining, want) {
  const granted = Math.max(0, Math.min(remaining, Math.floor(want)));
  return { granted, left: remaining - granted };
}
