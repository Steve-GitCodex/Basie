/**
 * placementStore.js
 * Owns building positions on the cell grid (ADR 0022): instanceId → {cx, cy}
 * plus footprint, with a collision test over the live rects. Positions are the
 * only spatial save state; footprints are re-attached from config on load.
 *
 * BuildingManager delegates here and keeps its public surface (emits
 * `building:relocated` on move itself). Serializes to a plain {cx, cy} map.
 */
import { rectsOverlap, inBounds } from '../../entities/data/cityGrid.js';

export class PlacementStore {
  constructor() {
    /** @type {Map<string, {cx:number, cy:number, w:number, h:number}>} */
    this._rects = new Map();
  }

  has(instanceId) { return this._rects.has(instanceId); }

  positionOf(instanceId) {
    const r = this._rects.get(instanceId);
    return r ? { cx: r.cx, cy: r.cy } : null;
  }

  rectOf(instanceId) {
    const r = this._rects.get(instanceId);
    return r ? { ...r } : null;
  }

  /** All live rects (with instanceId) — occupancy source for the packer/renderer. */
  rects() {
    return [...this._rects.entries()].map(([instanceId, r]) => ({ instanceId, ...r }));
  }

  /** Is the footprint at (cx,cy,w,h) inside bounds and clear of every rect but `exceptId`? */
  rectFree(cx, cy, w, h, exceptId = null) {
    if (!inBounds(cx, cy, w, h)) return false;
    const cand = { cx, cy, w, h };
    for (const [id, r] of this._rects) {
      if (id === exceptId) continue;
      if (rectsOverlap(cand, r)) return false;
    }
    return true;
  }

  place(instanceId, cx, cy, w, h) {
    this._rects.set(instanceId, { cx, cy, w, h });
  }

  move(instanceId, cx, cy) {
    const r = this._rects.get(instanceId);
    if (!r) return false;
    r.cx = cx;
    r.cy = cy;
    return true;
  }

  remove(instanceId) { this._rects.delete(instanceId); }

  /** @returns {{[instanceId:string]: {cx:number, cy:number}}} */
  serialize() {
    const out = {};
    for (const [id, r] of this._rects) out[id] = { cx: r.cx, cy: r.cy };
    return out;
  }
}
