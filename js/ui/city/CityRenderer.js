/**
 * CityRenderer.js
 * Canvas-2D isometric renderer for the base city view (#view-base).
 *
 * Presenter-tier: reads BuildingManager state (placement rects + instance
 * status) via syncState(), never mutates game state. UI intents flow back
 * through the callbacks supplied by BuildingsUI. Runs its own rAF loop
 * (render-only) — game logic stays on the GameEngine fixed tick.
 *
 * Scene model (ADR 0022): free-placement footprints on the half-tile cell grid.
 * Each unlocked instance is a slot with a cell rect {cx,cy,w,h}; drawn as a
 * ghost outline (unbuilt), under-construction sprite, or built sprite. Sprites
 * bottom-center on the footprint's front (south) corner (ADR 0021). Move UX runs
 * through the CityGhost collaborator.
 *
 * Also maintains an inert "proxy layer" of absolutely-positioned divs
 * (.base-tile[data-building-id][data-instance-index]) tracking each instance's
 * footprint rect so the tutorial spotlight selectors keep working unchanged.
 */
import { eventBus } from "../../core/EventBus.js";
import {
  GRID_TILE_COLS, GRID_TILE_ROWS,
  rectFrontTile, rectCenterTile, rectCornersTile,
} from "../../entities/GAME_DATA.js";
import { TILE_W, TILE_H, tileToWorld, worldToTile } from "./isoMath.js";
import { CityCamera } from "./CityCamera.js";
import { CityAssets } from "./cityAssets.js";
import { CityGround, groundSignature } from "./cityGround.js";
import { deriveRoads } from "./cityRoads.js";
import { CityInput } from "./cityInput.js";
import { CityAgents } from "./cityAgents.js";
import { CityAmbient } from "./cityAmbient.js";
import { CityGrade } from "./cityGrade.js";
import { CityGhost } from "./cityGhost.js";
import { ParticleField } from "../fx/particles.js";

const LABEL_MIN_ZOOM = 0.65;
const HEADROOM = 2; // px above the diamond covered by a building sprite (proxy/hit rect)
const SPEEDUP_BADGE_R  = 11; // world-px radius of the ⏩ speed-up badge over a building
const SPEEDUP_BADGE_DY = 30; // world-px the badge centre sits above the building top
const HOME_ZOOM = 1.0;

// Viewport culling margins (world px). Generous on top so tall building
// sprites that rise above their tile still draw while their base is below
// the viewport.
const CULL_OBJECT = { halfW: 140, top: 320, bottom: 120 };

export class CityRenderer {
  /**
   * @param {{ bm, host: HTMLElement,
   *           onTileClick?: (bid:string, idx:number) => void,
   *           onTileHover?: (bid:string, idx:number) => void,
   *           onTileLeave?: () => void,
   *           onSpeedupClick?: (bid:string, idx:number, badgeRect:object) => void,
   *           onGhostCommit?: (instanceId:string, cx:number, cy:number) => void,
   *           onEmptyClick?: () => void }} opts
   */
  constructor(opts) {
    this._bm = opts.bm;
    this._host = opts.host;
    this._onTileClick = opts.onTileClick ?? (() => {});
    this._onTileHover = opts.onTileHover ?? (() => {});
    this._onTileLeave = opts.onTileLeave ?? (() => {});
    this._onSpeedupClick = opts.onSpeedupClick ?? (() => {});
    this._onGhostCommit = opts.onGhostCommit ?? (() => {});
    this._onEmptyClick = opts.onEmptyClick ?? (() => {});
    this._onSectorClick = opts.onSectorClick ?? (() => {});
    this._onSectorHover = opts.onSectorHover ?? (() => {});
    this._onSectorLeave = opts.onSectorLeave ?? (() => {});
    this._hoveredSectorId = null;

    this.ready = false;
    this._assets = new CityAssets();
    this._ground = new CityGround();
    this._camera = new CityCamera(() => {
      this._dirty = true;
      this._proxyDirty = true;
    });
    this._props = [];        // debris scatter on uncleared rubble sectors
    this._trees = [];        // edge-forest + rubble dead-tree props
    this._skeletonRoads = new Set();  // visible skeleton (ring + arterials)
    this._connectorRoads = new Set(); // door→skeleton connectors
    this._sectorList = [];   // rubble/clearing/cleared render records
    this._clearers = [];     // sectors mid-clear (construction dust + progress)

    this._input = new CityInput(this);
    this._agents = new CityAgents(this);
    this._ambient = new CityAmbient(this, CULL_OBJECT);
    this._grade = new CityGrade(this._assets);
    this._ghost = new CityGhost(this);

    this._dust = new ParticleField(120);  // screen-space ambient motes
    this._fx = new ParticleField(180);    // world-space smoke / construction dust
    this._pops = new Map();               // instanceId → tap-pop start ts
    this._smokeAcc = 0;
    this._buildAcc = 0;
    this._smokers = [];                   // built production slots (chimney smoke)
    this._builders = [];                  // slots under construction (dust)

    this._slots = []; // instance scene records, painter-sorted
    this._proxies = new Map(); // "bid_idx" → div
    this._hovered = null; // slot or null

    this._raf = 0;
    this._running = false;
    this._userInteracted = false; // set once the player pans/zooms; gates auto-home
    this._dirty = true;
    this._proxyDirty = true;
    this._lastAmbient = 0;
    this._renderedEmitAt = 0;
    this._lastTs = 0;
  }

