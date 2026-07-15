/**
 * cityAmbient.js
 * Atmosphere for the base city view: the overcast slate/ash backdrop behind the
 * terrain and the day/night cycle (window lights + an amber-dusk veil). Read-only —
 * draws into CityRenderer's context; no scene state of its own beyond the
 * cached backdrop gradient.
 *
 * Collaborator of CityRenderer — holds a back-reference for canvas/context and
 * the shared object cull margins (viewport culling for the window-light pass).
 */
import { tileToWorld } from "./isoMath.js";

const DAY_CYCLE_MS = 8 * 60 * 1000; // full day/night loop
const MAX_NIGHT = 0.32; // peak darkness alpha

export class CityAmbient {
  constructor(renderer, cullObject) {
    this._r = renderer;
    this._cull = cullObject;
    this._backdrop = null;
    this._backdropH = 0;
  }

  /**
   * Ambient backdrop behind the terrain. With the searchlight pan clamp the frame
   * can extend a little past the island at the extremes; a soft twilight gradient
   * makes that read as sky/water rather than an empty void. Cached per canvas height.
   */
  fillBackdrop() {
    const ctx = this._r._ctx;
    const canvas = this._r._canvas;
    const w = canvas.width, h = canvas.height;
    if (!this._backdrop || this._backdropH !== h) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0,   'hsl(215, 10%, 17%)');
      g.addColorStop(0.5, 'hsl(220, 8%, 11%)');
      g.addColorStop(1,   'hsl(30, 8%, 6%)');
      this._backdrop  = g;
      this._backdropH = h;
    }
    ctx.fillStyle = this._backdrop;
    ctx.fillRect(0, 0, w, h);
  }

  drawNight(now) {
    const night = this._nightAmount(Date.now());
    if (night < 0.02) return;
    const r = this._r;
    const ctx = r._ctx;

    // window lights on built buildings (additive, twinkling)
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const view = r._viewWorldRect();
    for (const slot of r._slots) {
      if (slot.level <= 0) continue;
      const c = tileToWorld(slot.col, slot.row);
      if (!r._inView(c, this._cull, view)) continue;
      const seed = slot.col * 7 + slot.row * 13;
      for (let i = 0; i < 3; i++) {
        const tw = 0.5 + 0.5 * Math.sin(now / 700 + seed + i * 2.4);
        ctx.fillStyle = `rgba(255, 200, 110, ${(0.25 + 0.3 * tw) * (night / MAX_NIGHT)})`;
        ctx.beginPath();
        ctx.arc(
          c.x - 24 + i * 22 + ((seed + i) % 7),
          c.y - 18 - ((seed * (i + 1)) % 16),
          2.2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    ctx.restore();

    // amber-dusk multiply veil — permanent overcast, warm at the darkest point
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = `rgba(150, 110, 75, ${night})`;
    ctx.fillRect(0, 0, r._canvas.width, r._canvas.height);
    ctx.restore();
  }

  _nightAmount(now) {
    const t = ((now % DAY_CYCLE_MS) / DAY_CYCLE_MS) * Math.PI * 2;
    return Math.max(0, Math.sin(t)) * MAX_NIGHT;
  }
}
