/**
 * ui/world/WorldCamera.js
 * Top-down pan/zoom camera for the world map. Same shape as CityCamera but with
 * a plain scale+translate projection and a rectangular bounds clamp.
 *
 * screen = world · zoom + offset (offset in CSS px). The cover-zoom floor keeps
 * the map filling the viewport (no void); the clamp keeps the viewport inside
 * the map bounds.
 */
import { WORLD_MAP } from '../../entities/GAME_DATA.js';

const MAX_ZOOM = 1.6;

export class WorldCamera {
  constructor(onChange) {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this._viewW = 0;
    this._viewH = 0;
    this._onChange = onChange ?? (() => {});
  }

  /** Cover floor: smallest zoom at which the map still fills the viewport. */
  minZoom() {
    const { w, h } = WORLD_MAP.bounds;
    if (!this._viewW || !this._viewH) return 0.3;
    return Math.max(this._viewW / w, this._viewH / h);
  }

  maxZoom() { return Math.max(MAX_ZOOM, this.minZoom()); }

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

  zoomAt(sx, sy, factor) {
    const prev = this.zoom;
    this.zoom = Math.max(this.minZoom(), Math.min(this.maxZoom(), prev * factor));
    if (this.zoom === prev) return;
    this.x = sx - (sx - this.x) * (this.zoom / prev);
    this.y = sy - (sy - this.y) * (this.zoom / prev);
    this._clamp();
    this._onChange();
  }

  /** Center the viewport on a world point (optionally at a given zoom). */
  centerOn(wx, wy, zoom = null) {
    if (zoom !== null) this.zoom = Math.max(this.minZoom(), Math.min(this.maxZoom(), zoom));
    this.x = this._viewW / 2 - wx * this.zoom;
    this.y = this._viewH / 2 - wy * this.zoom;
    this._clamp();
    this._onChange();
  }

  /** Visible world-space rect (for culling). */
  visibleWorldRect() {
    const tl = this.screenToWorld(0, 0);
    const br = this.screenToWorld(this._viewW, this._viewH);
    return { minX: tl.x, minY: tl.y, maxX: br.x, maxY: br.y };
  }

  _clamp() {
    if (!this._viewW || !this._viewH) return;
    const { w, h } = WORLD_MAP.bounds;
    const minX = this._viewW - w * this.zoom; // ≤ 0 below cover floor
    const minY = this._viewH - h * this.zoom;
    this.x = minX >= 0 ? minX / 2 : Math.min(0, Math.max(minX, this.x));
    this.y = minY >= 0 ? minY / 2 : Math.min(0, Math.max(minY, this.y));
  }
}
