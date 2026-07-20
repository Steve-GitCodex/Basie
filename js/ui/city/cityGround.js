/**
 * cityGround.js
 * Textured per-cell ground for the base view (ADR 0022, Phase B) — replaces the
 * flat GROUND_COLOR diamonds and the retired blueprint district tints. Each cell
 * draws an earth/cracked/ash diamond (deterministic variant by cell-coord hash),
 * skeleton road cells draw full road tiles, connector road cells draw a narrower
 * inset road tile, and uncleared rubble sectors draw rubble tiles.
 *
 * The whole ground is rasterised once into a single offscreen canvas at 1:1 world
 * resolution (the city is small + fixed, unlike the unbounded world map's chunk
 * grid — ADR 0013) and blitted each frame; it is re-rastered only when the road
 * web, cleared-sector set, or signature changes. Trees (edge forest + rubble dead
 * trees) are returned as painter-ordered props, not baked into the raster, so they
 * occlude / are occluded by buildings correctly. Nothing here is serialized.
 */
import { CELL_COLS, CELL_ROWS, GRID_MARGIN_TILES } from '../../entities/GAME_DATA.js';
import { tileToWorld, TILE_W, TILE_H } from './isoMath.js';
import { key } from './cityRoads.js';

const MARGIN_CELLS = GRID_MARGIN_TILES * 2;
const CELL_W = TILE_W / 2;   // 64
const CELL_H = TILE_H / 2;   // 48

const GROUND = 'assets/tiles/ground/grit';
const PROPS = 'assets/tiles/props/grit';

const GROUND_VARIANTS = ['earth_1', 'earth_2', 'earth_3', 'cracked_1', 'cracked_2', 'ash_1', 'ash_2'];
const ROAD_VARIANTS = ['road_1', 'road_2'];
const RUBBLE_VARIANTS = ['rubble_1', 'rubble_2'];
const DEBRIS_KINDS = ['debris_cinder', 'debris_pallet', 'debris_pipes', 'debris_trash', 'debris_wheels', 'debris_crates', 'debris_rock', 'debris_wreck'];
const FOREST_KINDS = ['tree_pine', 'tree_pine_group', 'tree_broad_1', 'tree_broad_2', 'tree_broad_group'];
const DEAD_KINDS = ['tree_dead_1', 'tree_dead_2', 'tree_dead_3'];

const FLAT_FILL = { ground: '#4a4640', road: '#34343a', rubble: '#3a352d' };

function hash(cx, cy, salt = 0) {
  let h = (cx * 73856093) ^ (cy * 19349663) ^ (salt * 83492791);
  h = (h ^ (h >>> 13)) >>> 0;
  return h / 0xffffffff;
}

/** Subtle earth-first variant pick so buildings stay the stars. */
function groundVariant(cx, cy) {
  const h = hash(cx, cy, 11);
  if (h < 0.72) return GROUND_VARIANTS[Math.floor(hash(cx, cy, 3) * 3)];      // earth_1..3
  if (h < 0.9) return hash(cx, cy, 5) < 0.5 ? 'cracked_1' : 'cracked_2';
  return hash(cx, cy, 7) < 0.5 ? 'ash_1' : 'ash_2';
}

/** Raster cache key: only what the ground raster actually draws differently. */
export function groundSignature({ clearedIds, skeleton, connectors }) {
  return `${[...clearedIds].sort().join(',')}` +
    `|${[...skeleton].sort().join(';')}` +
    `|${[...connectors].sort().join(';')}`;
}

export class CityGround {
  constructor() {
    this._img = new Map();
    this.ready = false;
    this._canvas = null;
    this._origin = { x: 0, y: 0 };
    this._sig = null;
    this._forestCache = null;
  }

  async load() {
    const names = [...GROUND_VARIANTS, ...ROAD_VARIANTS, ...RUBBLE_VARIANTS];
    await Promise.all([
      ...names.map(n => this._loadOne(n, `${GROUND}/${n}.png`)),
      ...[...DEBRIS_KINDS, ...FOREST_KINDS, ...DEAD_KINDS].map(n => this._loadOne(n, `${PROPS}/${n}.png`)),
    ]);
    this.ready = true;
  }

