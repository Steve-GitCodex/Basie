/**
 * cityPacker.js
 * Deterministic auto-layout for base buildings on the half-tile cell grid
 * (ADR 0022). Used for legacy-save migration, new games, and any instance that
 * unlocks without a saved position.
 *
 * HQ (townhall_0) is pinned at the center of the buildable rect. Every other
 * instance is placed at the free cell rect nearest its category's anchor —
 * production east, residential south, military west, civic north — so migrated
 * bases land already clustered. Pure over the instance list: same input → same
 * layout.
 */
import { BUILDINGS_CONFIG, CATEGORY_ZONE } from '../../entities/GAME_DATA.js';
import { BUILD_RECT, CELL_COLS, CELL_ROWS, inBounds, rectHitsSkeleton } from '../../entities/data/cityGrid.js';

/** Default placement gate — the whole buildable rect (Phase B narrows it to cleared cells). */
const ANY_CELL = (cx, cy, w, h) => inBounds(cx, cy, w, h);

const HQ_ID = 'townhall_0';
const DEFAULT_FOOTPRINT = [3, 3];
const ANCHOR_DIST = 8;

/** Cell-space unit direction each district clusters toward. */
const ZONE_DIR = {
  production:  [ 1,  0],
  military:    [-1,  0],
  residential: [ 0,  1],
  civic:       [ 0, -1],
};

/** Placement sort: districts group and stay deterministic across runs. */
const ZONE_ORDER = ['civic', 'production', 'residential', 'military'];

export function buildingIdOf(instanceId) {
  return instanceId.slice(0, instanceId.lastIndexOf('_'));
}

export function footprintOf(buildingId) {
  return BUILDINGS_CONFIG[buildingId]?.footprint ?? DEFAULT_FOOTPRINT;
}

function zoneOf(buildingId) {
  return CATEGORY_ZONE[BUILDINGS_CONFIG[buildingId]?.category] ?? 'civic';
}

function anchorOf(buildingId) {
  const [w, h] = footprintOf(buildingId);
  const dir = ZONE_DIR[zoneOf(buildingId)] ?? [0, 0];
  return {
    x: BUILD_RECT.w / 2 + dir[0] * ANCHOR_DIST,
    y: BUILD_RECT.h / 2 + dir[1] * ANCHOR_DIST,
    w, h,
  };
}

function hqTopLeft() {
  const [w, h] = footprintOf('townhall');
  return {
    cx: Math.round(BUILD_RECT.w / 2 - w / 2),
    cy: Math.round(BUILD_RECT.h / 2 - h / 2),
    w, h,
  };
}

function newGrid() { return new Uint8Array(CELL_COLS * CELL_ROWS); }

function isFree(grid, cx, cy, w, h, isAllowed) {
  if (!isAllowed(cx, cy, w, h)) return false;
  for (let y = cy; y < cy + h; y++)
    for (let x = cx; x < cx + w; x++)
      if (grid[y * CELL_COLS + x]) return false;
  return true;
}

function mark(grid, cx, cy, w, h) {
  for (let y = cy; y < cy + h; y++)
    for (let x = cx; x < cx + w; x++)
      grid[y * CELL_COLS + x] = 1;
}

/** Nearest free rect (by squared distance to anchor) scanning cy-then-cx for stable ties. */
function nearestFree(grid, w, h, ax, ay, isAllowed) {
  let best = null, bestScore = Infinity;
  for (let cy = 0; cy <= CELL_ROWS - h; cy++) {
    for (let cx = 0; cx <= CELL_COLS - w; cx++) {
      if (!isFree(grid, cx, cy, w, h, isAllowed)) continue;
      const dx = cx + w / 2 - ax;
      const dy = cy + h / 2 - ay;
      const score = dx * dx + dy * dy;
      if (score < bestScore) { bestScore = score; best = { cx, cy }; }
    }
  }
  return best;
}

/**
 * Deterministic full layout for a set of instance ids. HQ is pinned center even
 * when its cells aren't "allowed" (the core is always cleared in practice).
 * @param {(cx,cy,w,h)=>boolean} [isAllowed] gates placement to cleared cells
 * @returns {Map<string,{cx,cy}>}
 */
export function packAll(instanceIds, isAllowed = ANY_CELL) {
  const grid = newGrid();
  const result = new Map();

  const hq = hqTopLeft();
  mark(grid, hq.cx, hq.cy, hq.w, hq.h);
  result.set(HQ_ID, { cx: hq.cx, cy: hq.cy });

  const rest = instanceIds.filter(id => id !== HQ_ID).sort((a, b) => {
    const fa = footprintOf(buildingIdOf(a)), fb = footprintOf(buildingIdOf(b));
    const areaDiff = fb[0] * fb[1] - fa[0] * fa[1];
    if (areaDiff) return areaDiff;
    const za = ZONE_ORDER.indexOf(zoneOf(buildingIdOf(a)));
    const zb = ZONE_ORDER.indexOf(zoneOf(buildingIdOf(b)));
    if (za !== zb) return za - zb;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  for (const id of rest) {
    const a = anchorOf(buildingIdOf(id));
    const slot = nearestFree(grid, a.w, a.h, a.x, a.y, isAllowed);
    if (!slot) continue;
    mark(grid, slot.cx, slot.cy, a.w, a.h);
    result.set(id, { cx: slot.cx, cy: slot.cy });
  }
  return result;
}

/**
 * Single incremental placement against an existing layout (newly unlocked slots).
 * @param {{cx,cy,w,h}[]} placedRects - occupancy of already-placed instances
 * @returns {{cx,cy}|null}
 */
export function findPlacement(placedRects, instanceId, isAllowed = ANY_CELL) {
  const grid = newGrid();
  for (const r of placedRects) mark(grid, r.cx, r.cy, r.w, r.h);
  const a = anchorOf(buildingIdOf(instanceId));
  return nearestFree(grid, a.w, a.h, a.x, a.y, isAllowed);
}

/**
 * Moves that relocate every non-HQ building overlapping the road skeleton to the
 * nearest free allowed cell (legacy-save migration — ADR 0022 §4). Pure over the
 * rect list; the caller applies each move to its placement store.
 * @param {{instanceId,cx,cy,w,h}[]} rects
 * @returns {{instanceId:string, cx:number, cy:number}[]}
 */
export function skeletonOffenderMoves(rects, isAllowed = ANY_CELL) {
  const hits = (r) => r.instanceId !== HQ_ID && rectHitsSkeleton(r.cx, r.cy, r.w, r.h);
  const occ = rects.filter(r => !hits(r)).map(r => ({ ...r }));
  const moves = [];
  for (const r of rects.filter(hits)) {
    const slot = findPlacement(occ, r.instanceId, isAllowed);
    if (!slot) continue;
    moves.push({ instanceId: r.instanceId, cx: slot.cx, cy: slot.cy });
    occ.push({ instanceId: r.instanceId, cx: slot.cx, cy: slot.cy, w: r.w, h: r.h });
  }
  return moves;
}
