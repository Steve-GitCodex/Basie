/**
 * cityGrid.js
 * Half-tile cell grid for free-placement base layout (ADR 0022). Each iso tile
 * (isoMath 128×96) subdivides 2×2 into cells; cell (cx, cy) maps to fractional
 * tile (cx/2, cy/2). isoMath's projection is linear, so `tileToWorld` accepts
 * the fractional coords these helpers return.
 *
 * Geometry source of truth for the base view (Phase B: cityBlueprint retired).
 * Buildable area is a fixed rect; camera bounds derive from it plus MARGIN.
 * All geometry is tile/cell-space (pure); the renderer converts with tileToWorld.
 * Rect = { cx, cy, w, h } in cells, top-left anchored.
 */

export const GRID_TILE_COLS = 22;
export const GRID_TILE_ROWS = 16;

export const CELL_COLS = GRID_TILE_COLS * 2;
export const CELL_ROWS = GRID_TILE_ROWS * 2;

/** Buildable cell rect (whole grid). Rubble sectors (citySectors.js) gate which cells are usable. */
export const BUILD_RECT = { cx: 0, cy: 0, w: CELL_COLS, h: CELL_ROWS };

/**
 * Tiles of empty ground drawn around the buildable rect + camera overhang room.
 * Wide enough that the camera clamp (isoMath RING) never reveals the void edge;
 * the surround is filled with the edge forest (cityGround tree scatter).
 */
export const GRID_MARGIN_TILES = 9;

/** HQ (townhall) footprint is a fixed 4×4 pinned at the grid center — the road skeleton anchors on it. */
const HQ_W = 4, HQ_H = 4;
export const HQ_RECT = {
  cx: Math.round(CELL_COLS / 2 - HQ_W / 2),
  cy: Math.round(CELL_ROWS / 2 - HQ_H / 2),
  w: HQ_W, h: HQ_H,
};

export function cellKey(cx, cy) { return `${cx},${cy}`; }

/**
 * Fixed road skeleton (ADR 0022 §4): a ring around the HQ + four arterials
 * (N/E/S/W) reaching the grid edge. Deterministic from the grid; cells are
 * UNBUILDABLE. Pure — never serialized.
 */
function buildSkeleton() {
  const set = new Set();
  const r0x = HQ_RECT.cx - 1, r1x = HQ_RECT.cx + HQ_RECT.w;
  const r0y = HQ_RECT.cy - 1, r1y = HQ_RECT.cy + HQ_RECT.h;
  const midCol = HQ_RECT.cx + 1;
  const midRow = HQ_RECT.cy + 1;
  for (let x = r0x; x <= r1x; x++) { set.add(cellKey(x, r0y)); set.add(cellKey(x, r1y)); }
  for (let y = r0y; y <= r1y; y++) { set.add(cellKey(r0x, y)); set.add(cellKey(r1x, y)); }
  for (let y = 0; y < r0y; y++)             set.add(cellKey(midCol, y));
  for (let y = r1y + 1; y < CELL_ROWS; y++) set.add(cellKey(midCol, y));
  for (let x = r1x + 1; x < CELL_COLS; x++) set.add(cellKey(x, midRow));
  for (let x = 0; x < r0x; x++)             set.add(cellKey(x, midRow));
  return set;
}

export const SKELETON = buildSkeleton();

export function isSkeletonCell(cx, cy) { return SKELETON.has(cellKey(cx, cy)); }

/** Does a footprint rect overlap any skeleton cell? Skeleton cells are unbuildable. */
export function rectHitsSkeleton(cx, cy, w, h) {
  for (let y = cy; y < cy + h; y++)
    for (let x = cx; x < cx + w; x++)
      if (SKELETON.has(cellKey(x, y))) return true;
  return false;
}

/** Building category → district cluster (packer bias + UI grouping). */
export const CATEGORY_ZONE = {
  production: 'production',
  military:   'military',
  core:       'civic',
  special:    'civic',
  population: 'residential',
};

/** Cell → fractional tile (diamond) coordinate. */
export function cellToTile(cx, cy) {
  return { col: cx / 2, row: cy / 2 };
}

// A footprint occupies cell CENTERS cx..cx+w-1 (cell (X,Y) center = tile (X/2, Y/2),
// matching how the ground/roads place cells). The diamond's outer vertices sit half a
// cell (±0.25 tile) beyond the edge cell centers. The rect boundary coords (cx+w, cy+h)
// are one cell past the last occupied cell — hence the -0.5 cell (-0.25 tile) shift here.
// Getting this wrong offsets every sprite/slot/badge half a cell off the road grid.

/** South (front) corner of a footprint rect in tile space — the sprite's bottom-center anchor. */
export function rectFrontTile(cx, cy, w, h) {
  return { col: (cx + w - 0.5) / 2, row: (cy + h - 0.5) / 2 };
}

/** Center of a footprint rect in tile space — badges, plaques, hover, fx. */
export function rectCenterTile(cx, cy, w, h) {
  return { col: (cx + (w - 1) / 2) / 2, row: (cy + (h - 1) / 2) / 2 };
}

/** Four diamond corners (N/E/S/W) of a footprint rect in tile space. */
export function rectCornersTile(cx, cy, w, h) {
  return {
    n: { col: (cx - 0.5) / 2,     row: (cy - 0.5) / 2 },
    e: { col: (cx + w - 0.5) / 2, row: (cy - 0.5) / 2 },
    s: { col: (cx + w - 0.5) / 2, row: (cy + h - 0.5) / 2 },
    w: { col: (cx - 0.5) / 2,     row: (cy + h - 0.5) / 2 },
  };
}

/** Axis-aligned overlap of two cell rects. */
export function rectsOverlap(a, b) {
  return a.cx < b.cx + b.w && b.cx < a.cx + a.w &&
         a.cy < b.cy + b.h && b.cy < a.cy + a.h;
}

/** Is a footprint rect fully inside the buildable area? */
export function inBounds(cx, cy, w, h) {
  return cx >= BUILD_RECT.cx && cy >= BUILD_RECT.cy &&
         cx + w <= BUILD_RECT.cx + BUILD_RECT.w &&
         cy + h <= BUILD_RECT.cy + BUILD_RECT.h;
}

/** Clamp a footprint top-left so the whole rect stays in bounds. */
export function clampRect(cx, cy, w, h) {
  return {
    cx: Math.max(BUILD_RECT.cx, Math.min(cx, BUILD_RECT.cx + BUILD_RECT.w - w)),
    cy: Math.max(BUILD_RECT.cy, Math.min(cy, BUILD_RECT.cy + BUILD_RECT.h - h)),
  };
}