  async _loadOne(name, src) {
    const img = new Image();
    img.src = src;
    try { await img.decode(); this._img.set(name, img); } catch { /* flat fallback */ }
  }

  propImage(kind) { return this._img.get(kind) ?? null; }
  debrisImage(kind) { return this.propImage(kind); }

  /** Deterministic debris scatter for every uncleared rubble sector. */
  debrisScatter(sectorList) {
    const props = [];
    for (const s of sectorList) {
      if (s.state !== 'rubble') continue;
      const count = 2 + Math.floor(hash(s.rect.cx, s.rect.cy, 21) * 4); // 2–5
      for (let i = 0; i < count; i++) {
        const rx = hash(s.rect.cx + i, s.rect.cy, 31 + i);
        const ry = hash(s.rect.cx, s.rect.cy + i, 47 + i);
        const cx = s.rect.cx + 1 + Math.floor(rx * (s.rect.w - 2));
        const cy = s.rect.cy + 1 + Math.floor(ry * (s.rect.h - 2));
        const pick = hash(cx, cy, 59);
        const kind = pick > 0.9 ? 'debris_wreck'
          : DEBRIS_KINDS[Math.floor(hash(cx, cy, 61) * (DEBRIS_KINDS.length - 1))]; // wreck rare
        props.push({ col: cx / 2, row: cy / 2, kind });
      }
    }
    return props;
  }

  /** Edge forest (constant) + sparse dead trees inside uncleared rubble sectors. */
  treeScatter(sectorList) {
    return [...this._edgeForest(), ...this._rubbleDeadTrees(sectorList)];
  }

  /**
   * Dense pines/broadleaf in the decorative surround, density rising toward the
   * outer clamp edge. Layout-independent → computed once and cached.
   */
  _edgeForest() {
    if (this._forestCache) return this._forestCache;
    const trees = [];
    for (let cy = -MARGIN_CELLS; cy < CELL_ROWS + MARGIN_CELLS; cy++) {
      for (let cx = -MARGIN_CELLS; cx < CELL_COLS + MARGIN_CELLS; cx++) {
        const inGrid = cx >= 0 && cy >= 0 && cx < CELL_COLS && cy < CELL_ROWS;
        if (inGrid) continue;
        const dx = cx < 0 ? -cx : cx >= CELL_COLS ? cx - CELL_COLS + 1 : 0;
        const dy = cy < 0 ? -cy : cy >= CELL_ROWS ? cy - CELL_ROWS + 1 : 0;
        const dist = Math.max(dx, dy);                 // cells past the grid edge
        const density = 0.22 + 0.6 * Math.min(1, dist / MARGIN_CELLS);
        if (hash(cx, cy, 71) > density) continue;
        const kind = FOREST_KINDS[Math.floor(hash(cx, cy, 73) * FOREST_KINDS.length)];
        trees.push({ col: cx / 2, row: cy / 2, kind });
      }
    }
    this._forestCache = trees;
    return trees;
  }

  _rubbleDeadTrees(sectorList) {
    const trees = [];
    for (const s of sectorList) {
      if (s.state !== 'rubble') continue;
      const count = 1 + Math.floor(hash(s.rect.cx, s.rect.cy, 83) * 3); // 1–3
      for (let i = 0; i < count; i++) {
        const cx = s.rect.cx + 1 + Math.floor(hash(s.rect.cx + i * 5, s.rect.cy, 89 + i) * (s.rect.w - 2));
        const cy = s.rect.cy + 1 + Math.floor(hash(s.rect.cx, s.rect.cy + i * 5, 97 + i) * (s.rect.h - 2));
        const kind = DEAD_KINDS[Math.floor(hash(cx, cy, 101) * DEAD_KINDS.length)];
        trees.push({ col: cx / 2, row: cy / 2, kind });
      }
    }
    return trees;
  }

