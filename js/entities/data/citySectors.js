/**
 * citySectors.js
 * Rubble-sector expansion layout for the base (ADR 0022, Phase B). BUILD_RECT is
 * tiled into a coarse SECTOR_COLS×SECTOR_ROWS grid of equal cell blocks; the
 * central 2×2 block is the always-clear CORE (HQ + a fresh game's buildings fit
 * comfortably), and the surrounding blocks are rubble sectors the player clears
 * with resources + a timer, gated by HQ level.
 *
 * Sector ids (`sector_<ring>_<n>`) are SAVE KEYS — the layout below is fixed and
 * append-only. Ring 1 = the eight blocks orthogonally around the core; ring 2 =
 * the four corners (farther, pricier, later). Per-ring clear cost = base × 2.5
 * per ring; numbers are deliberately generous (tighten later).
 */
import { CELL_COLS, CELL_ROWS } from './cityGrid.js';

export const SECTOR_COLS = 4;
export const SECTOR_ROWS = 4;
export const SECTOR_W = CELL_COLS / SECTOR_COLS; // 11 cells
export const SECTOR_H = CELL_ROWS / SECTOR_ROWS; // 8 cells

const CORE_MIN_COL = 1, CORE_MAX_COL = 2;
const CORE_MIN_ROW = 1, CORE_MAX_ROW = 2;

/** Always-clear central block (HQ-centred). */
export const CORE_RECT = {
  cx: CORE_MIN_COL * SECTOR_W,
  cy: CORE_MIN_ROW * SECTOR_H,
  w: (CORE_MAX_COL - CORE_MIN_COL + 1) * SECTOR_W,
  h: (CORE_MAX_ROW - CORE_MIN_ROW + 1) * SECTOR_H,
};

const CLEAR_COST_BASE = { wood: 600, stone: 400, iron: 150 };
const RING_COST_STEP = 2.5;
const RING_CLEAR_TIME = { 1: 120, 2: 300 };
const RING_HQ_GATE = { 1: 2, 2: 4 };

function isCoreBlock(col, row) {
  return col >= CORE_MIN_COL && col <= CORE_MAX_COL &&
         row >= CORE_MIN_ROW && row <= CORE_MAX_ROW;
}

/** Corner blocks sit at both extremes of the sector grid → the outer ring. */
function ringOfBlock(col, row) {
  const cornerCol = col === 0 || col === SECTOR_COLS - 1;
  const cornerRow = row === 0 || row === SECTOR_ROWS - 1;
  return cornerCol && cornerRow ? 2 : 1;
}

function scaleCost(ring) {
  const factor = RING_COST_STEP ** (ring - 1);
  const out = {};
  for (const [k, v] of Object.entries(CLEAR_COST_BASE)) out[k] = Math.round(v * factor);
  return out;
}

function buildSectors() {
  const sectors = [];
  const ringCount = {};
  for (let row = 0; row < SECTOR_ROWS; row++) {
    for (let col = 0; col < SECTOR_COLS; col++) {
      if (isCoreBlock(col, row)) continue;
      const ring = ringOfBlock(col, row);
      const n = ringCount[ring] ?? 0;
      ringCount[ring] = n + 1;
      sectors.push({
        id: `sector_${ring}_${n}`,
        ring,
        rect: { cx: col * SECTOR_W, cy: row * SECTOR_H, w: SECTOR_W, h: SECTOR_H },
        cost: scaleCost(ring),
        clearTimeSec: RING_CLEAR_TIME[ring],
        hqLevel: RING_HQ_GATE[ring],
      });
    }
  }
  return sectors;
}

export const SECTORS = buildSectors();
export const SECTOR_IDS = SECTORS.map(s => s.id);
export const SECTOR_BY_ID = new Map(SECTORS.map(s => [s.id, s]));

/** A friendly display name for a sector (id stays the save key). */
export function sectorName(id) {
  const s = SECTOR_BY_ID.get(id);
  return s ? `Rubble Sector ${s.ring}-${Number(id.slice(id.lastIndexOf('_') + 1)) + 1}` : id;
}

export function coreContains(cx, cy) {
  return cx >= CORE_RECT.cx && cx < CORE_RECT.cx + CORE_RECT.w &&
         cy >= CORE_RECT.cy && cy < CORE_RECT.cy + CORE_RECT.h;
}

/** Sector id owning cell (cx, cy), or null when the cell is core or off-grid. */
export function sectorIdAt(cx, cy) {
  if (cx < 0 || cy < 0 || cx >= CELL_COLS || cy >= CELL_ROWS) return null;
  const col = Math.floor(cx / SECTOR_W);
  const row = Math.floor(cy / SECTOR_H);
  if (isCoreBlock(col, row)) return null;
  const ring = ringOfBlock(col, row);
  let n = 0;
  for (let r = 0; r < SECTOR_ROWS; r++)
    for (let c = 0; c < SECTOR_COLS; c++) {
      if (isCoreBlock(c, r) || ringOfBlock(c, r) !== ring) continue;
      if (c === col && r === row) return `sector_${ring}_${n}`;
      n++;
    }
  return null;
}
