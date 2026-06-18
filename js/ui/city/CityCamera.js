/**
 * CityCamera.js
 * Camera state + math for the iso city view: pan offset, zoom,
 * world↔screen mapping. Input handling lives in CityRenderer.
 *
 * Genre rule: the player is always INSIDE the base — the camera can never
 * frame the map floating in a void.
 *   · zoom floor = "cover": terrain always fills 100% of the viewport
 *     (computed in diamond space, where the terrain is an axis-aligned box)
 *   · pan clamp keeps every corner of the visible viewport on terrain
 *
 * screen = world · zoom + offset   (offset in CSS px)
 */
import { uvRanges, worldToUV, uvShiftToWorld } from './isoMath.js';

const MAX_ZOOM = 2.0;

// Pan clamp model — "searchlight", not "sun". Instead of pinning every viewport
// corner onto terrain (which strangles the short/vertical axis), we let the frame
// overhang the island edge by up to this fraction of the viewport on each side.
// Terrain (incl. the decorative ring) still fills the great majority of the frame;
// only a small wedge of backdrop shows at the very extremes. 0 = old cover clamp.
const EDGE_OVERHANG = 0.22;

export class CityCamera {
  constructor(onChange) {
    this.x = 0;          // screen-px offset
    this.y = 0;
    this.zoom = 1;
    this._viewW = 0;
    this._viewH = 0;
    this._onChange = onChange ?? (() => {});
  }

  /** Cover zoom: smallest zoom at which the viewport still fits on terrain. */
  minZoom() {
    if (!this._viewW || !this._viewH) return 0.5;
    const r = uvRanges();
    // An axis-aligned viewport rect spans (vw/66 + vh/33)/zoom in BOTH u and v.
    const span = this._viewW / 66 + this._viewH / 33;
    // ×1.12 keeps pan slack in BOTH axes at the zoom floor — at the exact
    // cover zoom the viewport pins one axis and the map can't pan that way.
    const min  = (span / Math.min(r.u1 - r.u0, r.v1 - r.v0)) * 1.12;
    return Math.min(min, MAX_ZOOM); // never invert the zoom range
  }

  maxZoom() {
    return Math.max(MAX_ZOOM, this.minZoom());
  }

  setViewport(w, h) {
    this._viewW = w;
    this._viewH = h;
    this.zoom = Math.max(this.minZoom(), Math.min(this.maxZoom(), this.zoom));
    this._clamp();
  }

  screenToWorld(sx, sy) {
    return { x: (sx - this.x) / this.zoom, y: (sy - this.y) / this.zoom };
  }

  worldToScreen(wx, wy) {
    return { x: wx * this.zoom + this.x, y: wy * this.zoom + this.y };
  }

  panBy(dx, dy) {
    this.x += dx;
    this.y += dy;
    this._clamp();
    this._onChange();
  }

  /** Zoom by `factor`, keeping the screen point (sx, sy) stationary. */
  zoomAt(sx, sy, factor) {
    const prev = this.zoom;
    this.zoom = Math.max(this.minZoom(), Math.min(this.maxZoom(), prev * factor));
    if (this.zoom === prev) return;
    this.x = sx - (sx - this.x) * (this.zoom / prev);
    this.y = sy - (sy - this.y) * (this.zoom / prev);
    this._clamp();
    this._onChange();
  }

  /**
   * Frame a world point: center of viewport, raised by `biasUpPx`.
   * Used for the HQ "home" shot and tutorial focus.
   */
  centerOn(wx, wy, biasUpPx = 0, zoom = null) {
    if (zoom !== null) {
      this.zoom = Math.max(this.minZoom(), Math.min(this.maxZoom(), zoom));
    }
    this.x = this._viewW / 2 - wx * this.zoom;
    this.y = this._viewH / 2 - wy * this.zoom - biasUpPx;
    this._clamp();
    this._onChange();
  }

  /**
   * Keep the whole visible viewport on terrain. The terrain is an
   * axis-aligned box in diamond space (u, v); the viewport rect's (u, v)
   * extent is computed from its corners, the overshoot converted back to a
   * world shift via the closed form in uvShiftToWorld.
   */
  _clamp() {
    if (!this._viewW || !this._viewH) return;
    const r  = uvRanges();
    const tl = this.screenToWorld(0, 0);
    const br = this.screenToWorld(this._viewW, this._viewH);
    const tr = this.screenToWorld(this._viewW, 0);
    const bl = this.screenToWorld(0, this._viewH);

    const uvs = [tl, tr, bl, br].map(p => worldToUV(p.x, p.y));
    const u0 = Math.min(...uvs.map(p => p.u)), u1 = Math.max(...uvs.map(p => p.u));
    const v0 = Math.min(...uvs.map(p => p.v)), v1 = Math.max(...uvs.map(p => p.v));

    // Allowed overhang per axis = fraction of the viewport's own (u, v) span, so
    // the frame may slide this far past the island edge before being blocked.
    const overU = EDGE_OVERHANG * (u1 - u0);
    const overV = EDGE_OVERHANG * (v1 - v0);

    const correct = (lo, hi, LO, HI) => {
      if (hi - lo > HI - LO) return ((LO + HI) - (lo + hi)) / 2; // overflow: center
      if (lo < LO) return LO - lo;
      if (hi > HI) return HI - hi;
      return 0;
    };
    const du = correct(u0, u1, r.u0 - overU, r.u1 + overU);
    const dv = correct(v0, v1, r.v0 - overV, r.v1 + overV);
    if (!du && !dv) return;

    // Shift the *view window* by (du, dv) ⇒ shift the offset the other way.
    const { dx, dy } = uvShiftToWorld(du, dv);
    this.x -= dx * this.zoom;
    this.y -= dy * this.zoom;
  }
}
