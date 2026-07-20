/**
 * cityGhost.js
 * Move-placement ghost for the base city view (ADR 0022). Enter with a building
 * instance; the ghost footprint follows the pointer snapped to cells, filled
 * green when the target rect is free + in bounds and red otherwise. Commit places
 * the move through the manager; tap-away cancels.
 *
 * Collaborator of CityRenderer — uses its footprint geometry helpers + camera.
 */
import { clampRect } from '../../entities/GAME_DATA.js';
import { buildingIdOf } from '../../systems/building/cityPacker.js';

export class CityGhost {
  constructor(renderer) {
    this._r = renderer;
    this._active = null;
  }

  get active() { return this._active != null; }

  enter(instanceId) {
    const rect = this._r._bm.rectOf(instanceId);
    if (!rect) return;
    this._active = {
      instanceId,
      buildingId: buildingIdOf(instanceId),
      level:      this._r._bm.getInstanceLevelOf(instanceId),
      cx: rect.cx, cy: rect.cy, w: rect.w, h: rect.h,
      valid: true,
    };
    this._r._dirty = true;
  }

  cancel() {
    if (!this._active) return;
    this._active = null;
    this._r._dirty = true;
  }

  updateAt(clientX, clientY) {
    if (!this._active) return;
    const r = this._r;
    const base = r._canvas.getBoundingClientRect();
    const wpt = r._camera.screenToWorld(clientX - base.left, clientY - base.top);
    const cell = r._worldToCell(wpt.x, wpt.y);
    const g = this._active;
    const clamped = clampRect(Math.round(cell.cx - g.w / 2), Math.round(cell.cy - g.h / 2), g.w, g.h);
    g.cx = clamped.cx;
    g.cy = clamped.cy;
    g.valid = r._bm.rectFree(g.cx, g.cy, g.w, g.h, g.instanceId);
    r._dirty = true;
  }

  /** Returns {instanceId, cx, cy} to commit (valid target only), or null. */
  commit() {
    const g = this._active;
    this._active = null;
    this._r._dirty = true;
    if (!g || !g.valid) return null;
    return { instanceId: g.instanceId, cx: g.cx, cy: g.cy };
  }

  draw(ctx) {
    const g = this._active;
    if (!g) return;
    const img = this._r._grade.building(g.buildingId, g.level);
    const front = this._r._frontWorld(g);
    if (img) {
      ctx.globalAlpha = 0.55;
      ctx.drawImage(img, front.x - img.width / 2, front.y - img.height, img.width, img.height);
      ctx.globalAlpha = 1;
    }
    ctx.save();
    ctx.strokeStyle = g.valid ? 'rgba(120, 255, 170, 0.95)' : 'rgba(255, 110, 90, 0.95)';
    ctx.fillStyle   = g.valid ? 'rgba(60, 200, 120, 0.28)'  : 'rgba(200, 60, 50, 0.28)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    this._r._footprintPath(g);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