  /**
   * Blit the ground under the caller's world transform, re-rastering on change.
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ skeleton:Set<string>, connectors:Set<string>, isCleared:(cx,cy)=>boolean, signature:string }} state
   */
  draw(ctx, state) {
    if (!this.ready) return;
    if (this._sig !== state.signature || !this._canvas) this._raster(state);
    ctx.drawImage(this._canvas, this._origin.x, this._origin.y);
  }

  _raster(state) {
    const c0x = -MARGIN_CELLS, c1x = CELL_COLS + MARGIN_CELLS;
    const c0y = -MARGIN_CELLS, c1y = CELL_ROWS + MARGIN_CELLS;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [cx, cy] of [[c0x, c0y], [c1x, c0y], [c0x, c1y], [c1x, c1y]]) {
      const w = tileToWorld(cx / 2, cy / 2);
      minX = Math.min(minX, w.x); maxX = Math.max(maxX, w.x);
      minY = Math.min(minY, w.y); maxY = Math.max(maxY, w.y);
    }
    minX -= CELL_W / 2; maxX += CELL_W / 2; minY -= CELL_H / 2; maxY += CELL_H / 2;

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(maxX - minX);
    canvas.height = Math.ceil(maxY - minY);
    const ctx = canvas.getContext('2d');

    const cells = [];
    for (let cy = c0y; cy < c1y; cy++)
      for (let cx = c0x; cx < c1x; cx++) cells.push([cx, cy]);
    cells.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));

    for (const [cx, cy] of cells) {
      const w = tileToWorld(cx / 2, cy / 2);
      const px = w.x - minX - CELL_W / 2;
      const py = w.y - minY - CELL_H / 2;
      const { name, fill } = this._cellSprite(cx, cy, state);
      const img = this._img.get(name);
      if (img) ctx.drawImage(img, px, py, CELL_W, CELL_H);
      else this._flatDiamond(ctx, w.x - minX, w.y - minY, fill);

      if (state.connectors.has(key(cx, cy))) this._insetRoad(ctx, w.x - minX, w.y - minY);
    }

    this._canvas = canvas;
    this._origin = { x: minX, y: minY };
    this._sig = state.signature;
  }

  _cellSprite(cx, cy, state) {
    const inGrid = cx >= 0 && cy >= 0 && cx < CELL_COLS && cy < CELL_ROWS;
    if (inGrid && state.skeleton.has(key(cx, cy)))
      return { name: ROAD_VARIANTS[hash(cx, cy, 13) < 0.5 ? 0 : 1], fill: FLAT_FILL.road };
    if (inGrid && !state.isCleared(cx, cy))
      return { name: RUBBLE_VARIANTS[hash(cx, cy, 17) < 0.5 ? 0 : 1], fill: FLAT_FILL.rubble };
    return { name: groundVariant(cx, cy), fill: FLAT_FILL.ground };
  }

  /** Connector road: full road tile, slightly dimmed so it reads lighter than skeleton. */
  _insetRoad(ctx, cx, cy) {
    const img = this._img.get(ROAD_VARIANTS[hash(cx | 0, cy | 0, 13) < 0.5 ? 0 : 1]);
    ctx.save();
    ctx.globalAlpha = 0.9;
    if (img) ctx.drawImage(img, cx - CELL_W / 2, cy - CELL_H / 2, CELL_W, CELL_H);
    else { ctx.fillStyle = FLAT_FILL.road; this._flatDiamond(ctx, cx, cy, FLAT_FILL.road); }
    ctx.restore();
  }

  _flatDiamond(ctx, cx, cy, color, scale = 1) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - (CELL_H / 2) * scale);
    ctx.lineTo(cx + (CELL_W / 2) * scale, cy);
    ctx.lineTo(cx, cy + (CELL_H / 2) * scale);
    ctx.lineTo(cx - (CELL_W / 2) * scale, cy);
    ctx.closePath();
    ctx.fill();
  }
}
