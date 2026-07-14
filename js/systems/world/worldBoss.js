/**
 * systems/world/worldBoss.js
 * Pure world-boss helpers: the recurring attack window and the weighted loot roll.
 * No state, no events — WorldMapManager owns the "defeated this window" record.
 *
 * A boss's `window` is { everyMs, openMs }: every `everyMs` a window opens for
 * `openMs`. Windows are derived from the clock, so they survive reloads with no
 * stored timers — only the defeat record is persisted.
 */

/**
 * Window state at `now` for a boss POI.
 * @returns {{ open:boolean, windowStart:number, opensAt:number, closesAt:number }}
 *   windowStart — start ms of the current cycle (the identity of "this window").
 */
export function bossWindow(poi, now) {
  const everyMs = poi?.window?.everyMs ?? 0;
  const openMs = poi?.window?.openMs ?? 0;
  if (everyMs <= 0) return { open: false, windowStart: 0, opensAt: Infinity, closesAt: 0 };
  const windowStart = Math.floor(now / everyMs) * everyMs;
  const open = (now - windowStart) < openMs;
  return {
    open,
    windowStart,
    opensAt: open ? windowStart : windowStart + everyMs,
    closesAt: windowStart + openMs,
  };
}

/**
 * Weighted pick from a loot table. Entries carry `weight` (default 1) and a reward
 * shape ({ kind:'item'|'resource', ... }) reused by the march resolver.
 */
export function rollLoot(lootTable, rng = Math.random) {
  const table = Array.isArray(lootTable) ? lootTable : [];
  if (!table.length) return null;
  const total = table.reduce((s, e) => s + (e.weight ?? 1), 0);
  let r = rng() * total;
  for (const e of table) { r -= (e.weight ?? 1); if (r <= 0) return e; }
  return table[table.length - 1];
}