  async init() {
    this._canvas = this._host.querySelector("#city-canvas");
    this._proxyEl = this._host.querySelector("#city-proxy-layer");
    this._loadEl = this._host.querySelector("#city-loading");
    if (!this._canvas) return;
    this._ctx = this._canvas.getContext("2d");
    this._dpr = Math.min(2, window.devicePixelRatio || 1);

    this._input.bind();
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this._host);
    this._loadEl?.classList.remove("hidden");

    await this._assets.load();
    await this._ground.load();
    await this._grade.load();
    this.ready = true;
    this._loadEl?.classList.add("hidden");

    this._resize();
    this.syncState();
    this.home();
    this.start();
  }

  destroy() {
    this.stop();
    this._ro?.disconnect();
    this._proxies.clear();
  }

  // ───────────────────────────────────────────
  // Scene state (read-only view of BuildingManager)
  // ───────────────────────────────────────────

  /** Re-derive instance scene records from manager state. Cheap; call on any building event. */
  syncState() {
    const types = this._bm.getBuildingTypesWithInstances();
    const rects = this._bm.getPlacementRects();

    this._syncSectors(rects);

    const instanceData = new Map(); // instanceId → { type, inst }
    for (const t of types) {
      for (const inst of t.instances)
        instanceData.set(inst.instanceId, { type: t, inst });
    }

    this._slots = [];
    for (const r of rects) {
      const data = instanceData.get(r.instanceId);
      if (!data) continue;
      const inst = data.inst;
      this._slots.push({
        instanceId: r.instanceId,
        buildingId: r.buildingId,
        instanceIndex: r.instanceIndex,
        cx: r.cx, cy: r.cy, w: r.w, h: r.h,
        zone: data.type.zone ?? null,
        name: inst.displayName ?? data.type.name,
        level: inst.level,
        isBuilding: inst.isActivelyBuilding,
        startedAt: inst.startedAt,
        endsAt: inst.constructionEndsAt,
      });
    }
    this._slots.sort((a, b) => this._frontSum(a) - this._frontSum(b));

    this._drawList = [
      ...this._slots.map((s) => ({ depth: this._frontSum(s), slot: s })),
      ...this._props.map((p) => ({ depth: p.col + p.row, prop: p })),
      ...(this._trees ?? []).map((p) => ({ depth: p.col + p.row, prop: p })),
    ].sort((a, b) => a.depth - b.depth);

    this._smokers = this._slots.filter(
      (s) => this._bm.zoneOfBuilding(s.buildingId) === "production" && s.level > 0,
    );
    this._builders = this._slots.filter((s) => s.isBuilding);

    this._dirty = true;
    this._proxyDirty = true;
  }

  /** Derive roads + rubble-sector render records from the current layout. */
  _syncSectors(rects) {
    const roads = deriveRoads(rects, (cx, cy) => this._bm.isCellCleared(cx, cy));
    this._skeletonRoads = roads.skeleton;
    this._connectorRoads = roads.connectors;
    this._agents.setRoads(roads.cells);

    this._sectorList = this._bm.getSectors().map((s) => ({
      ...s,
      state: s.cleared ? "cleared" : s.clearing ? "clearing" : "rubble",
      startedAt: s.clearing ? s.endsAt - s.clearTimeSec * 1000 : null,
    }));
    this._clearers = this._sectorList.filter((s) => s.state === "clearing");
    this._props = this._ground.debrisScatter(this._sectorList);
    this._trees = this._ground.treeScatter(this._sectorList);

    // Raster cache key: only a completed clear (state === 'cleared'), an extending
    // arterial, or a moved connector changes what the ground actually draws — a
    // clearing sector still draws as rubble (fixes the stale-rubble render bug).
    const clearedIds = this._sectorList.filter((s) => s.state === "cleared").map((s) => s.id);
    this._groundSig = groundSignature({
      clearedIds, skeleton: roads.skeleton, connectors: roads.connectors,
    });
  }

  _groundState() {
    return {
      skeleton: this._skeletonRoads,
      connectors: this._connectorRoads,
      isCleared: (cx, cy) => this._bm.isCellCleared(cx, cy),
      signature: this._groundSig,
    };
  }

  // ───────────────────────────────────────────
  // Footprint geometry (cells → world)
  // ───────────────────────────────────────────

  /** Painter-order key: front (south) corner tile-sum. */
  _frontSum(r) {
    const t = rectFrontTile(r.cx, r.cy, r.w, r.h);
    return t.col + t.row;
  }

  /** World point of the footprint's front (south) corner — sprite bottom-center. */
  _frontWorld(r) {
    const t = rectFrontTile(r.cx, r.cy, r.w, r.h);
    return tileToWorld(t.col, t.row);
  }

  /** World point of the footprint center — badges, plaques, hover, fx. */
  _centerWorld(r) {
    const t = rectCenterTile(r.cx, r.cy, r.w, r.h);
    return tileToWorld(t.col, t.row);
  }

  /** Four footprint corners (N/E/S/W) in world px. */
  _cornersWorld(r) {
    const c = rectCornersTile(r.cx, r.cy, r.w, r.h);
    return {
      n: tileToWorld(c.n.col, c.n.row),
      e: tileToWorld(c.e.col, c.e.row),
      s: tileToWorld(c.s.col, c.s.row),
      w: tileToWorld(c.w.col, c.w.row),
    };
  }

  /**
   * World-space draw box of a slot's sprite. The sprite's ground-contact centre
   * (rig-exported anchor) seats on the plot CENTRE, so the building sits centred on
   * its footprint at any size/level — not shoved to the front vertex (ADR 0022).
   */
  _spriteBox(slot, scale = 1) {
    const img = this._assets.building(slot.buildingId, slot.level);
    if (!img) return null;
    const a = this._assets.anchor(slot.buildingId, slot.level);
    const c = this._centerWorld(slot);
    const left = c.x - a.ax * scale;
    const top = c.y - a.ay * scale;
    const width = img.width * scale;
    const height = img.height * scale;
    return { left, top, width, height, right: left + width, bottom: top + height };
  }

  /** Top of the drawn building (sprite top, or footprint back corner if unbuilt). */
  _slotTopWorld(slot) {
    const box = slot.level > 0 ? this._spriteBox(slot) : null;
    if (box) return { x: box.left + box.width / 2, y: box.top };
    const c = this._cornersWorld(slot);
    return { x: this._centerWorld(slot).x, y: c.n.y };
  }

  _badgeWorld(slot) {
    const t = this._slotTopWorld(slot);
    return { x: t.x, y: t.y - SPEEDUP_BADGE_DY };
  }

  /** World cell coords under a world point. */
  _worldToCell(wx, wy) {
    const t = worldToTile(wx, wy);
    return { cx: t.col * 2, cy: t.row * 2 };
  }

  // ───────────────────────────────────────────
  // Public API for BuildingsUI
  // ───────────────────────────────────────────

  start() {
    if (this._running) return;
    this._running = true;
    this._lastTs = performance.now();
    const loop = (ts) => {
      if (!this._running) return;
      this._frame(ts);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this._running = false;
    cancelAnimationFrame(this._raf);
  }

  /** Frame the HQ — the genre-standard "home" shot. */
  home() {
    const hqSlot = this._slots.find((s) => s.buildingId === "townhall");
    const c = hqSlot
      ? this._centerWorld(hqSlot)
      : tileToWorld(GRID_TILE_COLS / 2, GRID_TILE_ROWS / 2);
    this._camera.centerOn(c.x, c.y, this._host.clientHeight * 0.06, HOME_ZOOM);
  }

  /** Re-frame the HQ on base re-entry unless the player has panned/zoomed. */
  homeIfUntouched() { if (!this._userInteracted) this.home(); }

  // ── Move-placement ghost ──────────────────────────────────────────
  get ghosting() { return this._ghost.active; }
  enterGhostMode(instanceId) { this._ghost.enter(instanceId); }
  cancelGhost() { this._ghost.cancel(); }
  _updateGhost(clientX, clientY) { this._ghost.updateAt(clientX, clientY); }
  _commitGhost() {
    const r = this._ghost.commit();
    if (r) this._onGhostCommit(r.instanceId, r.cx, r.cy);
  }

  /** Projected screen rect (viewport coords) of an assigned building's footprint. */
  getTileScreenRect(buildingId, instanceIndex) {
    const slot = this._slots.find(
      (s) => s.buildingId === buildingId && s.instanceIndex === instanceIndex,
    );
    return slot ? this._slotRect(slot) : null;
  }

  _slotRect(slot) {
    if (!this._canvas) return null;
    const base = this._canvas.getBoundingClientRect();
    const z = this._camera.zoom;
    const c = this._cornersWorld(slot);
    const pts = [c.n, c.e, c.s, c.w].map((p) => this._camera.worldToScreen(p.x, p.y));
    let left = Math.min(...pts.map((p) => p.x));
    let right = Math.max(...pts.map((p) => p.x));
    let top = Math.min(...pts.map((p) => p.y));
    let bottom = Math.max(...pts.map((p) => p.y));
    const box = slot.level > 0 ? this._spriteBox(slot) : null;
    if (box) {
      const t = this._camera.worldToScreen(box.left, box.top);
      const b = this._camera.worldToScreen(box.right, box.bottom);
      top = Math.min(top, t.y);
      left = Math.min(left, t.x);
      right = Math.max(right, b.x);
      bottom = Math.max(bottom, b.y);
    }
    return {
      left: base.left + left,
      top: base.top + top - HEADROOM * z,
      width: right - left,
      height: bottom - top + HEADROOM * z,
      get right() { return this.left + this.width; },
      get bottom() { return this.top + this.height; },
    };
  }

  /** Pan the camera so a building slot is comfortably visible. */
  centerOnTile(buildingId, instanceIndex = 0, biasUp = false) {
    const slot = this._slots.find(
      (s) => s.buildingId === buildingId && s.instanceIndex === instanceIndex,
    );
    if (!slot) return;
    const c = this._centerWorld(slot);
    this._camera.centerOn(c.x, c.y, biasUp ? this._host.clientHeight * 0.18 : 0);
  }

  // ───────────────────────────────────────────
  // Scene picking + hover (driven by CityInput)
  // ───────────────────────────────────────────

  _slotAtClient(clientX, clientY) {
    const rect = this._canvas.getBoundingClientRect();
    const w = this._camera.screenToWorld(clientX - rect.left, clientY - rect.top);
    // 1 — sprite-aware: a tall building's body rises above its footprint, so
    // test drawn sprite bounds front-to-back (front-most drawn wins).
    for (let i = this._slots.length - 1; i >= 0; i--) {
      const slot = this._slots[i];
      if (this._pointInSlotSprite(w.x, w.y, slot)) return slot;
    }
    // 2 — footprint fallback: which building's cell rect contains the point.
    const cell = this._worldToCell(w.x, w.y);
    return this._slotAtCell(cell.cx, cell.cy);
  }

  _slotAtCell(cx, cy) {
    for (let i = this._slots.length - 1; i >= 0; i--) {
      const s = this._slots[i];
      if (cx >= s.cx && cx < s.cx + s.w && cy >= s.cy && cy < s.cy + s.h) return s;
    }
    return null;
  }

  /** World point inside a slot's drawn building sprite rect? */
  _pointInSlotSprite(wx, wy, slot) {
    if (slot.level <= 0 && !slot.isBuilding) return false;
    const box = this._spriteBox(slot);
    if (!box) return false;
    return wx >= box.left && wx <= box.right && wy >= box.top && wy <= box.bottom;
  }

  _updateHover(e) {
    const slot = this._slotAtClient(e.clientX, e.clientY);
    this._setHover(slot);
    this._setSectorHover(slot ? null : this._sectorAtClient(e.clientX, e.clientY));
  }

  /** Transient sector-panel hover (rubble/clearing sectors) — pinned open only on tap. */
  _setSectorHover(sector) {
    const id = sector?.id ?? null;
    if (id === this._hoveredSectorId) return;
    this._hoveredSectorId = id;
    if (id) this._onSectorHover(id, this.getSectorScreenRect(id));
    else this._onSectorLeave();
  }

  _setHover(slot) {
    if (slot === this._hovered) return;
    this._hovered = slot;
    this._dirty = true;
    if (this._canvas) this._canvas.style.cursor = slot ? "pointer" : "grab";
    if (!slot) this._onTileLeave();
    else this._onTileHover(slot.buildingId, slot.instanceIndex);
  }

  // ───────────────────────────────────────────
  // Render loop
  // ───────────────────────────────────────────

  _resize() {
    const w = this._host.clientWidth;
    const h = this._host.clientHeight;
    if (!w || !h) return;
    this._canvas.width = Math.round(w * this._dpr);
    this._canvas.height = Math.round(h * this._dpr);
    this._camera.setViewport(w, h);
    this._cssW = w;
    this._cssH = h;
    this._dirty = true;
    this._proxyDirty = true;
  }

  /** Axis-aligned world-space rect currently visible (screen→world is unrotated). */
  _viewWorldRect() {
    const tl = this._camera.screenToWorld(0, 0);
    const br = this._camera.screenToWorld(this._cssW || 0, this._cssH || 0);
    return { minX: tl.x, maxX: br.x, minY: tl.y, maxY: br.y };
  }

  /** Is a point-centered object (with margins m) within the visible rect r? */
  _inView(c, m, r) {
    return (
      c.x + m.halfW >= r.minX &&
      c.x - m.halfW <= r.maxX &&
      c.y + m.bottom >= r.minY &&
      c.y - m.top <= r.maxY
    );
  }

  _frame(ts) {
    if (!this.ready) return;
    const dt = Math.max(0, Math.min(0.1, (ts - this._lastTs) / 1000));
    this._lastTs = ts;

    this._agents.update(dt);
    this._updateFx(dt);

    const ambientDue = ts - this._lastAmbient > 33;
    if (!this._dirty && !ambientDue) return;
    if (ambientDue) this._lastAmbient = ts;
    this._dirty = false;

    this._draw(ts);
    if (this._proxyDirty) this._syncProxies(ts);
  }

  _updateFx(dt) {
    this._dust.haze(dt, {
      w: this._cssW, h: this._cssH, rate: 2.5, speed: 4, wind: 5, life: 8,
      size: 1.3, color: "rgba(200,190,168,1)", alpha: 0.28,
    });
    this._smokeAcc += dt * 0.8 * this._smokers.length;
    while (this._smokeAcc >= 1) {
      this._smokeAcc -= 1;
      const s = this._smokers[(Math.random() * this._smokers.length) | 0];
      const c = this._centerWorld(s);
      this._fx.puff(c.x + TILE_W * 0.12, c.y - TILE_H * 0.75, {
        rise: 16, spread: 5, size: 3.2, life: 2.4, grow: 7,
        color: "rgba(66,62,56,1)", alpha: 0.34,
      });
    }
    this._buildAcc += dt * 2 * this._builders.length;
    while (this._buildAcc >= 1) {
      this._buildAcc -= 1;
      const s = this._builders[(Math.random() * this._builders.length) | 0];
      const c = this._centerWorld(s);
      this._fx.puff(c.x, c.y + TILE_H * 0.2, {
        rise: 9, spread: 12, jitter: TILE_W * 0.5, size: 2.4, life: 1.1, grow: 4,
        color: "rgba(150,138,116,1)", alpha: 0.3,
      });
    }
    this._clearAcc = (this._clearAcc ?? 0) + dt * 3 * this._clearers.length;
    while (this._clearAcc >= 1) {
      this._clearAcc -= 1;
      const s = this._clearers[(Math.random() * this._clearers.length) | 0];
      const c = tileToWorld(s.rect.cx / 2 + s.rect.w / 4, s.rect.cy / 2 + s.rect.h / 4);
      this._fx.puff(c.x, c.y, {
        rise: 7, spread: 16, jitter: TILE_W, size: 3, life: 1.3, grow: 6,
        color: "rgba(120,108,92,1)", alpha: 0.32,
      });
    }
    this._fx.update(dt);
  }

  /** Trigger the tap "pop" grow on a built building slot. */
  popTile(slot) {
    if (!slot || (slot.level <= 0 && !slot.isBuilding)) return;
    this._pops.set(slot.instanceId, performance.now());
    this._dirty = true;
  }

  _popScale(instanceId, now) {
    const start = this._pops.get(instanceId);
    if (start == null) return 1;
    const e = (now - start) / 260;
    if (e >= 1) { this._pops.delete(instanceId); return 1; }
    return 1 + 0.13 * Math.sin(Math.PI * e);
  }

  _draw(now) {
    const ctx = this._ctx;
    const cam = this._camera;
    const z = cam.zoom * this._dpr;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this._ambient.fillBackdrop();
    ctx.setTransform(z, 0, 0, z, cam.x * this._dpr, cam.y * this._dpr);
    ctx.imageSmoothingEnabled = true;

    const view = this._viewWorldRect();

    // 1 — textured ground: earth/cracked/ash cells, roads, rubble sectors (cached)
    this._ground.draw(ctx, this._groundState());

    // 2 — hover highlight under the building sprite
    if (this._hovered) this._drawHighlight(this._hovered);

    // 3 — objects: buildings + props (painter-sorted), agents interleaved
    const droneDepth = this._agents.droneDepth;
    let droneDrawn = false;
    const walkersToDraw = [...this._agents.walkers].sort(
      (a, b) => a.x + a.y - (b.x + b.y),
    );
    let wi = 0;
    for (const item of this._drawList ?? []) {
      while (
        wi < walkersToDraw.length &&
        walkersToDraw[wi].x + walkersToDraw[wi].y <= item.depth
      ) {
        this._agents.drawWalker(walkersToDraw[wi++], now);
      }
      if (!droneDrawn && item.depth > droneDepth) {
        this._agents.drawDrone(now);
        droneDrawn = true;
      }
      if (item.slot) {
        if (!this._inView(this._centerWorld(item.slot), CULL_OBJECT, view)) continue;
        this._drawSlot(item.slot, now);
      } else {
        if (!this._inView(tileToWorld(item.prop.col, item.prop.row), CULL_OBJECT, view)) continue;
        this._drawProp(item.prop);
      }
    }
    while (wi < walkersToDraw.length)
      this._agents.drawWalker(walkersToDraw[wi++], now);
    if (!droneDrawn) this._agents.drawDrone(now);

    // 3b — move-placement ghost, above buildings
    this._ghost.draw(ctx);

    // 4 — overlays: progress bars + level badges (always on top of sprites)
    for (const slot of this._slots) {
      if (!slot.isBuilding && slot.level <= 0) continue;
      if (!this._inView(this._centerWorld(slot), CULL_OBJECT, view)) continue;
      if (slot.isBuilding) this._drawProgress(slot, now);
      if (slot.level > 0 && slot !== this._hovered) this._drawLevelBadge(slot);
    }

    // 4a — rubble-sector clear progress
    for (const s of this._clearers) this._drawSectorProgress(s);

    // 4b — hovered building's name pill, on top
    const hv = this._hovered;
    if (hv && hv.name && (hv.isBuilding || hv.level > 0)) {
      const f = this._frontWorld(hv);
      this._drawNamePill(hv.name.toUpperCase(), f.x, f.y + 12);
    }

    // 5 — world-space particle fx (chimney smoke, construction dust)
    this._fx.draw(ctx);

    // 6 — day/night ambient tint + window lights
    this._ambient.drawNight(now);

    // 7 — grim-grade atmosphere: vignette + cold wash + horizon haze
    this._grade.drawOverlay(ctx, this._canvas.width, this._canvas.height);

    // 8 — screen-space ambient dust motes, on top of everything
    ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    this._dust.draw(ctx);
  }

  /** A dark rounded pill with the building name — used for the hovered tile. */
  _drawNamePill(text, cx, y) {
    const ctx = this._ctx;
    ctx.save();
    ctx.font = '700 9px Outfit, sans-serif';
    const w = ctx.measureText(text).width + 12;
    ctx.fillStyle = "rgba(8, 14, 24, 0.92)";
    ctx.strokeStyle = "rgba(0, 170, 255, 0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, y - 8, w, 16, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "hsl(200, 100%, 80%)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx, y);
    ctx.restore();
  }

  _drawSlot(slot, now) {
    const front = this._frontWorld(slot);
    const img = this._grade.building(slot.buildingId, slot.level);
    const pop = this._popScale(slot.instanceId, now);
    const drawBuilding = (image, alpha = 1) => {
      const ctx = this._ctx;
      const box = this._spriteBox(slot, pop);
      if (!box) return;
      if (alpha !== 1) ctx.globalAlpha = alpha;
      ctx.drawImage(image, box.left, box.top, box.width, box.height);
      if (alpha !== 1) ctx.globalAlpha = 1;
    };

    if (slot.level === 0 && !slot.isBuilding) {
      // Unlocked but unbuilt — surveyor's footprint outline + name (tutorial target)
      this._drawFootprintOutline(slot);
      const c = this._centerWorld(slot);
      this._drawText("+", c.x, c.y + 2, 14, "rgba(140,215,250,0.6)", "300");
      if (this._camera.zoom >= LABEL_MIN_ZOOM && slot.name) {
        this._drawText(
          slot.name.toUpperCase(),
          front.x,
          front.y + 11,
          8,
          "rgba(240,180,90,0.8)",
        );
      }
      return;
    }

    if (!img) {
      this._fallbackDiamond(this._centerWorld(slot), "#1d5d8a");
      return;
    }

    if (slot.level === 0 && slot.isBuilding) {
      drawBuilding(img, 0.35 + 0.15 * Math.sin(now / 300));
      this._drawFootprintOutline(slot);
      return;
    }

    drawBuilding(img);
    const c = this._centerWorld(slot);
    this._grade.drawPlaque(this._ctx, slot.buildingId, c.x + TILE_W / 4, c.y + TILE_H / 4);
  }

  /** Debris scatter on uncleared rubble sectors — bottom-anchored at the cell front. */
  _drawProp(prop) {
    const img = this._ground.debrisImage(prop.kind);
    if (!img) return;
    const c = tileToWorld(prop.col, prop.row);
    this._ctx.drawImage(img, c.x - img.width / 2, c.y + TILE_H / 2 - img.height);
  }

  /** Footprint-shaped path (N→E→S→W) in world px. */
  _footprintPath(slot) {
    const ctx = this._ctx;
    const c = this._cornersWorld(slot);
    ctx.beginPath();
    ctx.moveTo(c.n.x, c.n.y);
    ctx.lineTo(c.e.x, c.e.y);
    ctx.lineTo(c.s.x, c.s.y);
    ctx.lineTo(c.w.x, c.w.y);
    ctx.closePath();
  }

  // Surveyor's outline on the district ground for an unbuilt footprint.
  _drawFootprintOutline(slot) {
    const ctx = this._ctx;
    ctx.save();
    ctx.strokeStyle = "rgba(110, 200, 240, 0.45)";
    ctx.fillStyle = "rgba(20, 50, 75, 0.20)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    this._footprintPath(slot);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  _drawHighlight(slot) {
    const ctx = this._ctx;
    ctx.save();
    ctx.strokeStyle = "rgba(120, 220, 255, 0.95)";
    ctx.fillStyle = "rgba(120, 220, 255, 0.16)";
    ctx.lineWidth = 2;
    this._footprintPath(slot);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  _diamondPath(c, scale = 1) {
    const ctx = this._ctx;
    const hw = (TILE_W / 2) * scale;
    const hh = (TILE_H / 2) * scale;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - hh);
    ctx.lineTo(c.x + hw, c.y);
    ctx.lineTo(c.x, c.y + hh);
    ctx.lineTo(c.x - hw, c.y);
    ctx.closePath();
  }

  _drawProgress(slot, now) {
    if (!slot.endsAt || !slot.startedAt) return;
    const pct = Math.max(0, Math.min(1,
      (Date.now() - slot.startedAt) / (slot.endsAt - slot.startedAt)));
    const top = this._slotTopWorld(slot);
    const ctx = this._ctx;
    const w = 64, h = 6;
    const x = top.x - w / 2;
    const y = top.y - 16;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = "hsl(45, 95%, 55%)";
    ctx.fillRect(x, y, w * pct, h);
    const badge = this._badgeWorld(slot);
    this._drawSpeedupBadge(badge.x, badge.y, now);
  }

  /** Tappable gold ⏩ badge above a building under construction (opens the picker). */
  _drawSpeedupBadge(cx, cy, now) {
    const ctx = this._ctx;
    const pulse = 0.5 + 0.5 * Math.sin(now / 400);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, SPEEDUP_BADGE_R, 0, Math.PI * 2);
    ctx.fillStyle = "hsl(45, 90%, 52%)";
    ctx.shadowColor = `hsla(45, 95%, 60%, ${0.45 + 0.35 * pulse})`;
    ctx.shadowBlur = 6 + 5 * pulse;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "hsla(45, 100%, 88%, 0.9)";
    ctx.stroke();
    ctx.restore();
    this._drawText("⏩", cx, cy + 0.5, 12, "hsl(228, 45%, 12%)");
  }

  /** Viewport rect of a building's speed-up badge (for anchoring the picker). */
  _speedupBadgeRect(slot) {
    if (!this._canvas) return null;
    const base = this._canvas.getBoundingClientRect();
    const z = this._camera.zoom;
    const b = this._badgeWorld(slot);
    const s = this._camera.worldToScreen(b.x, b.y);
    const r = SPEEDUP_BADGE_R * z;
    return {
      left: base.left + s.x - r, top: base.top + s.y - r,
      width: 2 * r, height: 2 * r,
      get right() { return this.left + this.width; },
      get bottom() { return this.top + this.height; },
    };
  }

  /** The constructing slot whose speed-up badge is under the given client point, or null. */
  _speedupBadgeAtClient(clientX, clientY) {
    if (!this._canvas) return null;
    const base = this._canvas.getBoundingClientRect();
    const z = this._camera.zoom;
    const hitR = (SPEEDUP_BADGE_R + 4) * z;
    for (const slot of this._slots) {
      if (!slot.isBuilding) continue;
      const b = this._badgeWorld(slot);
      const s = this._camera.worldToScreen(b.x, b.y);
      if (Math.hypot(clientX - (base.left + s.x), clientY - (base.top + s.y)) <= hitR) return slot;
    }
    return null;
  }

  _drawLevelBadge(slot) {
    const f = this._frontWorld(slot);
    const ctx = this._ctx;
    const label = `Lv${slot.level}`;
    const y = f.y + 11;
    ctx.save();
    ctx.font = '700 9px "JetBrains Mono", monospace';
    const wPill = ctx.measureText(label).width + 8;
    const name =
      this._camera.zoom >= LABEL_MIN_ZOOM && slot.name
        ? slot.name.toUpperCase()
        : null;
    let wName = 0;
    if (name) {
      ctx.font = "700 8px Outfit, sans-serif";
      wName = ctx.measureText(name).width + 5;
    }
    const startX = f.x - (wPill + wName) / 2;
    ctx.fillStyle = "rgba(8, 14, 24, 0.85)";
    ctx.strokeStyle = "rgba(0, 170, 255, 0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(startX, y - 7, wPill, 14, 3);
    ctx.fill();
    ctx.stroke();
    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.fillStyle = "hsl(200, 100%, 65%)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, startX + wPill / 2, y);
    if (name) {
      ctx.font = "700 8px Outfit, sans-serif";
      ctx.textAlign = "left";
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 4;
      ctx.fillStyle = "rgba(190,225,255,0.85)";
      ctx.fillText(name, startX + wPill + 5, y);
    }
    ctx.restore();
  }

  /** Progress bar + live m:ss remaining, centred over a rubble sector mid-clear. */
  _drawSectorProgress(s) {
    const t = rectCenterTile(s.rect.cx, s.rect.cy, s.rect.w, s.rect.h);
    const c = tileToWorld(t.col, t.row);
    const now = Date.now();
    const pct = Math.max(0, Math.min(1, (now - s.startedAt) / (s.endsAt - s.startedAt)));
    const ctx = this._ctx;
    const w = 72, h = 7, x = c.x - w / 2, y = c.y;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = "hsl(30, 85%, 52%)";
    ctx.fillRect(x, y, w * pct, h);
    const remain = Math.max(0, Math.ceil((s.endsAt - now) / 1000));
    const mmss = `${Math.floor(remain / 60)}:${String(remain % 60).padStart(2, "0")}`;
    this._drawText(`CLEARING… ${mmss}`, c.x, y - 8, 8, "rgba(240,200,150,0.95)");
  }

  /** Tappable (rubble/clearing) sector under a client point, or null. */
  _sectorAtClient(clientX, clientY) {
    if (!this._canvas) return null;
    const base = this._canvas.getBoundingClientRect();
    const w = this._camera.screenToWorld(clientX - base.left, clientY - base.top);
    const cell = this._worldToCell(w.x, w.y);
    for (const s of this._sectorList) {
      if (s.state === "cleared") continue;
      const r = s.rect;
      if (cell.cx >= r.cx && cell.cx < r.cx + r.w && cell.cy >= r.cy && cell.cy < r.cy + r.h) return s;
    }
    return null;
  }

  /** Projected screen rect (viewport coords) of a rubble sector — tooltip anchor. */
  getSectorScreenRect(id) {
    const s = this._sectorList.find((x) => x.id === id);
    if (!s || !this._canvas) return null;
    const base = this._canvas.getBoundingClientRect();
    const r = s.rect;
    const c = rectCornersTile(r.cx, r.cy, r.w, r.h);
    const pts = [c.n, c.e, c.s, c.w]
      .map((p) => tileToWorld(p.col, p.row))
      .map((p) => this._camera.worldToScreen(p.x, p.y));
    const left = Math.min(...pts.map((p) => p.x));
    const right = Math.max(...pts.map((p) => p.x));
    const top = Math.min(...pts.map((p) => p.y));
    const bottom = Math.max(...pts.map((p) => p.y));
    return {
      left: base.left + left, top: base.top + top,
      width: right - left, height: bottom - top,
      get right() { return this.left + this.width; },
      get bottom() { return this.top + this.height; },
    };
  }

  _drawText(text, x, y, size, color = "#fff", weight = "700") {
    const ctx = this._ctx;
    ctx.save();
    ctx.font = `${weight} ${size}px Outfit, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 3;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  _fallbackDiamond(c, color) {
    const ctx = this._ctx;
    ctx.save();
    ctx.fillStyle = color;
    this._diamondPath(c);
    ctx.fill();
    ctx.restore();
  }

  // ───────────────────────────────────────────
  // Tutorial proxy layer
  // ───────────────────────────────────────────

  /**
   * Position inert .base-tile divs over each instance's footprint so tutorial
   * spotlight selectors (.base-tile[data-building-id=…]) keep working.
   */
  _syncProxies(ts) {
    if (!this._proxyEl) return;
    this._proxyDirty = false;
    const base = this._canvas.getBoundingClientRect();
    const seen = new Set();

    for (const slot of this._slots) {
      const key = `${slot.buildingId}_${slot.instanceIndex}`;
      seen.add(key);
      let div = this._proxies.get(key);
      if (!div) {
        div = document.createElement("div");
        div.className = "base-tile";
        div.dataset.buildingId = slot.buildingId;
        div.dataset.instanceIndex = String(slot.instanceIndex);
        this._proxyEl.appendChild(div);
        this._proxies.set(key, div);
      }
      const r = this._slotRect(slot);
      if (!r) continue;
      div.style.left = `${r.left - base.left}px`;
      div.style.top = `${r.top - base.top}px`;
      div.style.width = `${r.width}px`;
      div.style.height = `${r.height}px`;
    }

    for (const [key, div] of this._proxies) {
      if (!seen.has(key)) {
        div.remove();
        this._proxies.delete(key);
      }
    }

    if (ts - this._renderedEmitAt > 100) {
      this._renderedEmitAt = ts;
      eventBus.emit("buildings:rendered");
    }
  }
}
