/**
 * CityRenderer.js
 * Canvas-2D isometric renderer for the base city view (#view-base).
 *
 * Presenter-tier: reads BuildingManager state (placements + instance status)
 * via syncState(), never mutates game state. UI intents flow back through
 * the callbacks supplied by BuildingsUI. Runs its own rAF loop (render-only)
 * — game logic stays on the GameEngine fixed tick.
 *
 * Scene model: blueprint plots. Each plot is either empty (tappable →
 * zone-filtered build menu) or holds an assigned building instance
 * (unbuilt ghost / under construction / built).
 *
 * Also maintains an inert "proxy layer" of absolutely-positioned divs
 * (.base-tile[data-building-id][data-instance-index]) so the tutorial
 * spotlight selectors and ring-repositioning keep working unchanged.
 */
import { eventBus } from "../../core/EventBus.js";
import { CITY_BLUEPRINT } from "../../entities/GAME_DATA.js";
import {
  TILE_W,
  TILE_H,
  GROUND_BOTTOM,
  tileToWorld,
  hitTestTile,
} from "./isoMath.js";
import { CityCamera } from "./CityCamera.js";
import { CityAssets } from "./cityAssets.js";
import { allGroundCells, allProps } from "./cityLayout.js";
import { CityInput } from "./cityInput.js";
import { CityAgents } from "./cityAgents.js";
import { CityAmbient } from "./cityAmbient.js";
import { CityGrade } from "./cityGrade.js";

const LABEL_MIN_ZOOM = 0.65;
// Buildings are seated so their base diamond rests on the tile's top surface:
// the footprint is fit to the plot width (sprites are authored at 99 or 132 px
// wide), and the base is anchored on the diamond's bottom corner so the building
// stands on the ground block's top face (top-face center = tile center c.y).
// Bump BUILDING_FIT > 1 for the "structure overflows the lot" genre look.
const BUILDING_FIT = 1.0;
const HEADROOM = 2; // px above the diamond covered by a building sprite (proxy/hit rect)
const SPEEDUP_BADGE_R  = 11; // world-px radius of the ⏩ speed-up badge over a building
const SPEEDUP_BADGE_DY = 30; // world-px the badge centre sits above the tile centre
const HOME_ZOOM = 1.0;

// Viewport culling margins (world px). Generous on top so tall building
// sprites that rise above their tile still draw while their base is below
// the viewport. Cheap guard that keeps the per-frame draw cost proportional
// to what's on screen, not to the full (ring-padded) terrain.
const CULL_GROUND = { halfW: 70, top: 60, bottom: 70 };
const CULL_OBJECT = { halfW: 96, top: 260, bottom: 90 };

/** Empty-plot pad tint per zone. */
const ZONE_TINT = {
  production: "rgba(190, 150, 60, 0.10)",
  civic: "rgba(80, 170, 255, 0.08)",
  residential: "rgba(120, 220, 120, 0.10)",
  military: "rgba(255, 110, 90, 0.10)",
};

export class CityRenderer {
  /**
   * @param {{ bm, host: HTMLElement,
   *           onTileClick?: (bid:string, idx:number) => void,
   *           onTileHover?: (bid:string, idx:number) => void,
   *           onPlotClick?: (plotId:string, zone:string) => void,
   *           onPlotHover?: (plotId:string, zone:string) => void,
   *           onTileLeave?: () => void,
   *           onSpeedupClick?: (bid:string, idx:number, badgeRect:object) => void,
   *           onEmptyClick?: () => void }} opts
   */
  constructor(opts) {
    this._bm = opts.bm;
    this._host = opts.host;
    this._onTileClick = opts.onTileClick ?? (() => {});
    this._onTileHover = opts.onTileHover ?? (() => {});
    this._onPlotClick = opts.onPlotClick ?? (() => {});
    this._onPlotHover = opts.onPlotHover ?? (() => {});
    this._onTileLeave = opts.onTileLeave ?? (() => {});
    this._onSpeedupClick = opts.onSpeedupClick ?? (() => {});
    this._onEmptyClick = opts.onEmptyClick ?? (() => {});

    this.ready = false;
    this._assets = new CityAssets();
    this._camera = new CityCamera(() => {
      this._dirty = true;
      this._proxyDirty = true;
    });
    this._groundCells = allGroundCells();
    this._props = allProps();

    this._input = new CityInput(this);
    this._agents = new CityAgents(this);
    this._ambient = new CityAmbient(this, CULL_OBJECT);
    this._grade = new CityGrade(this._assets);

    this._slots = []; // plot scene records, painter-sorted
    this._slotAt = new Map(); // "col,row" → slot
    this._proxies = new Map(); // "bid_idx" → div
    this._hovered = null; // slot or null
    this._relocateCandidates = null; // Set<plotId> | null — relocate-mode highlight

    this._raf = 0;
    this._running = false;
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
    this._agents.spawn();
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this._host);
    this._loadEl?.classList.remove("hidden");

