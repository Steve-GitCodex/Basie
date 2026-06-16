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
  constructor(unitManager, combatManager, resourceManager, worldMapManager, buildingManager) {
    this.name = 'march';
    this._um = unitManager;
    this._cm = combatManager;
    this._rm = resourceManager;
    this._wm = worldMapManager;
    this._bm = buildingManager;
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
   * @param {{ type:'gather'|'attack', targetPoiId:string, squadId:string }} req
   * @returns {{ success:boolean, reason?:string, marchId?:number }}
   */
  dispatch({ type, targetPoiId, squadId }) {
    const poi = this._wm.getPOI(targetPoiId);
    const squad = this._um.getSquad?.(squadId) ?? null;
    const check = canDispatch({
      type, poi, squad,
      slotFree: this.slotsFree() > 0,
      squadBusy: this.isSquadMarching(squadId),
      hostileAvailable: poi ? this._wm.isHostileAvailable(poi.id) : false,
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
        m.outcome = res.outcome;
        m.phase = 'acting';
        m.actUntil = now + (res.dwellMs ?? 0);
        eventBus.emit('march:arrived', this._summary(m));
      } else if (m.phase === 'acting' && now >= m.actUntil) {
        m.phase = 'returning';
        m.returnAt = now + m.tripMs;
        eventBus.emit('march:returning', this._summary(m));
      } else if (m.phase === 'returning' && now >= m.returnAt) {
        if (m.payload && Object.keys(m.payload).length) this._rm.add(m.payload);
        this._um.setSquadDeployed?.(m.squadId, false);
        eventBus.emit('march:completed', this._summary(m));
        done.push(m.id);
      }
    }
    if (done.length) this._marches = this._marches.filter(m => !done.includes(m.id));
  }

  _summary(m) {
    return {
      id: m.id, type: m.type, squadId: m.squadId, targetPoiId: m.targetPoiId,
      phase: m.phase, arriveAt: m.arriveAt, actUntil: m.actUntil, returnAt: m.returnAt,
      outcome: m.outcome, payload: m.payload,
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
    for (const m of this._marches) this._um.setSquadDeployed?.(m.squadId, true);
  }
}
