/**
 * ui/world/gridLayer.js
 * Terrain pass for the world map (grit reskin Phase B2). Owns the tile grid so
 * WorldRenderer stays a marker/arc renderer: it draws cells, faction tint, per-cell
 * fog and sector seams, and nothing else.
 *
 * Cells are rasterised into offscreen chunk canvases (16×16 cells) at a fixed
 * texture scale and blitted with smoothing off, so flat cell blocks stay crisp at
 * every zoom without re-rasterising per frame. Below LOD_ZOOM the per-cell pass is
 * skipped entirely for a chunk-level flat fill. Fog and tint are pure functions of
 * WorldMapManager state and are baked into the cache — nothing here is serialized;
 * `invalidate()` drops the cache when world state changes.
 */
import { WORLD_MAP } from '../../entities/GAME_DATA.js';
import { GRID, SECTOR, TERRAIN, regionAtCell } from '../../entities/data/worldGrid.js';
import { terrainAt, cellNoise } from '../../entities/data/gridGen.js';
import { LAND_BASE, grime } from './worldGrade.js';

export const CHUNK_CELLS = 16;
export const CHUNK_COLS = Math.ceil(GRID.cols / CHUNK_CELLS);
export const CHUNK_ROWS = Math.ceil(GRID.rows / CHUNK_CELLS);
export const LOD_ZOOM = 0.22;

const TEX_CELL = 32;
const TEX_SIZE = CHUNK_CELLS * TEX_CELL;
const CACHE_LIMIT = 24;
const SEAM_ZOOM = 0.5;

// Spread across a real value range — the faction tint sits on top of these, so
// terrain that reads only by hue would vanish under it.
const TERRAIN_COLOR = {
  [TERRAIN.WATER]:     '#1b2b34',
  [TERRAIN.FOREST]:    '#2b3626',
  [TERRAIN.RUBBLE]:    '#3a3630',
  [TERRAIN.WASTELAND]: '#4a4133',
  [TERRAIN.CRACKED]:   '#5c5039',
  [TERRAIN.RIDGE]:     '#6b6558',
};

const FOG_FILL = 'rgba(9,8,7,0.8)';
const OWNED_TINT = '#3ad17a';
const RUIN_TINT = '#9aa0a8';

export function chunkKey(kx, ky) { return `${kx},${ky}`; }

export function cellToChunk(cx, cy) {
  return { kx: Math.floor(cx / CHUNK_CELLS), ky: Math.floor(cy / CHUNK_CELLS) };
}

export function chunkCellRect(kx, ky) {
  return {
    cx0: kx * CHUNK_CELLS,
    cy0: ky * CHUNK_CELLS,
    cx1: Math.min(GRID.cols, (kx + 1) * CHUNK_CELLS),
    cy1: Math.min(GRID.rows, (ky + 1) * CHUNK_CELLS),
  };
}

/** Chunk index range covering a visible world-px rect, clamped to the grid. */
export function visibleChunkRange(rect) {
  const span = CHUNK_CELLS * GRID.cellPx;
  return {
    kx0: Math.max(0, Math.floor(rect.minX / span)),
    ky0: Math.max(0, Math.floor(rect.minY / span)),
    kx1: Math.min(CHUNK_COLS - 1, Math.floor(rect.maxX / span)),
    ky1: Math.min(CHUNK_ROWS - 1, Math.floor(rect.maxY / span)),
  };
}

export function useCellDetail(zoom) { return zoom >= LOD_ZOOM; }

export class GridLayer {
  constructor(wm) {
    this._wm = wm;
    this._cache = new Map();
    this._reveals = null;
  }

  invalidate() {
    this._cache.clear();
    this._reveals = null;
  }

  /** Terrain pass. Caller has already applied the world-space transform. */
  draw(ctx, camera) {
    const rect = camera.visibleWorldRect();
    const range = visibleChunkRange(rect);
    const detail = useCellDetail(camera.zoom);
    const span = CHUNK_CELLS * GRID.cellPx;

    const smoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    for (let ky = range.ky0; ky <= range.ky1; ky++) {
      for (let kx = range.kx0; kx <= range.kx1; kx++) {
        const x = kx * span, y = ky * span;
        if (detail) ctx.drawImage(this._chunk(kx, ky), x, y, span, span);
        else this._drawFlatChunk(ctx, kx, ky, x, y, span);
      }
    }
    ctx.imageSmoothingEnabled = smoothing;

    if (detail && camera.zoom >= SEAM_ZOOM) this._drawCellSeams(ctx, rect);
    this._drawSectorSeams(ctx);
  }

  // ── Chunk cache ───────────────────────────────────────────────────────────
  _chunk(kx, ky) {
    const key = chunkKey(kx, ky);
    const hit = this._cache.get(key);
    if (hit) return hit;
    if (this._cache.size >= CACHE_LIMIT) this._cache.delete(this._cache.keys().next().value);
    const canvas = this._renderChunk(kx, ky);
    this._cache.set(key, canvas);
    return canvas;
  }