    await this._assets.load();
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

  /** Re-derive plot scene records from manager state. Cheap; call on any building event. */
  syncState() {
    const types = this._bm.getBuildingTypesWithInstances();
    const placements = this._bm.getPlacements(); // instanceId → plotId
    const byPlot = new Map(); // plotId → instanceId
    for (const [instanceId, plotId] of placements)
      byPlot.set(plotId, instanceId);

    const instanceData = new Map(); // instanceId → instance record
    for (const t of types) {
      for (const inst of t.instances)
        instanceData.set(inst.instanceId, { type: t, inst });
    }

    this._slots = [];
    this._slotAt.clear();

    for (const plot of CITY_BLUEPRINT.plots) {
      const instanceId = byPlot.get(plot.id) ?? null;
      const data = instanceId ? instanceData.get(instanceId) : null;
      const slot = {
        plotId: plot.id,
        zone: plot.zone,
        col: plot.col,
        row: plot.row,
        empty: !data,
        // assigned-instance fields (null when empty)
        buildingId: data ? data.type.id : null,
        instanceIndex: data ? data.inst.instanceIndex : null,
        name: data ? (data.inst.displayName ?? data.type.name) : null,
        level: data ? data.inst.level : 0,
        isBuilding: data ? data.inst.isActivelyBuilding : false,
        startedAt: data ? data.inst.startedAt : null,
        endsAt: data ? data.inst.constructionEndsAt : null,
      };
      this._slots.push(slot);
      this._slotAt.set(`${plot.col},${plot.row}`, slot);
    }
    this._slots.sort(
      (a, b) => a.col + a.row - (b.col + b.row) || a.row - b.row,
    );

    // Combined painter-ordered object list: plot slots + static deco props
    this._drawList = [
      ...this._slots.map((s) => ({ depth: s.col + s.row, slot: s })),
      ...this._props.map((p) => ({ depth: p.col + p.row, prop: p })),
    ].sort((a, b) => a.depth - b.depth);

    this._dirty = true;
    this._proxyDirty = true;
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
    const hqSlot =
      this._slots.find((s) => s.buildingId === "townhall") ??
      this._slots.find((s) => s.plotId === "civic_hq");
    const c = hqSlot
      ? tileToWorld(hqSlot.col, hqSlot.row)
      : tileToWorld(
          Math.floor(CITY_BLUEPRINT.cols / 2),
          Math.floor(CITY_BLUEPRINT.rows / 2),
        );
    this._camera.centerOn(c.x, c.y, this._host.clientHeight * 0.06, HOME_ZOOM);
  }

  /**
   * Relocate mode: highlight candidate target plots (Set/array of plotIds),
   * or null to exit the mode.
   */
  setRelocateCandidates(plotIds) {
    this._relocateCandidates = plotIds ? new Set(plotIds) : null;
    this._dirty = true;
  }

  /** Projected screen rect (viewport coords) of an assigned building's tile. */
  getTileScreenRect(buildingId, instanceIndex) {
    const slot = this._slots.find(
      (s) => s.buildingId === buildingId && s.instanceIndex === instanceIndex,
    );
    return slot ? this._slotRect(slot) : null;
  }

  /** Projected screen rect of any plot. */
  getPlotScreenRect(plotId) {
    const slot = this._slots.find((s) => s.plotId === plotId);
    return slot ? this._slotRect(slot) : null;
  }

  _slotRect(slot) {
    if (!this._canvas) return null;
    const base = this._canvas.getBoundingClientRect();
    const c = tileToWorld(slot.col, slot.row);
    const z = this._camera.zoom;
    const s = this._camera.worldToScreen(c.x, c.y);
    return {
      left: base.left + s.x - (TILE_W / 2) * z,
      top: base.top + s.y - (TILE_H / 2 + HEADROOM) * z,
      width: TILE_W * z,
      height: (TILE_H + HEADROOM + 18) * z,
      get right() {
        return this.left + this.width;
      },
      get bottom() {
        return this.top + this.height;
      },
    };
  }

