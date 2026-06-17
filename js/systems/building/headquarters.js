/**
 * headquarters.js
 * Pure HQ (townhall) feature logic: what each HQ level unlocks and the
 * cumulative global bonuses it grants. Derived entirely from the current HQ
 * level and HQ_UNLOCK_TABLE — no manager state, no side effects.
 *
 * Extracted from BuildingManager (same pattern as buildingEconomy): the manager
 * keeps thin getHQ* facade methods that pass in getHQLevel().
 */
import { HQ_UNLOCK_TABLE } from '../../entities/GAME_DATA.js';

/**
 * IDs unlocked at or below the given HQ level for a category.
 * @param {number} hqLevel
 * @param {'buildings'|'units'|'techs'} category
 * @returns {Set<string>}
 */
function unlockedIds(hqLevel, category) {
  const ids = new Set();
  for (const [lvStr, entry] of Object.entries(HQ_UNLOCK_TABLE)) {
    if (parseInt(lvStr) <= hqLevel && entry[category]) {
      for (const id of entry[category]) ids.add(id);
    }
  }
  return ids;
}

/**
 * Minimum HQ level required to unlock an id in a category, or null if it isn't
 * gated by the table (available from HQ 1).
 * @param {'buildings'|'units'|'techs'} category
 * @param {string} id
 * @returns {number|null}
 */
function requiredLevel(category, id) {
  for (const [lvStr, entry] of Object.entries(HQ_UNLOCK_TABLE)) {
    if (entry[category]?.includes(id)) return parseInt(lvStr);
  }
  return null;
}

/**
 * Cumulative HQ benefits at the given HQ level.
 * @param {number} hqLevel
 * @returns {{ productionBonus:number, attackBonus:number, defenseBonus:number, storageBonus:number }}
 */
function benefits(hqLevel) {
  const out = { productionBonus: 0, attackBonus: 0, defenseBonus: 0, storageBonus: 0 };
  for (const [lvStr, entry] of Object.entries(HQ_UNLOCK_TABLE)) {
    if (parseInt(lvStr) <= hqLevel && entry.benefits) {
      for (const [k, v] of Object.entries(entry.benefits)) {
        if (k in out) out[k] += v;
      }
    }
  }
  return out;
}

export const headquarters = { unlockedIds, requiredLevel, benefits };
