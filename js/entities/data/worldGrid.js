/**
 * data/worldGrid.js
 * Geometry owner for the tile-grid world (grit reskin Phase B1, @see
 * docs/20-decisions/0011-grid-world-geometry.md). `worldMap.js` stays the source
 * for region/faction/curated-POI *definitions*; this file owns where things sit.
 *
 * Cell coords are (cx, cy) with cy growing downward. World pixels are derived —
 * everything downstream (marchMath distances, WorldCamera, hit-testing) keeps
 * consuming px unchanged.
 */

export const GRID = { cols: 96, rows: 96, cellPx: 100 };
export const SECTOR = { cols: 3, rows: 3, cells: 32 };
export const WORLD_SEED = 0x5ba51e;

export const WORLD_BOUNDS = { w: GRID.cols * GRID.cellPx, h: GRID.rows * GRID.cellPx };

export const TERRAIN = {
  WASTELAND: 'wasteland',
  CRACKED: 'cracked_earth',
  FOREST: 'dead_forest',
  WATER: 'water',
  RIDGE: 'ridge',
  RUBBLE: 'ruin_rubble',
};

export const SECTOR_OF = {
  mistwood:     { sc: 0, sr: 0 },
  goblin_crest: { sc: 1, sr: 0 },
  dragon_spire: { sc: 2, sr: 0 },
  west_warrens: { sc: 0, sr: 1 },
  command_ruin: { sc: 1, sr: 1 },
  ember_reach:  { sc: 2, sr: 1 },
  home_vale:    { sc: 0, sr: 2 },
  red_lowlands: { sc: 1, sr: 2 },
  frost_hold:   { sc: 2, sr: 2 },
};

export const CURATED_CELLS = {
  home_city:   { cx: 16, cy: 80 },
  rn_oak:      { cx: 10, cy: 72 },
  rn_well:     { cx: 21, cy: 87 },
  ruin_vale:   { cx: 7,  cy: 89 },
  op_relay:    { cx: 26, cy: 70 },

  sh_west:     { cx: 16, cy: 42 },
  rn_iron:     { cx: 10, cy: 52 },
  camp_west:   { cx: 21, cy: 52 },
  ruin_warren: { cx: 7,  cy: 37 },
  op_shrine:   { cx: 26, cy: 44 },

  sh_red:      { cx: 48, cy: 74 },
  rn_grain:    { cx: 41, cy: 87 },
  camp_red:    { cx: 55, cy: 86 },
  wb_roc:      { cx: 60, cy: 71 },

  sh_mist:     { cx: 16, cy: 12 },
  rn_timber:   { cx: 22, cy: 22 },
  op_tower:    { cx: 27, cy: 12 },

  sh_frost:    { cx: 80, cy: 74 },
  rn_ice:      { cx: 85, cy: 87 },

  sh_crest:    { cx: 48, cy: 12 },
  rn_crest:    { cx: 41, cy: 22 },

  sh_ember:    { cx: 80, cy: 42 },
  rn_ore:      { cx: 85, cy: 52 },

  sh_dragon:   { cx: 80, cy: 12 },
  rn_hunt:     { cx: 74, cy: 22 },

  sh_ruin:     { cx: 48, cy: 48 },
};

export function cellToPx(cx, cy) {
  return { x: (cx + 0.5) * GRID.cellPx, y: (cy + 0.5) * GRID.cellPx };
}

export function pxToCell(x, y) {
  return { cx: Math.floor(x / GRID.cellPx), cy: Math.floor(y / GRID.cellPx) };
}

export function cellInBounds(cx, cy) {
  return cx >= 0 && cy >= 0 && cx < GRID.cols && cy < GRID.rows;
}

export function sectorCellRect(regionId) {
  const s = SECTOR_OF[regionId];
  if (!s) return null;
  return {
    cx0: s.sc * SECTOR.cells,
    cy0: s.sr * SECTOR.cells,
    cx1: (s.sc + 1) * SECTOR.cells,
    cy1: (s.sr + 1) * SECTOR.cells,
  };
}

export function sectorPxRect(regionId) {
  const r = sectorCellRect(regionId);
  if (!r) return null;
  return {
    x0: r.cx0 * GRID.cellPx,
    y0: r.cy0 * GRID.cellPx,
    x1: r.cx1 * GRID.cellPx,
    y1: r.cy1 * GRID.cellPx,
  };
}

export function sectorCenterPx(regionId) {
  const r = sectorPxRect(regionId);
  if (!r) return null;
  return { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 };
}

export function regionAtCell(cx, cy) {
  const sc = Math.floor(cx / SECTOR.cells);
  const sr = Math.floor(cy / SECTOR.cells);
  return Object.keys(SECTOR_OF).find(id => SECTOR_OF[id].sc === sc && SECTOR_OF[id].sr === sr) ?? null;
}
