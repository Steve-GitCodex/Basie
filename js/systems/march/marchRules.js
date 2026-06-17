/**
 * systems/march/marchRules.js
 * Pure dispatch validation. Returns { ok, reason } — no state, no mutation.
 */

const MARCH_TYPE_FOR = {
  resource_node: 'gather',
  camp: 'attack',
  stronghold: 'attack',
};

/** Which march type a POI accepts ('gather' | 'attack' | null). */
export function marchTypeForPOI(poi) {
  return poi ? (MARCH_TYPE_FOR[poi.type] ?? null) : null;
}

/**
 * @param {object} p
 * @param {string} p.type        requested march type
 * @param {object} p.poi         target POI (or null)
 * @param {object} p.squad       resolved squad (or null)
 * @param {boolean} p.slotFree   a march slot is available
 * @param {boolean} p.squadBusy  the squad is already out on a march
 * @param {boolean} [p.hostileAvailable] camp/stronghold not waiting to respawn
 * @param {boolean} [p.regionLocked] the target POI's region is not yet unlocked
 */
export function canDispatch({ type, poi, squad, slotFree, squadBusy, hostileAvailable = true, regionLocked = false }) {
  if (!poi)            return { ok: false, reason: 'No target selected.' };
  if (regionLocked)    return { ok: false, reason: 'Region locked — capture the regions leading to it first.' };
  if (!squad || !(squad.units?.length)) return { ok: false, reason: 'Squad is empty.' };
  if (squadBusy)       return { ok: false, reason: 'That squad is already marching.' };
  if (!slotFree)       return { ok: false, reason: 'No march slots free.' };

  const expected = marchTypeForPOI(poi);
  if (!expected)       return { ok: false, reason: 'Nothing to do here.' };
  if (type !== expected) return { ok: false, reason: `This target needs a ${expected} march.` };

  if (expected === 'attack' && !hostileAvailable) {
    return { ok: false, reason: 'Already cleared — it will return later.' };
  }
  return { ok: true, reason: null };
}
