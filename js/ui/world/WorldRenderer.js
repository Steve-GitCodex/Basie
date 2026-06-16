/**
 * ui/world/WorldRenderer.js
 * Canvas-2D top-down renderer for the world map (#view-world). Presenter-tier:
 * reads WorldMapManager + MarchManager snapshots, never mutates state; intents
 * flow out through the callbacks supplied by WorldMapUI.
 *
 * Layers: terrain → region circles (faction/owned shading + label) → POI markers
 * (icon + faction ring + state) → active march arcs with a moving army token →
 * hover/selection highlight. Terrain/regions render in world space; markers and
 * arcs render in screen space so icons stay legible at every zoom.
 */
import { WORLD_MAP } from '../../entities/GAME_DATA.js';
import { WorldCamera } from './WorldCamera.js';
import { hitTestPOI, arcPoint } from './worldProjection.js';

const TAP_SLOP_PX = 6;
const TAP_MAX_MS = 500;
const POI_PICK_RADIUS = 42;   // world px
const MARKER_R = 16;          // screen px
const HOME_ZOOM = 0.7;

export class WorldRenderer {
  constructor(opts) {
    this._wm = opts.wm;
    this._mm = opts.mm;
    this._host = opts.host;
    this._onPoiClick = opts.onPoiClick ?? (() => {});
    this._onPoiHover = opts.onPoiHover ?? (() => {});
    this._onEmptyClick = opts.onEmptyClick ?? (() => {});

    this.ready = false;
    this._camera = new WorldCamera(() => { this._dirty = true; });
    this._pois = WORLD_MAP.pois;
    this._regions = WORLD_MAP.regions;
    this._selected = null;
    this._hovered = null;

    this._raf = 0;
    this._running = false;
    this._dirty = true;
    this._pointers = new Map();
    this._drag = null;
    this._lastTs = 0;
  }

