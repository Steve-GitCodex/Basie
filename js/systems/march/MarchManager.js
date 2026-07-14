/**
 * systems/march/MarchManager.js
 * Owns armies-in-transit. Orchestrator only: geometry/timing in marchMath,
 * validation in marchRules, per-type arrival in marchResolver.
 *
 * A march = a UnitManager squad sent to a POI. Phases (driven by absolute epoch
 * timestamps so they resume correctly after a reload):
 *   outbound → acting (on-site) → returning → done
 * Loot/resources are carried home and credited on return.
 */
import { eventBus } from '../../core/EventBus.js';
import { WORLD_MAP, BUILDINGS_CONFIG } from '../../entities/GAME_DATA.js';
import { armySpeed, distance, travelMs, loadCapacity } from './marchMath.js';
import { canDispatch } from './marchRules.js';
import { resolveArrival } from './marchResolver.js';
import { logisticSpeedMult } from '../world/regionBuffs.js';

export class MarchManager {
  constructor(unitManager, combatManager, resourceManager, worldMapManager, buildingManager, inventoryManager) {
    this.name = 'march';
    this._um = unitManager;
    this._cm = combatManager;
    this._rm = resourceManager;
    this._wm = worldMapManager;
    this._bm = buildingManager;
    this._inv = inventoryManager;
    this._marches = [];
    this._idSeq = 1;
  }

  // ── Capacity (from Rally Point level) ───────────────────────────────────────
  /** Stats row for the Rally Point at its current level, or null if unbuilt. */
  _rallyStats() {
    const lvl = this._rallyLevel();
    if (lvl <= 0) return null;
    return BUILDINGS_CONFIG.rallypoint?.levelStats?.[lvl - 1] ?? null;
  }

  /** Total march slots granted by the built Rally Point (0 if not built). */
  marchSlots() {
    return this._rallyStats()?.marchSlots ?? 0;
  }

  _rallyLevel() {
    return this._bm.getLevelOf?.('rallypoint') ?? 0;
  }

  _rallySpeedBonus() {
    return this._rallyStats()?.speedBonus ?? 0;
  }

  activeMarches() { return this._marches; }
  isSquadMarching(squadId) { return this._marches.some(m => m.squadId === squadId); }
  slotsFree() { return this.marchSlots() - this._marches.length; }

  /** ETA preview for the dispatch UI (one-way travel ms), or null if invalid. */
  previewMarch(targetPoiId, squadId) {
    const poi = this._wm.getPOI(targetPoiId);
    const squad = this._um.getSquad?.(squadId);
    if (!poi || !squad) return null;
    const dist = distance(WORLD_MAP.home.x, WORLD_MAP.home.y, poi.x, poi.y);
    const speed = armySpeed(squad, {
      rallySpeedBonus: this._rallySpeedBonus(),
      logisticMult: logisticSpeedMult(this._wm.activeBuffs()),
    });
    return { etaMs: travelMs(dist, speed), distance: dist, speed };
  }

  // ── Dispatch ────────────────────────────────────────────────────────────────
  /**
   * @param {{ type:'gather'|'attack'|'scout', targetPoiId:string, squadId:string }} req
   * @returns {{ success:boolean, reason?:string, marchId?:number }}
   */
  dispatch({ type, targetPoiId, squadId }) {
    const poi = this._wm.getPOI(targetPoiId);
    const squad = this._um.getSquad?.(squadId) ?? null;
    const check = canDispatch({
      type, poi, squad,
      slotFree: this.slotsFree() > 0,
      squadBusy: this.isSquadMarching(squadId) || (this._um.isSquadDeployed?.(squadId) ?? false),
      hostileAvailable: poi ? this._wm.isHostileAvailable(poi.id) : false,
      scoutAvailable: poi ? this._wm.isScoutAvailable(poi.id) : false,
      regionLocked: poi ? !this._wm.isRegionUnlocked(poi.regionId) : false,
    });
    if (!check.ok) return { success: false, reason: check.reason };

    const home = WORLD_MAP.home;
    const dist = distance(home.x, home.y, poi.x, poi.y);
    const speed = armySpeed(squad, {
      rallySpeedBonus: this._rallySpeedBonus(),
      logisticMult: logisticSpeedMult(this._wm.activeBuffs()),
    });
    const trip = travelMs(dist, speed);
    const now = Date.now();

    const march = {
      id: this._idSeq++,
      type, squadId, targetPoiId,
      phase: 'outbound',
      departAt: now,
      arriveAt: now + trip,
      actUntil: 0,
      returnAt: 0,
      distance: dist,
      speed,
      tripMs: trip,
      loadCap: loadCapacity(squad),
      payload: {},
      grants: null,
      outcome: null,
    };
    this._marches.push(march);
    this._um.setSquadDeployed?.(squadId, true);
    eventBus.emit('march:dispatched', this._summary(march));
    return { success: true, marchId: march.id };
  }

