/**
 * systems/march/marchResolver.js
 * Per-type arrival strategies. Keeps MarchManager.update() a thin dispatcher
 * instead of a growing switch. Applies on-site world-state changes and returns
 * the loot/resources the army carries home (credited on return by the manager).
 *
 * ctx = { worldMapManager, combatManager }
 * Returns { outcome, payload, dwellMs }.
 */
import { gatherDwellMs } from './marchMath.js';
import { economicBonus } from '../world/regionBuffs.js';

const ATTACK_DWELL_MS = 1500;

export function resolveArrival(march, poi, ctx) {
  if (march.type === 'gather') return _gather(march, poi, ctx);
  if (march.type === 'attack') return _attack(march, poi, ctx);
  return { outcome: 'none', payload: {}, dwellMs: ATTACK_DWELL_MS };
}

function _gather(march, poi, { worldMapManager }) {
  const granted = worldMapManager.takeFromNode(poi.id, march.loadCap);
  // Economic region buffs add a bonus on top of what the node yielded.
  const bonus = economicBonus(worldMapManager.activeBuffs(), poi.resource);
  const carried = Math.floor(granted * (1 + bonus));
  return {
    outcome: granted > 0 ? 'gathered' : 'empty',
    payload: granted > 0 ? { [poi.resource]: carried } : {},
    dwellMs: gatherDwellMs(granted, poi.gatherRate),
  };
}

function _attack(march, poi, { worldMapManager, combatManager }) {
  // resolveMarchBattle is added in Step 2; until then attacks resolve as a no-op
  // so the gather flow can ship and be verified independently.
  if (typeof combatManager?.resolveMarchBattle !== 'function') {
    return { outcome: 'no_combat', payload: {}, dwellMs: ATTACK_DWELL_MS };
  }
  const result = combatManager.resolveMarchBattle(march.squadId, poi.monsterId);
  if (result?.victory) {
    worldMapManager.markHostileCleared(poi.id);
    if (poi.capturesRegion) worldMapManager.captureRegion(poi.capturesRegion);
    return { outcome: 'victory', payload: result.loot ?? {}, dwellMs: ATTACK_DWELL_MS };
  }
  return { outcome: 'defeat', payload: {}, dwellMs: ATTACK_DWELL_MS };
}