  init() {
    this._canvas = this._host.querySelector('#world-canvas');
    if (!this._canvas) return;
    this._ctx = this._canvas.getContext('2d');
    this._dpr = Math.min(2, window.devicePixelRatio || 1);
    this._bindInput();
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this._host);
    this._resize();
    this.home();
    this.ready = true;
    this.start();
  }

  destroy() { this.stop(); this._ro?.disconnect(); }

  // ── Public API ────────────────────────────────────────────────────────────
  start() {
    if (this._running) return;
    this._running = true;
    this._lastTs = performance.now();
    const loop = (ts) => { if (!this._running) return; this._frame(ts); this._raf = requestAnimationFrame(loop); };
    this._raf = requestAnimationFrame(loop);
  }
  stop() { this._running = false; cancelAnimationFrame(this._raf); }

  setSelected(poiId) { this._selected = poiId; this._dirty = true; }
  syncState() { this._dirty = true; }

  /** Frame the home city. */
  home() { this._camera.centerOn(WORLD_MAP.home.x, WORLD_MAP.home.y, HOME_ZOOM); }

  centerOnPOI(poiId) {
    const p = this._pois.find(p => p.id === poiId);
    if (p) this._camera.centerOn(p.x, p.y);
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  _bindInput() {
    const cv = this._canvas;
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this._pointers.size === 1) {
        this._drag = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, t: performance.now(), moved: false };
      }
    });
    cv.addEventListener('pointermove', (e) => {
      const p = this._pointers.get(e.pointerId);
      if (!p) { this._updateHover(e); return; }
      const prev = { ...p };
      p.x = e.clientX; p.y = e.clientY;
      if (this._pointers.size === 2) {
        const pts = [...this._pointers.values()];
        const other = pts.find(q => q !== p) ?? pts[0];
        const dPrev = Math.hypot(prev.x - other.x, prev.y - other.y);
        const dNow = Math.hypot(p.x - other.x, p.y - other.y);
        const rect = cv.getBoundingClientRect();
        const mid = { x: (p.x + other.x) / 2 - rect.left, y: (p.y + other.y) / 2 - rect.top };
        if (dPrev > 0) this._camera.zoomAt(mid.x, mid.y, dNow / dPrev);
        this._camera.panBy((p.x - prev.x) / 2, (p.y - prev.y) / 2);
        if (this._drag) this._drag.moved = true;
      } else if (this._drag) {
        const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y;
        this._drag.x = e.clientX; this._drag.y = e.clientY;
        if (Math.hypot(e.clientX - this._drag.startX, e.clientY - this._drag.startY) > TAP_SLOP_PX) {
          this._drag.moved = true; cv.style.cursor = 'grabbing'; this._setHover(null);
        }
        if (this._drag.moved) this._camera.panBy(dx, dy);
      }
    });
    const end = (e) => {
      const wasDrag = this._drag;
      this._pointers.delete(e.pointerId);
      if (this._pointers.size > 0) return;
      cv.style.cursor = 'grab';
      this._drag = null;
      if (wasDrag && !wasDrag.moved && performance.now() - wasDrag.t < TAP_MAX_MS) {
        const poi = this._poiAtClient(e.clientX, e.clientY);
        if (poi) this._onPoiClick(poi.id); else this._onEmptyClick();
      }
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', () => { if (!this._drag) this._setHover(null); });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = cv.getBoundingClientRect();
      this._camera.zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.1 : 0.9);
    }, { passive: false });
  }

  _poiAtClient(clientX, clientY) {
    const rect = this._canvas.getBoundingClientRect();
    const w = this._camera.screenToWorld(clientX - rect.left, clientY - rect.top);
    return hitTestPOI(w.x, w.y, this._pois, POI_PICK_RADIUS);
  }
  _updateHover(e) { this._setHover(this._poiAtClient(e.clientX, e.clientY)); }
  _setHover(poi) {
    const id = poi?.id ?? null;
    if (id === (this._hovered?.id ?? null)) return;
    this._hovered = poi;
    this._dirty = true;
    this._canvas.style.cursor = poi ? 'pointer' : 'grab';
    this._onPoiHover(id);
  }

  // ── Render loop ─────────────────────────────────────────────────────────────
  _resize() {
    const w = this._host.clientWidth, h = this._host.clientHeight;
    if (!w || !h) return;
    this._canvas.width = Math.round(w * this._dpr);
    this._canvas.height = Math.round(h * this._dpr);
    this._cssW = w; this._cssH = h;
    this._camera.setViewport(w, h);
    this._dirty = true;
  }

  _frame(ts) {
    if (!this.ready) return;
    const hasMarches = this._mm.activeMarches().length > 0;
    // redraw on change, or continuously while marches animate
    if (!this._dirty && !hasMarches) return;
    this._dirty = false;
    this._draw(ts);
  }

  _draw(now) {
    const ctx = this._ctx, cam = this._camera, z = cam.zoom * this._dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0e1f17'; // deep map sea/void backdrop
    ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);

    // World-space layers
    ctx.setTransform(z, 0, 0, z, cam.x * this._dpr, cam.y * this._dpr);
    this._drawTerrain();
    this._drawRegions();

    // Screen-space overlays (markers, arcs, labels)
    ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    this._drawMarchArcs(now);
    for (const poi of this._pois) this._drawMarker(poi);
  }

  _drawTerrain() {
    const { w, h } = WORLD_MAP.bounds;
    const ctx = this._ctx;
    ctx.fillStyle = '#1b3a2a';
    ctx.fillRect(0, 0, w, h);
    // subtle grid so panning reads as movement
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 200) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y <= h; y += 200) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  }

  _drawRegions() {
    const ctx = this._ctx;
    for (const r of this._regions) {
      const owned = this._wm.isPlayerOwned(r.id);
      const faction = WORLD_MAP.factions[r.factionId];
      const color = owned ? '#3ad17a' : (faction?.color ?? '#888');
      ctx.beginPath();
      ctx.arc(r.center.x, r.center.y, r.radius, 0, Math.PI * 2);
      ctx.fillStyle = this._alpha(color, 0.10);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = this._alpha(color, 0.5);
      ctx.setLineDash(owned ? [] : [14, 10]);
      ctx.stroke();
      ctx.setLineDash([]);
      // label
      ctx.fillStyle = this._alpha(color, 0.9);
      ctx.font = '600 26px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${r.name}${owned ? '  ✓' : ''}`, r.center.x, r.center.y - r.radius + 34);
    }
  }

  _drawMarker(poi) {
    const s = this._camera.worldToScreen(poi.x, poi.y);
    if (s.x < -40 || s.x > this._cssW + 40 || s.y < -40 || s.y > this._cssH + 40) return; // cull
    const ctx = this._ctx;
    const sel = this._selected === poi.id;
    const hov = this._hovered?.id === poi.id;
    const faction = WORLD_MAP.factions[this._wm.getRegion(poi.regionId)?.factionId];
    const ownedRegion = this._wm.isPlayerOwned(poi.regionId);
    const ring = poi.type === 'city' ? '#54d6ff' : (ownedRegion ? '#3ad17a' : (faction?.color ?? '#aaa'));

    // disc
    ctx.beginPath();
    ctx.arc(s.x, s.y, MARKER_R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8,16,12,0.82)';
    ctx.fill();
    ctx.lineWidth = sel ? 4 : (hov ? 3 : 2);
    ctx.strokeStyle = sel ? '#ffd34e' : ring;
    ctx.stroke();

    // icon
    ctx.font = '17px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(poi.icon ?? '•', s.x, s.y + 1);

    // state sub-badge
    this._drawMarkerState(poi, s);

    // label
    if (this._camera.zoom > 0.45 || sel || hov) {
      ctx.font = '600 11px Outfit, sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const tw = ctx.measureText(poi.name).width;
      ctx.fillRect(s.x - tw / 2 - 4, s.y + MARKER_R + 3, tw + 8, 15);
      ctx.fillStyle = '#dfe9f5';
      ctx.fillText(poi.name, s.x, s.y + MARKER_R + 5);
    }
    ctx.textBaseline = 'alphabetic';
  }

  _drawMarkerState(poi, s) {
    const ctx = this._ctx;
    if (poi.type === 'resource_node') {
      const st = this._wm.getPOIState(poi.id);
      const pct = st ? Math.max(0, Math.min(1, st.remaining / poi.capacity)) : 1;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(s.x - MARKER_R, s.y - MARKER_R - 6, MARKER_R * 2, 3);
      ctx.fillStyle = '#8fd66a';
      ctx.fillRect(s.x - MARKER_R, s.y - MARKER_R - 6, MARKER_R * 2 * pct, 3);
    } else if (poi.type === 'camp' || poi.type === 'stronghold') {
      if (!this._wm.isHostileAvailable(poi.id)) { // cleared / respawning
        ctx.font = '12px Outfit, sans-serif';
        ctx.fillStyle = '#9bf3c0';
        ctx.fillText('✓', s.x + MARKER_R - 2, s.y - MARKER_R + 4);
      }
    }
  }

  _drawMarchArcs(now) {
    const ctx = this._ctx;
    const home = WORLD_MAP.home;
    for (const m of this._mm.activeMarches()) {
      const poi = this._pois.find(p => p.id === m.targetPoiId);
      if (!poi) continue;
      const ts = Date.now();
      // position along the home→target arc (param 0 at home, 1 at target)
      let pos;
      if (m.phase === 'outbound')      pos = this._clamp01((ts - m.departAt) / (m.arriveAt - m.departAt));
      else if (m.phase === 'acting')   pos = 1;
      else /* returning */             pos = 1 - this._clamp01((ts - m.actUntil) / (m.returnAt - m.actUntil));

      // arc line
      ctx.beginPath();
      const steps = 24;
      for (let i = 0; i <= steps; i++) {
        const wp = arcPoint(home.x, home.y, poi.x, poi.y, i / steps);
        const sp = this._camera.worldToScreen(wp.x, wp.y);
        i === 0 ? ctx.moveTo(sp.x, sp.y) : ctx.lineTo(sp.x, sp.y);
      }
      ctx.strokeStyle = m.type === 'attack' ? 'rgba(255,120,90,0.55)' : 'rgba(120,210,255,0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // army token at the current position along the arc
      const wp = arcPoint(home.x, home.y, poi.x, poi.y, pos);
      const sp = this._camera.worldToScreen(wp.x, wp.y);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = m.type === 'attack' ? '#ff6b5a' : '#6bd4ff';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  _clamp01(v) { return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0; }

  _alpha(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }
}
