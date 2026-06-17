/**
 * buildingRules.js
 * Pure decision logic for building costs and prerequisites — no manager state,
 * no side effects. Extracted from BuildingManager so the rules can be unit-tested
 * in isolation and later shared with an authoritative server.
 *
 * Stateful inputs are passed via a small `ctx`:
 *   { getLevelOf(buildingId): number, getPopulation(): { current, cap } }
 */
import { BUILDINGS_CONFIG } from '../../entities/GAME_DATA.js';

/** Cost of a level scaled geometrically from the base cost. */
function scaleCost(baseCost, multiplier, currentLevel) {
  const out = {};
  for (const [res, amount] of Object.entries(baseCost)) {
    out[res] = Math.floor(amount * Math.pow(multiplier, currentLevel));
  }
  return out;
}

/** First-failure prerequisite check. @returns {{ met: boolean, reason?: string }} */
function checkRequirements(requires, ctx) {
  if (!requires) return { met: true };
  for (const [bId, minLevel] of Object.entries(requires)) {
    if (bId === 'population') {
      if (ctx.getPopulation().current < minLevel) {
        return { met: false, reason: `Requires Population ≥ ${minLevel}` };
      }
    } else if (ctx.getLevelOf(bId) < minLevel) {
      const name = BUILDINGS_CONFIG[bId]?.name ?? bId;
      return { met: false, reason: `Requires ${name} Lv.${minLevel}` };
    }
  }
  return { met: true };
}

/**
 * Collect ALL unmet conditions as human-readable strings.
 * Unlike checkRequirements, does not stop at the first failure.
 * @returns {string[]}
 */
function collectMissing(requires, ctx) {
  if (!requires) return [];
  const missing = [];
  for (const [bId, minLevel] of Object.entries(requires)) {
    if (bId === 'population') {
      const pop = ctx.getPopulation();
      if (pop.current < minLevel) {
        missing.push(`Requires Population ≥ ${minLevel} (current: ${Math.floor(pop.current)})`);
      }
    } else if (ctx.getLevelOf(bId) < minLevel) {
      const name = BUILDINGS_CONFIG[bId]?.name ?? bId;
      missing.push(`Requires ${name} Lv.${minLevel}`);
    }
  }
  return missing;
}

/** True when every building-level condition in the map is satisfied. */
function checkCondition(condition, ctx) {
  if (!condition) return true;
  return Object.entries(condition).every(([bId, minLv]) => ctx.getLevelOf(bId) >= minLv);
}

export const buildingRules = { scaleCost, checkRequirements, collectMissing, checkCondition };