  _renderChunk(kx, ky) {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_SIZE;
    canvas.height = TEX_SIZE;
    const ctx = canvas.getContext('2d');
    const rect = chunkCellRect(kx, ky);
    const regionId = regionAtCell(rect.cx0, rect.cy0);
    const tint = this._tintFor(regionId);
    const fogged = this._isRegionFogged(regionId);

    for (let cy = rect.cy0; cy < rect.cy1; cy++) {
      for (let cx = rect.cx0; cx < rect.cx1; cx++) {
        const px = (cx - rect.cx0) * TEX_CELL, py = (cy - rect.cy0) * TEX_CELL;
        ctx.fillStyle = TERRAIN_COLOR[terrainAt(cx, cy)] ?? LAND_BASE;
        ctx.fillRect(px, py, TEX_CELL, TEX_CELL);

        const n = cellNoise(cx, cy, 0x2a11);
        ctx.fillStyle = n < 0.5
          ? `rgba(0,0,0,${(0.5 - n) * 0.22})`
          : `rgba(255,240,215,${(n - 0.5) * 0.09})`;
        ctx.fillRect(px, py, TEX_CELL, TEX_CELL);

        if (tint) {
          ctx.fillStyle = tint.color;
          ctx.globalAlpha = tint.alpha;
          ctx.fillRect(px, py, TEX_CELL, TEX_CELL);
          ctx.globalAlpha = 1;
        }
        if (fogged && !this._isCellRevealed(cx, cy)) {
          ctx.fillStyle = FOG_FILL;
          ctx.fillRect(px, py, TEX_CELL, TEX_CELL);
        }
      }
    }
    return canvas;
  }

  _drawFlatChunk(ctx, kx, ky, x, y, span) {
    const regionId = regionAtCell(kx * CHUNK_CELLS, ky * CHUNK_CELLS);
    ctx.fillStyle = LAND_BASE;
    ctx.fillRect(x, y, span, span);
    const tint = this._tintFor(regionId);
    if (tint) {
      ctx.fillStyle = tint.color;
      ctx.globalAlpha = tint.flatAlpha;
      ctx.fillRect(x, y, span, span);
      ctx.globalAlpha = 1;
    }
    if (this._isRegionFogged(regionId)) {
      ctx.fillStyle = FOG_FILL;
      ctx.fillRect(x, y, span, span);
    }
  }

  // ── Region identity ───────────────────────────────────────────────────────
  _tintFor(regionId) {
    const region = this._wm.getRegion(regionId);
    if (!region) return null;
    const owned = this._wm.isPlayerOwned(region.id);
    const faction = WORLD_MAP.factions[region.factionId];
    const base = owned ? OWNED_TINT : (region.isCommandCenter ? RUIN_TINT : (faction?.color ?? '#888'));
    // `alpha` sits over terrain and must not drown it; `flatAlpha` is the zoomed-out
    // pass where the tint is the only territory signal on a bare land base.
    return { color: grime(base), alpha: owned ? 0.14 : 0.11, flatAlpha: owned ? 0.34 : 0.26 };
  }

  _isRegionFogged(regionId) {
    return !!regionId && !this._wm.isRegionUnlocked(regionId);
  }

  /** Watchtower reveal circles from player-held outposts — the same sources
   *  WorldMapManager.revealArea uses, so the mask never disagrees with POI fog. */
  _revealCircles() {
    this._reveals ??= WORLD_MAP.pois
      .filter(p => p.revealRadius && this._wm.isPlayerOutpost(p.id))
      .map(p => ({ x: p.x, y: p.y, r2: p.revealRadius * p.revealRadius }));
    return this._reveals;
  }

  _isCellRevealed(cx, cy) {
    const circles = this._revealCircles();
    if (!circles.length) return false;
    const x = (cx + 0.5) * GRID.cellPx, y = (cy + 0.5) * GRID.cellPx;
    return circles.some(c => (x - c.x) ** 2 + (y - c.y) ** 2 <= c.r2);
  }

  // ── Seams ─────────────────────────────────────────────────────────────────
  _drawCellSeams(ctx, rect) {
    const s = GRID.cellPx;
    const cx0 = Math.max(0, Math.floor(rect.minX / s)), cx1 = Math.min(GRID.cols, Math.ceil(rect.maxX / s));
    const cy0 = Math.max(0, Math.floor(rect.minY / s)), cy1 = Math.min(GRID.rows, Math.ceil(rect.maxY / s));
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let cx = cx0; cx <= cx1; cx++) { ctx.moveTo(cx * s, cy0 * s); ctx.lineTo(cx * s, cy1 * s); }
    for (let cy = cy0; cy <= cy1; cy++) { ctx.moveTo(cx0 * s, cy * s); ctx.lineTo(cx1 * s, cy * s); }
    ctx.stroke();
  }

  _drawSectorSeams(ctx) {
    const s = SECTOR.cells * GRID.cellPx;
    const w = GRID.cols * GRID.cellPx, h = GRID.rows * GRID.cellPx;
    ctx.strokeStyle = 'rgba(12,11,9,0.85)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let i = 0; i <= SECTOR.cols; i++) { ctx.moveTo(i * s, 0); ctx.lineTo(i * s, h); }
    for (let i = 0; i <= SECTOR.rows; i++) { ctx.moveTo(0, i * s); ctx.lineTo(w, i * s); }
    ctx.stroke();
  }
}