  /** Pan the camera so a building slot is comfortably visible. */
  centerOnTile(buildingId, instanceIndex = 0, biasUp = false) {
    const slot = this._slots.find(
      (s) => s.buildingId === buildingId && s.instanceIndex === instanceIndex,
    );
    if (!slot) return;
    const c = tileToWorld(slot.col, slot.row);
    this._camera.centerOn(
      c.x,
      c.y,
      biasUp ? this._host.clientHeight * 0.18 : 0,
    );
  }

  // ───────────────────────────────────────────
  // Scene picking + hover (driven by CityInput)
  // ───────────────────────────────────────────

  _slotAtClient(clientX, clientY) {
    const rect = this._canvas.getBoundingClientRect();
    const w = this._camera.screenToWorld(
      clientX - rect.left,
      clientY - rect.top,
    );
    // 1 — sprite-aware: a tall building's body rises above its ground diamond,
    // so test drawn sprite bounds front-to-back (this._slots is depth-ascending;
    // the last/front-most drawn wins, matching what visually occludes).
    for (let i = this._slots.length - 1; i >= 0; i--) {
      const slot = this._slots[i];
      if (!slot.empty && this._pointInSlotSprite(w.x, w.y, slot)) return slot;
    }
    // 2 — ground-diamond fallback: empty plots + taps on bare ground.
    const t = hitTestTile(w.x, w.y);
    return t ? (this._slotAt.get(`${t.col},${t.row}`) ?? null) : null;
  }

  /**
   * World point inside a slot's *drawn building sprite* rect? Mirrors the
   * seating math in _drawSlot/drawBuilding (footprint fit to plot width, base
   * diamond seated on the tile's bottom corner). Only meaningful once a sprite
   * is actually drawn — assigned-but-unbuilt outlines fall through to the diamond.
   */
  _pointInSlotSprite(wx, wy, slot) {
    if (slot.level <= 0 && !slot.isBuilding) return false;
    const img = this._assets.building(slot.buildingId);
    if (!img) return false;
    const c = tileToWorld(slot.col, slot.row);
    const s = (TILE_W / img.width) * BUILDING_FIT;
    const halfW = (img.width * s) / 2;
    const bottom = c.y + TILE_H / 2;
    const top = bottom - img.height * s;
    return wx >= c.x - halfW && wx <= c.x + halfW && wy >= top && wy <= bottom;
  }

  _updateHover(e) {
    this._setHover(this._slotAtClient(e.clientX, e.clientY));
  }

  _setHover(slot) {
    if (slot === this._hovered) return;
    this._hovered = slot;
    this._dirty = true;
    this._canvas.style.cursor = slot ? "pointer" : "grab";
    if (!slot) this._onTileLeave();
    else if (slot.empty) this._onPlotHover(slot.plotId, slot.zone);
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
    this._cssW = w; // CSS-px viewport, cached for cull-rect math (no layout thrash)
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

  /** Is a tile-centered object (with margins m) within the visible rect r? */
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
    // rAF timestamps can precede the performance.now() captured in start() —
    // dt must never go negative or the path indices walk off the array.
    const dt = Math.max(0, Math.min(0.1, (ts - this._lastTs) / 1000));
    this._lastTs = ts;

    this._agents.update(dt);

    // Ambient animation (drone, walkers, tint, construction) redraws at
    // ~30fps; camera/state changes redraw immediately.
    const ambientDue = ts - this._lastAmbient > 33;
    if (!this._dirty && !ambientDue) return;
    if (ambientDue) this._lastAmbient = ts;
    this._dirty = false;

    this._draw(ts);
    if (this._proxyDirty) this._syncProxies(ts);
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

    // 1 — ground (districts, roads, decorative ring)
    for (const cell of this._groundCells) {
      const c = tileToWorld(cell.col, cell.row);
      if (!this._inView(c, CULL_GROUND, view)) continue;
      const img = this._grade.ground(cell.key);
      if (img) {
        ctx.drawImage(
          img,
          c.x - img.width / 2,
          c.y + GROUND_BOTTOM - img.height,
        );
      } else {
        this._fallbackDiamond(
          c,
          cell.key.startsWith("road") ? "#222" : "#2c4a2c",
        );
      }
    }

    // 2 — hover highlight under the building sprite
    if (this._hovered) this._drawHighlight(this._hovered);

    // 3 — objects: plots/buildings + props (painter-sorted), agents interleaved
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
      const o = item.slot ?? item.prop;
      if (!this._inView(tileToWorld(o.col, o.row), CULL_OBJECT, view)) continue;
      if (item.slot) this._drawSlot(item.slot, now);
      else this._drawProp(item.prop);
    }
    while (wi < walkersToDraw.length)
      this._agents.drawWalker(walkersToDraw[wi++], now);
    if (!droneDrawn) this._agents.drawDrone(now);

