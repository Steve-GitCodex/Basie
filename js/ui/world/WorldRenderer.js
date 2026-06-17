/**
 * ui/world/WorldRenderer.js
 * Canvas-2D top-down renderer for the world map (#view-world). Presenter-tier:
 * reads WorldMapManager + MarchManager snapshots, never mutates state; intents
 * flow out through the callbacks supplied by WorldMapUI.
 *
 * Layers: terrain → region territories (organic polygon fill + glow rim + label)
 * → POI markers (icon + faction ring + level badge + state) → march arcs →
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
    // No bounded "playfield" rectangle — that read as an outer box around the
    // tiles. The backdrop sea (painted in _draw) extends seamlessly; each region
    // tile is its own inked land mass floating on it, gutters are open sea.
    // (intentionally empty)
  }

  _drawRegions() {
    const ctx = this._ctx;
    for (const r of this._regions) this._drawRegionTile(r);
  }

  _drawRegionTile(r) {
    const ctx = this._ctx;
    const owned = this._wm.isPlayerOwned(r.id);
    const ruin = !!r.isCommandCenter;
    const faction = WORLD_MAP.factions[r.factionId];
    const color = owned ? '#3ad17a' : (ruin ? '#9aa0a8' : (faction?.color ?? '#888'));
    const locked = !owned && !this._wm.isRegionUnlocked(r.id);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // solid land body: a warm land base, then a faction-coloured tint
    this._traceRegion(ctx, r);
    ctx.fillStyle = '#222c26';
    ctx.fill();
    this._traceRegion(ctx, r);
    ctx.fillStyle = this._alpha(color, owned ? 0.30 : 0.20);
    ctx.fill();

    // hand-drawn map border: a thick dark ink outline, then a thinner faction line
    // sitting inside it (matte, not neon).
    this._traceRegion(ctx, r);
    ctx.lineWidth = ruin ? 13 : 11;
    ctx.strokeStyle = `rgba(9,13,11,${locked ? 0.7 : 0.92})`;
    ctx.stroke();
    this._traceRegion(ctx, r);
    ctx.lineWidth = ruin ? 4 : 3;
    ctx.strokeStyle = this._alpha(color, locked ? 0.45 : (owned ? 0.95 : 0.8));
    ctx.stroke();

    // ruin "ready to assault" pulse (unlocked but still unowned)
    if (ruin && !owned && !locked) {
      const pulse = 0.3 + 0.4 * Math.sin(Date.now() / 380);
      this._traceRegion(ctx, r);
      ctx.lineWidth = 4;
      ctx.strokeStyle = this._alpha('#ffd34e', pulse);
      ctx.stroke();
    }

    // locked overlay dims the tile + adds a lock glyph
    if (locked) {
      this._traceRegion(ctx, r);
      ctx.fillStyle = 'rgba(6,12,10,0.45)';
      ctx.fill();
    }

    // label at the centroid
    const c = this._centroid(r);
    ctx.textAlign = 'center';
    if (locked) {
      ctx.font = '30px Outfit, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText('🔒', c.x, c.y - 22);
    }
    ctx.fillStyle = this._alpha(color, locked ? 0.7 : 0.95);
    ctx.font = `700 ${ruin ? 30 : 28}px Outfit, sans-serif`;
    ctx.fillText(`${r.name}${owned ? '  ✓' : ''}`, c.x, c.y);
  }

  _centroid(r) {
    const c = r.rect;
    if (!c) return { x: r.center.x, y: r.center.y };
    return { x: (c.x0 + c.x1) / 2, y: (c.y0 + c.y1) / 2 };
  }

  /** Trace a region's hand-drawn outline as a closed polyline (round joins soften
   *  it). The points already carry the organic warp + seam inset, and seams stay
   *  matched because the warp is a continuous field shared by both neighbours. */
  _traceRegion(ctx, r) {
    const pts = this._outline(r);
    ctx.beginPath();
    if (!pts) { ctx.arc(r.center.x, r.center.y, r.radius ?? 400, 0, Math.PI * 2); return; }
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  // A continuous warp field applied to ALL tiles so a border shared by two cells
  // gets the same displacement from both sides → tiles stay tessellated while their
  // straight cell edges read as organic hand-drawn curves.
  _warpX(x, y) { return 30 * Math.sin(0.0034 * y + 1.3) + 16 * Math.sin(0.0072 * x + 0.6); }
  _warpY(x, y) { return 30 * Math.sin(0.0031 * x + 2.1) + 16 * Math.sin(0.0067 * y + 1.9); }

  /** Build a region tile outline from its `rect`: subdivide the perimeter, warp each
   *  sample by the shared field, then inset toward the centroid so a thin seam shows
   *  between neighbours. Cached per region id (stable across frames). */
  _outline(r) {
    const c = r.rect;
    if (!c) return null;
    this._outlineCache ??= new Map();
    const hit = this._outlineCache.get(r.id);
    if (hit) return hit;

    const STEP = 90;   // perimeter sample spacing (world px)
    const SEAM = 11;   // radial inset → ~2·SEAM thin seam between neighbours
    const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
    const raw = [];
    const edge = (x0, y0, x1, y1) => {
      const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / STEP));
      for (let i = 0; i < n; i++) { const t = i / n; raw.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]); }
    };
    edge(c.x0, c.y0, c.x1, c.y0); // top
    edge(c.x1, c.y0, c.x1, c.y1); // right
    edge(c.x1, c.y1, c.x0, c.y1); // bottom
    edge(c.x0, c.y1, c.x0, c.y0); // left

    const out = raw.map(([x, y]) => {
      const wx = x + this._warpX(x, y);
      const wy = y + this._warpY(x, y);
      const dx = cx - wx, dy = cy - wy, d = Math.hypot(dx, dy) || 1;
      return [wx + (dx / d) * SEAM, wy + (dy / d) * SEAM];
    });
    this._outlineCache.set(r.id, out);
    return out;
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

    // level badge (diamond, upper-left) — skip the player city
    if (poi.type !== 'city' && poi.level != null) {
      this._drawLevelBadge(s, poi.level, ring);
    }

    // label — prefix with the controlling faction's [TAG]
    if (this._camera.zoom > 0.45 || sel || hov) {
      const tag = poi.type === 'city' ? '' : (faction?.tag ? `[${faction.tag}] ` : '');
      const label = `${tag}${poi.name}`;
      ctx.font = '600 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const tw = ctx.measureText(label).width;
      ctx.fillRect(s.x - tw / 2 - 4, s.y + MARKER_R + 3, tw + 8, 15);
      ctx.fillStyle = '#dfe9f5';
      ctx.fillText(label, s.x, s.y + MARKER_R + 5);
    }
    ctx.textBaseline = 'alphabetic';
  }

  _drawLevelBadge(s, level, color) {
    const ctx = this._ctx;
    const bx = s.x - MARKER_R - 1, by = s.y - MARKER_R - 1, r = 9;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(-r, -r, r * 2, r * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.font = '700 11px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(String(level), bx, by + 0.5);
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
