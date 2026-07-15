/**
 * systems/march/marchResolver.js
 * Per-type arrival strategies. Keeps MarchManager.update() a thin dispatcher
 * instead of a growing switch. Applies on-site world-state changes and returns
 * the loot/resources the army carries home (credited on return by the manager).
 *
 * ctx = { worldMapManager, combatManager }
 * Returns { outcome, payload, dwellMs, grants? }.
 *   payload — resource keys, credited via ResourceManager.add on return.
 *   grants  — non-resource rewards { items?:[{itemId,qty}], buff?:{...} } applied
 *             by MarchManager on return (kept separate so payload stays pure
 *             resource bundles).
 */
import { gatherDwellMs } from './marchMath.js';
import { economicBonus, militaryMult } from '../world/regionBuffs.js';
import { rollLoot } from '../world/worldBoss.js';

const ATTACK_DWELL_MS = 1500;

export function resolveArrival(march, poi, ctx) {
  // Target may have been removed (map edit / node depletion cull) while the army
  // was in transit. Abort cleanly — the squad turns around empty rather than
  // dereferencing a null POI inside the engine tick.
  if (!poi) return { outcome: 'lost_target', payload: {}, dwellMs: 0 };
  if (march.type === 'gather') return _gather(march, poi, ctx);
  if (march.type === 'attack') return _attack(march, poi, ctx);
  if (march.type === 'scout')  return _scout(march, poi, ctx);
  return { outcome: 'none', payload: {}, dwellMs: ATTACK_DWELL_MS };
}

function _gather(march, poi, { worldMapManager }) {
  const granted = worldMapManager.takeFromNode(poi.id, march.loadCap);
  // Economic region buffs add a bonus on top of what the node yielded.
  const bonus = economicBonus(worldMapManager.activeBuffs(), poi.resource);
  const carried = Math.min(march.loadCap, Math.floor(granted * (1 + bonus)));
  return {
    outcome: granted > 0 ? 'gathered' : 'empty',
    payload: granted > 0 ? { [poi.resource]: carried } : {},
    dwellMs: gatherDwellMs(granted, poi.gatherRate),
  };
}

function _attack(march, poi, ctx) {
  if (poi?.type === 'world_boss') return _boss(march, poi, ctx);
  const { worldMapManager, combatManager } = ctx;
  if (typeof combatManager?.resolveMarchBattle !== 'function') {
    return { outcome: 'no_combat', payload: {}, dwellMs: ATTACK_DWELL_MS };
  }
  const milMult = militaryMult(worldMapManager.activeBuffs());
  const result = combatManager.resolveMarchBattle(march.squadId, poi.monsterId, milMult);
  if (result?.victory) {
    worldMapManager.markHostileCleared(poi.id);
    if (poi.capturesRegion) worldMapManager.captureRegion(poi.capturesRegion);
    return { outcome: 'victory', payload: result.loot ?? {}, dwellMs: ATTACK_DWELL_MS };
  }
  return { outcome: 'defeat', payload: {}, dwellMs: ATTACK_DWELL_MS };
}

/**
 * World boss. The window is re-checked at arrival (it may have closed in transit);
 * a kill is recorded against the window and a rare drop is rolled from the loot
 * table. Bosses don't capture territory — they're a windowed loot fight.
 */
function _boss(march, poi, { worldMapManager, combatManager }) {
  if (!worldMapManager.isBossOpen(poi.id)) {
    return { outcome: 'closed', payload: {}, dwellMs: ATTACK_DWELL_MS };
  }
  if (typeof combatManager?.resolveMarchBattle !== 'function') {
    return { outcome: 'no_combat', payload: {}, dwellMs: ATTACK_DWELL_MS };
  }
  const milMult = militaryMult(worldMapManager.activeBuffs());
  const result = combatManager.resolveMarchBattle(march.squadId, poi.monsterId, milMult);
  if (result?.victory) {
    worldMapManager.markBossDefeated(poi.id);
    const drop = rollLoot(poi.lootTable);
    const { payload, grants } = _ruinReward(drop); // reuses the kind→reward mapping
    // Fold in any base combat loot alongside the rare drop.
    return { outcome: 'boss_victory', payload: { ...(result.loot ?? {}), ...payload }, grants, dwellMs: ATTACK_DWELL_MS };
  }
  return { outcome: 'defeat', payload: {}, dwellMs: ATTACK_DWELL_MS };
}

/** Scout marches resolve by POI: ruins run an expedition, outposts are captured. */
function _scout(march, poi, ctx) {
  if (poi?.type === 'ruin')    return _expedition(march, poi, ctx);
  if (poi?.type === 'outpost') return _capture(march, poi, ctx);
  return { outcome: 'spent', payload: {}, dwellMs: ATTACK_DWELL_MS };
}

/**
 * Ruin expedition. An optional `garrison` is fought first (token defenders); on a
 * win — or if undefended — the ruin is looted once and an on-site expedition runs
 * for `expeditionMs`. The reward is carried home: resource rewards go in `payload`,
 * buff/item rewards in `grants` (applied on return by the manager).
 */
function _expedition(march, poi, { worldMapManager, combatManager }) {
  if (worldMapManager.getPOIState(poi.id)?.looted) {
    return { outcome: 'spent', payload: {}, dwellMs: ATTACK_DWELL_MS };
  }
  // Optional token garrison — a defeat aborts the expedition (ruin stays unlooted).
  if (poi.garrison && typeof combatManager?.resolveMarchBattle === 'function') {
    const milMult = militaryMult(worldMapManager.activeBuffs());
    const battle = combatManager.resolveMarchBattle(march.squadId, poi.garrison, milMult);
    if (!battle?.victory) return { outcome: 'defeat', payload: {}, dwellMs: ATTACK_DWELL_MS };
  }
  worldMapManager.markRuinLooted(poi.id);
  const { payload, grants } = _ruinReward(poi.reward);
  return { outcome: 'explored', payload, grants, dwellMs: poi.expeditionMs ?? ATTACK_DWELL_MS };
}

/**
 * Capture a persistent outpost/shrine/watchtower. Fights an optional garrison,
 * then flips ownership to the player — its standing boon activates immediately via
 * WorldMapManager.activeBuffs() (no loot carried home).
 */
function _capture(march, poi, { worldMapManager, combatManager }) {
  if (worldMapManager.outpostOwner(poi.id) === 'player') {
    return { outcome: 'held', payload: {}, dwellMs: ATTACK_DWELL_MS };
  }
  if (poi.garrison && typeof combatManager?.resolveMarchBattle === 'function') {
    const milMult = militaryMult(worldMapManager.activeBuffs());
    const battle = combatManager.resolveMarchBattle(march.squadId, poi.garrison, milMult);
    if (!battle?.victory) return { outcome: 'defeat', payload: {}, dwellMs: ATTACK_DWELL_MS };
  }
  worldMapManager.captureOutpost(poi.id);
  return { outcome: 'captured', payload: {}, dwellMs: ATTACK_DWELL_MS };
}

/** Translate a ruin's declarative reward into { payload (resources), grants }. */
function _ruinReward(reward) {
  if (!reward) return { payload: {}, grants: null };
  if (reward.kind === 'resource') {
    return { payload: { [reward.resource]: reward.amount ?? 0 }, grants: null };
  }
  if (reward.kind === 'item') {
    return { payload: {}, grants: { items: [{ itemId: reward.itemId, qty: reward.qty ?? 1 }] } };
  }
  if (reward.kind === 'buff') {
    const { kind, ...buff } = reward;
    return { payload: {}, grants: { buff } };
  }
  return { payload: {}, grants: null };
}