    // 4 — overlays: progress bars + level badges (always on top of sprites)
    for (const slot of this._slots) {
      if (!slot.isBuilding && slot.level <= 0) continue;
      if (!this._inView(tileToWorld(slot.col, slot.row), CULL_OBJECT, view)) continue;
      if (slot.isBuilding) this._drawProgress(slot, now);
      else this._drawLevelBadge(slot);
    }

    // 4b — hovered building's name on a pill, on top (the inline label below a
    // building can be overdrawn by the sprite of a building in front of it).
    const hv = this._hovered;
    if (hv && !hv.empty && hv.name && (hv.isBuilding || hv.level > 0)) {
      const c = tileToWorld(hv.col, hv.row);
      this._drawNamePill(hv.name.toUpperCase(), c.x, c.y + TILE_H / 2 + 12);
    }

    // 5 — day/night ambient tint + window lights
    this._ambient.drawNight(now);

    // 6 — grim-grade atmosphere: vignette + cold wash + horizon haze
    this._grade.drawOverlay(ctx, this._canvas.width, this._canvas.height);
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
    const c = tileToWorld(slot.col, slot.row);

    if (slot.empty) {
      this._drawEmptyPlot(slot, c);
      return;
    }

    const img = this._grade.building(slot.buildingId);
    const drawBuilding = (image, alpha = 1) => {
      const ctx = this._ctx;
      // Fit the footprint to the plot, then seat the base diamond's bottom vertex
      // on the tile's bottom corner (c.y + TILE_H/2) so the building stands on the
      // ground's top face instead of floating inset above it.
      const s = (TILE_W / image.width) * BUILDING_FIT;
      if (alpha !== 1) ctx.globalAlpha = alpha;
      ctx.drawImage(
        image,
        c.x - (image.width * s) / 2,
        c.y + TILE_H / 2 - image.height * s,
        image.width * s,
        image.height * s,
      );
      if (alpha !== 1) ctx.globalAlpha = 1;
    };

    if (slot.level === 0 && !slot.isBuilding) {
      // Assigned but unbuilt — surveyor's outline + name (tutorial target look)
      this._drawBlueprintOutline(c);
      this._drawText("+", c.x, c.y + 2, 14, "rgba(140,215,250,0.6)", "300");
      if (this._camera.zoom >= LABEL_MIN_ZOOM && slot.name) {
        this._drawText(
          slot.name.toUpperCase(),
          c.x,
          c.y + TILE_H / 2 + 11,
          8,
          "rgba(240,180,90,0.8)",
        );
      }
      return;
    }

    if (!img) {
      this._fallbackDiamond(c, "#1d5d8a");
      return;
    }

    if (slot.level === 0 && slot.isBuilding) {
      drawBuilding(img, 0.35 + 0.15 * Math.sin(now / 300));
      this._drawBlueprintOutline(c);
      return;
    }

    drawBuilding(img);
    this._grade.drawPlaque(
      this._ctx,
      slot.buildingId,
      c.x + TILE_W / 4,
      c.y + TILE_H / 4,
    );

