/**
 * sectorState.js
 * Save state for rubble-sector expansion (ADR 0022, Phase B). Owns which rubble
 * sectors are cleared and which are mid-clear; the core is always clear and is
 * never stored. BuildingManager delegates placement-clearance checks here and
 * completes clear timers on the tick.
 *
 * Grandfathering (ids-are-save-keys contract): on deserialize, any sector that
 * already contains a placed instance is force-cleared, so no legacy base ever
 * strands a building under rubble. Legacy saves with no sector data get the same
 * rule with the core always clear.
 */
import { eventBus } from '../../core/EventBus.js';
import { SECTORS, SECTOR_BY_ID, SECTOR_IDS, sectorIdAt, coreContains } from '../../entities/data/citySectors.js';

export class SectorState {
  constructor() {
    /** @type {Set<string>} cleared rubble-sector ids */
    this._cleared = new Set();
    /** @type {Map<string, number>} sector id → clear-completion timestamp (ms) */
    this._clearing = new Map();
  }

  isCleared(id)  { return this._cleared.has(id); }
  isClearing(id) { return this._clearing.has(id); }
  clearingEndsAt(id) { return this._clearing.get(id) ?? null; }
  clearedIds()   { return [...this._cleared]; }

  /** Cell usable for placement — core is always clear; rubble must be cleared. */
  isCellCleared(cx, cy) {
    if (coreContains(cx, cy)) return true;
    const id = sectorIdAt(cx, cy);
    return id ? this._cleared.has(id) : false;
  }

  /** Whole footprint sits on cleared/core cells. */
  isRectCleared(cx, cy, w, h) {
    for (let y = cy; y < cy + h; y++)
      for (let x = cx; x < cx + w; x++)
        if (!this.isCellCleared(x, y)) return false;
    return true;
  }

  canClear(id, hqLevel) {
    const s = SECTOR_BY_ID.get(id);
    if (!s) return { ok: false, reason: 'Unknown sector.' };
    if (this._cleared.has(id)) return { ok: false, reason: 'Already cleared.' };
    if (this._clearing.has(id)) return { ok: false, reason: 'Already clearing.' };
    if (hqLevel < s.hqLevel) return { ok: false, reason: `Requires HQ Lv.${s.hqLevel}.` };
    return { ok: true };
  }

  startClear(id, endsAt) { this._clearing.set(id, endsAt); }

  /** State + affordability of every rubble sector, for the clear-panel UI. */
  catalog(hqLevel, canAfford) {
    return SECTORS.map(s => {
      const cleared  = this._cleared.has(s.id);
      const clearing = this._clearing.has(s.id);
      return {
        id: s.id, ring: s.ring, rect: s.rect, cost: s.cost,
        clearTimeSec: s.clearTimeSec, hqLevel: s.hqLevel,
        cleared, clearing,
        endsAt:   clearing ? this._clearing.get(s.id) : null,
        unlocked: hqLevel >= s.hqLevel,
        canAfford: canAfford(s.cost),
      };
    });
  }

  /**
   * Validate + spend + start a clear timer. Sandbox finishes instantly.
   * @returns {{ success: boolean, reason?: string }}
   */
  requestClear(id, { hqLevel, rm, sandbox }) {
    const gate = this.canClear(id, hqLevel);
    if (!gate.ok) return { success: false, reason: gate.reason };
    const s = SECTOR_BY_ID.get(id);
    if (!rm.canAfford(s.cost)) return { success: false, reason: 'Insufficient resources.' };
    rm.spend(s.cost);
    const now = Date.now();
    this._clearing.set(id, now + (sandbox ? 0 : s.clearTimeSec * 1000));
    eventBus.emit('city:sectorsChanged');
    return { success: true };
  }

  /** Complete every clear due by nowMs. @returns {string[]} newly cleared ids. */
  update(nowMs) {
    const done = [];
    for (const [id, endsAt] of this._clearing) {
      if (endsAt <= nowMs) { this._clearing.delete(id); this._cleared.add(id); done.push(id); }
    }
    return done;
  }

  /** Force-clear a sector immediately (grandfathering / dev). */
  markCleared(id) {
    if (!SECTOR_BY_ID.has(id)) return;
    this._clearing.delete(id);
    this._cleared.add(id);
  }

  /** Auto-clear any sector overlapped by a placed footprint (no stranded buildings). */
  reconcile(placedRects) {
    for (const r of placedRects) {
      for (let y = r.cy; y < r.cy + r.h; y++)
        for (let x = r.cx; x < r.cx + r.w; x++) {
          const id = sectorIdAt(x, y);
          if (id) this._cleared.add(id);
        }
    }
  }

  serialize() {
    const clearing = {};
    for (const [id, endsAt] of this._clearing) clearing[id] = endsAt;
    return { cleared: [...this._cleared], clearing };
  }

  deserialize(data, placedRects = []) {
    this._cleared = new Set();
    this._clearing = new Map();
    for (const id of data?.cleared ?? []) if (SECTOR_IDS.includes(id)) this._cleared.add(id);
    for (const [id, endsAt] of Object.entries(data?.clearing ?? {})) {
      if (SECTOR_IDS.includes(id) && typeof endsAt === 'number' && !this._cleared.has(id)) {
        this._clearing.set(id, endsAt);
      }
    }
    this.reconcile(placedRects);
  }
}
