/**
 * ui/world/WorldCamera.js
 * Top-down pan/zoom camera for the world map. Same shape as CityCamera but with
 * a plain scale+translate projection and a rectangular bounds clamp.
 *
 * screen = world · zoom + offset (offset in CSS px). The map is a set of tile
 * regions separated by sea gutters, so (unlike the city) the floor is a CONTAIN
 * fit — you can zoom out to see the whole map — and the clamp allows panning a
 * sea margin beyond the map edges in every direction (free pan).
 */
import { WORLD_MAP } from '../../entities/GAME_DATA.js';

const MAX_ZOOM = 1.6;
const PAN_MARGIN = 700; // world px of sea you can pan past the map edge

export class WorldCamera {
  constructor(onChange) {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this._viewW = 0;
    this._viewH = 0;
    this._onChange = onChange ?? (() => {});
  }

  /** Contain floor: smallest zoom at which the whole map fits the viewport (with
   *  a little headroom so sea shows around it). */
  minZoom() {
    const { w, h } = WORLD_MAP.bounds;
    if (!this._viewW || !this._viewH) return 0.2;
    return Math.min(this._viewW / w, this._viewH / h) * 0.9;
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
    const M = PAN_MARGIN;
    // Keep the visible world rect within [-M, dim+M] on each axis: free pan up to a
    // sea margin past the map edge. When the map+margins are smaller than the
    // viewport (fully zoomed out), centre instead.
    const xMax = M * this.zoom;
    const xMin = this._viewW - (w + M) * this.zoom;
    const yMax = M * this.zoom;
    const yMin = this._viewH - (h + M) * this.zoom;
    this.x = xMin > xMax ? (xMin + xMax) / 2 : Math.min(xMax, Math.max(xMin, this.x));
    this.y = yMin > yMax ? (yMin + yMax) / 2 : Math.min(yMax, Math.max(yMin, this.y));
  }
}