  // ── Engine tick ───────────────────────────────────────────────────────────
  update(_dt) {
    if (!this._marches.length) return;
    const now = Date.now();
    const done = [];
    for (const m of this._marches) {
      if (m.phase === 'outbound' && now >= m.arriveAt) {
        const poi = this._wm.getPOI(m.targetPoiId);
        const res = resolveArrival(m, poi, { worldMapManager: this._wm, combatManager: this._cm });
        m.payload = res.payload ?? {};
        m.grants = res.grants ?? null;
        m.outcome = res.outcome;
        m.phase = 'acting';
        m.actUntil = now + (res.dwellMs ?? 0);
        eventBus.emit('march:arrived', this._summary(m));
      } else if (m.phase === 'acting' && now >= m.actUntil) {
        m.phase = 'returning';
        m.returnAt = now + m.tripMs;
        eventBus.emit('march:returning', this._summary(m));
      } else if (m.phase === 'returning' && now >= m.returnAt) {
        this._creditMarch(m);
        this._um.setSquadDeployed?.(m.squadId, false);
        eventBus.emit('march:completed', this._summary(m));
        done.push(m.id);
      }
    }
    if (done.length) this._marches = this._marches.filter(m => !done.includes(m.id));
  }

  /**
   * Mathematical offline catchup — advances all active marches through their phases
   * using absolute timestamps. A march that departed, acted, and returned during the
   * offline window is fully resolved in one pass. O(active marches), not O(ticks).
   * @param {number} _elapsedSec - unused (timestamps are absolute)
   * @param {number} nowMs - effective 'now' for the offline window
   */
  applyOffline(_elapsedSec, nowMs) {
    if (!this._marches.length) return;
    const done = [];

    for (const m of this._marches) {
      // Outbound → acting: resolve arrival at the actual arriveAt time
      if (m.phase === 'outbound' && m.arriveAt <= nowMs) {
        const poi = this._wm.getPOI(m.targetPoiId);
        const res = resolveArrival(m, poi, { worldMapManager: this._wm, combatManager: this._cm });
        m.payload  = res.payload ?? {};
        m.grants   = res.grants ?? null;
        m.outcome  = res.outcome;
        m.phase    = 'acting';
        m.actUntil = m.arriveAt + (res.dwellMs ?? 0); // cascade from arriveAt, not real-now
        eventBus.emit('march:arrived', this._summary(m));
      }

      // Acting → returning
      if (m.phase === 'acting' && m.actUntil <= nowMs) {
        m.phase    = 'returning';
        m.returnAt = m.actUntil + m.tripMs; // cascade from actUntil
        eventBus.emit('march:returning', this._summary(m));
      }

      // Returning → done
      if (m.phase === 'returning' && m.returnAt <= nowMs) {
        this._creditMarch(m);
        this._um.setSquadDeployed?.(m.squadId, false);
        eventBus.emit('march:completed', this._summary(m));
        done.push(m.id);
      }
    }

    if (done.length) this._marches = this._marches.filter(m => !done.includes(m.id));
  }

  /** Realise a returned army's haul: resources, items, and timed buffs. */
  _creditMarch(m) {
    if (m.payload && Object.keys(m.payload).length) this._rm.add(m.payload);
    const g = m.grants;
    if (!g) return;
    for (const it of g.items ?? []) this._inv?.addItem?.(it.itemId, it.qty ?? 1);
    if (g.buff) this._wm.grantTimedBuff?.(g.buff);
  }

  _summary(m) {
    return {
      id: m.id, type: m.type, squadId: m.squadId, targetPoiId: m.targetPoiId,
      phase: m.phase, arriveAt: m.arriveAt, actUntil: m.actUntil, returnAt: m.returnAt,
      outcome: m.outcome, payload: m.payload, grants: m.grants,
    };
  }

  // ── Persistence ─────────────────────────────────────────────────────────────
  serialize() {
    return { marches: this._marches, idSeq: this._idSeq };
  }

  deserialize(state) {
    this._marches = Array.isArray(state?.marches) ? state.marches : [];
    this._idSeq = state?.idSeq ?? (this._marches.reduce((mx, m) => Math.max(mx, m.id), 0) + 1);
    // Deploy flags are runtime-only — re-assert them from the restored marches.
    // Guard against phantom squads (deleted while march was in-flight).
    for (const m of this._marches) {
      if (this._um.getSquad?.(m.squadId)) this._um.setSquadDeployed?.(m.squadId, true);
    }
  }
}