    if (this._camera.zoom >= LABEL_MIN_ZOOM && slot.name) {
      this._drawText(
        slot.name.toUpperCase(),
        c.x,
        c.y + TILE_H / 2 + 11,
        8,
        "rgba(190,225,255,0.85)",
      );
    }
  }

  _drawEmptyPlot(slot, c) {
    const ctx = this._ctx;
    const isCandidate = this._relocateCandidates?.has(slot.plotId);
    const isHovered = this._hovered === slot;

    ctx.save();
    if (isCandidate) {
      // Relocate mode — pulsing green target
      ctx.strokeStyle = "rgba(120, 255, 170, 0.9)";
      ctx.fillStyle = "rgba(60, 200, 120, 0.22)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
    } else {
      // Subtle zone-tinted pad — must NOT read as water
      ctx.strokeStyle = isHovered
        ? "rgba(150, 215, 250, 0.5)"
        : "rgba(150, 180, 210, 0.18)";
      ctx.fillStyle = ZONE_TINT[slot.zone] ?? "rgba(150,150,150,0.08)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 5]);
    }
    this._diamondPath(c, 0.78);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    if (isHovered || isCandidate) {
      this._drawText(
        "+",
        c.x,
        c.y + 2,
        16,
        isCandidate ? "rgba(160,255,200,0.95)" : "rgba(160,220,255,0.8)",
        "300",
      );
    }
  }

  _drawProp(prop) {
    const img = this._grade.ground(prop.kind);
    if (!img) return;
    const c = tileToWorld(prop.col, prop.row);
    this._ctx.drawImage(
      img,
      c.x + prop.dx - img.width / 2,
      c.y + prop.dy - img.height + 4,
    );
  }

  // Subtle "surveyor's outline" on the district ground
  _drawBlueprintOutline(c) {
    const ctx = this._ctx;
    ctx.save();
    ctx.strokeStyle = "rgba(110, 200, 240, 0.45)";
    ctx.fillStyle = "rgba(20, 50, 75, 0.20)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    this._diamondPath(c, 0.82);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  _drawHighlight(slot) {
    const ctx = this._ctx;
    const c = tileToWorld(slot.col, slot.row);
    ctx.save();
    ctx.strokeStyle = "rgba(120, 220, 255, 0.95)";
    ctx.fillStyle = "rgba(120, 220, 255, 0.16)";
    ctx.lineWidth = 2;
    this._diamondPath(c);
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
    const pct = Math.max(
      0,
      Math.min(
        1,
        (Date.now() - slot.startedAt) / (slot.endsAt - slot.startedAt),
      ),
    );
    const c = tileToWorld(slot.col, slot.row);
    const ctx = this._ctx;
    const w = 64,
      h = 6;
    const x = c.x - w / 2;
    const y = c.y - HEADROOM - 14;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = "hsl(45, 95%, 55%)";
    ctx.fillRect(x, y, w * pct, h);
    this._drawSpeedupBadge(c.x, c.y - SPEEDUP_BADGE_DY, now);
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
    const c = tileToWorld(slot.col, slot.row);
    const s = this._camera.worldToScreen(c.x, c.y - SPEEDUP_BADGE_DY);
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
    const hitR = (SPEEDUP_BADGE_R + 4) * z;   // a little tap slop
    for (const slot of this._slots) {
      if (!slot.isBuilding) continue;
      const c = tileToWorld(slot.col, slot.row);
      const s = this._camera.worldToScreen(c.x, c.y - SPEEDUP_BADGE_DY);
      if (Math.hypot(clientX - (base.left + s.x), clientY - (base.top + s.y)) <= hitR) return slot;
    }
    return null;
  }

  _drawLevelBadge(slot) {
    const c = tileToWorld(slot.col, slot.row);
    const ctx = this._ctx;
    const label = `Lv${slot.level}`;
    const x = c.x + TILE_W / 4;
    const y = c.y - TILE_H;
    ctx.save();
    ctx.font = '700 9px "JetBrains Mono", monospace';
    const w = ctx.measureText(label).width + 8;
    ctx.fillStyle = "rgba(8, 14, 24, 0.85)";
    ctx.strokeStyle = "rgba(0, 170, 255, 0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 8, w, 14, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "hsl(200, 100%, 65%)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y);
    ctx.restore();
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
   * Position inert .base-tile divs over each ASSIGNED slot so tutorial
   * spotlight selectors (.base-tile[data-building-id=…]) keep working.
   */
  _syncProxies(ts) {
    if (!this._proxyEl) return;
    this._proxyDirty = false;
    const base = this._canvas.getBoundingClientRect();
    const seen = new Set();

    for (const slot of this._slots) {
      if (slot.empty) continue;
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

    // Remove proxies for instances that no longer have a placement
    for (const [key, div] of this._proxies) {
      if (!seen.has(key)) {
        div.remove();
        this._proxies.delete(key);
      }
    }

    // Let the tutorial spotlight re-pin to the moved tiles (throttled).
    if (ts - this._renderedEmitAt > 100) {
      this._renderedEmitAt = ts;
      eventBus.emit("buildings:rendered");
    }
  }
}
