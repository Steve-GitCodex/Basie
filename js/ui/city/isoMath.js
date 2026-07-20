/**
 * isoMath.js
 * Pure isometric projection math for the base city view. No DOM, no state.
 *
 * Grid dimensions come from cityGrid; only the projection and camera-constraint
 * math lives here.
 *
 * World space: 1 world unit = 1 sprite px at zoom 1.
 *   Tile diamond:  TILE_W wide × TILE_H tall, center at (wx, wy).
 *   Forward:  wx = (col − row) · TILE_W/2,   wy = (col + row) · TILE_H/2
 *   Inverse:  col = (wx/(TILE_W/2) + wy/(TILE_H/2)) / 2
 *             row = (wy/(TILE_H/2) − wx/(TILE_W/2)) / 2
 *
 * Diamond space (u, v): u = wx/(TILE_W/2) + wy/(TILE_H/2) = 2·col,
 *                       v = wy/(TILE_H/2) − wx/(TILE_W/2) = 2·row.
 * The terrain (grid + ring) is an axis-aligned box in (u, v) — which makes
 * "keep the viewport fully on terrain" an exact, cheap clamp.
 *
 * Diamond ratio matches the grit building set's isometric footprint (~1.3:1,
 * measured from the Quaternius renders — ADR 0009). Ground is flat-filled per
 * cell (no sprite skirt); buildings bottom-anchor at the tile's front vertex
 * (drawY = wy + GROUND_BOTTOM − imgHeight) so taller sprites rise upward and
 * occlude correctly under painter's ordering.
 */
import { GRID_TILE_COLS, GRID_TILE_ROWS, GRID_MARGIN_TILES } from '../../entities/GAME_DATA.js';

export const TILE_W = 128;
export const TILE_H = 96;
export const GRID_COLS = GRID_TILE_COLS;
export const GRID_ROWS = GRID_TILE_ROWS;
/** Empty-ground + camera-overhang margin (tiles) around the buildable rect. */
export const RING = GRID_MARGIN_TILES;

/** Distance from a tile's diamond center down to the sprite's bottom (front) vertex. */
export const GROUND_BOTTOM = TILE_H / 2;

/** Logical tile → world px (diamond center). */
export function tileToWorld(col, row) {
  return {
    x: (col - row) * (TILE_W / 2),
    y: (col + row) * (TILE_H / 2),
  };
}

/** World px → fractional logical tile coords. */
export function worldToTile(wx, wy) {
  return {
    col: (wx / (TILE_W / 2) + wy / (TILE_H / 2)) / 2,
    row: (wy / (TILE_H / 2) - wx / (TILE_W / 2)) / 2,
  };
}

/**
 * Hit-test a world point against the tile grid (grid cells only, not ring).
 * Returns { col, row } of the diamond containing the point, or null.
 */
export function hitTestTile(wx, wy) {
  const f   = worldToTile(wx, wy);
  const col = Math.round(f.col);
  const row = Math.round(f.row);
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
  const c  = tileToWorld(col, row);
  const dx = Math.abs(wx - c.x);
  const dy = Math.abs(wy - c.y);
  if (dx / (TILE_W / 2) + dy / (TILE_H / 2) > 1) return null;
  return { col, row };
}

/**
 * Terrain extent (grid + ring) in diamond space.
 * u spans columns ×2, v spans rows ×2; ±1 covers the half-tile from a
 * cell center to the diamond edge.
 */
export function uvRanges() {
  return {
    u0: 2 * -RING - 1,
    u1: 2 * (GRID_COLS - 1 + RING) + 1,
    v0: 2 * -RING - 1,
    v1: 2 * (GRID_ROWS - 1 + RING) + 1,
  };
}

export function worldToUV(wx, wy) {
  return {
    u: wx / (TILE_W / 2) + wy / (TILE_H / 2),
    v: wy / (TILE_H / 2) - wx / (TILE_W / 2),
  };
}

/** Inverse of worldToUV for deltas: shift in (u, v) → shift in world px. */
export function uvShiftToWorld(du, dv) {
  return {
    dx: (du - dv) * (TILE_W / 4),
    dy: (du + dv) * (TILE_H / 4),
  };
}

/**
 * Axis-aligned world-space bounds of the whole map (grid + ring),
 * with headroom above for tall sprites. (Used for fallback framing.)
 */
export function worldBounds() {
  const lo = -RING;
  const hiC = GRID_COLS - 1 + RING;
  const hiR = GRID_ROWS - 1 + RING;
  const minX = (lo - hiR) * (TILE_W / 2) - TILE_W / 2;
  const maxX = (hiC - lo) * (TILE_W / 2) + TILE_W / 2;
  const minY = (lo + lo) * (TILE_H / 2) - TILE_H / 2 - 100; // headroom for tall sprites
  const maxY = (hiC + hiR) * (TILE_H / 2) + GROUND_BOTTOM;
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}
