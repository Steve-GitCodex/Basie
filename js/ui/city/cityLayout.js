/**
 * cityLayout.js
 * Derives the renderable ground layout from the city blueprint: per-cell
 * ground tiles (district grounds, road tiles with orientation), the
 * decorative terrain ring, decoration props, and the road graph used by
 * ambient walkers and the drone.
 */
import { CITY_BLUEPRINT, isRoad, zoneAt, plotAt } from '../../entities/GAME_DATA.js';
import { GRID_COLS, GRID_ROWS, RING } from './isoMath.js';

/** Ground tile key per district zone (see GROUND_TILES in cityAssets). */
const ZONE_GROUND = {
  production:  'sand',
  civic:       'plaza',
  residential: 'grassAlt',
  military:    'lot',
};

/** The main east–west avenue (drone patrol + runs off the island edges). */
export const AVENUE_ROW = 7;

/** Deterministic per-cell hash so terrain variety is stable across loads. */
function cellHash(col, row) {
  let h = (col * 31 + row * 17 + 7) | 0;
  h = (h ^ (h << 5)) & 0xffff;
  return h / 0xffff;
}

function roadKeyFor(col, row) {
  const alongCols = isRoad(col - 1, row) || isRoad(col + 1, row);
  const alongRows = isRoad(col, row - 1) || isRoad(col, row + 1);
  if (alongCols && alongRows) return 'road';     // intersection — plain asphalt
  return alongRows ? 'roadRow' : 'roadCol';
}

/**
 * Ground tile key for any cell, including ring cells.
 * Returns null for cells outside grid + ring.
 */
export function groundKeyFor(col, row) {
  const inGrid = col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;

  if (inGrid) {
    if (isRoad(col, row)) return roadKeyFor(col, row);
    return ZONE_GROUND[zoneAt(col, row)] ?? 'grass';
  }

  // Decorative ring
  const inRing = col >= -RING && col < GRID_COLS + RING && row >= -RING && row < GRID_ROWS + RING;
  if (!inRing) return null;

  // The avenue continues off the island edges
  if (row === AVENUE_ROW) return 'roadCol';

  const h = cellHash(col, row);
  const isOuterEdge =
    col === -RING || col === GRID_COLS + RING - 1 ||
    row === -RING || row === GRID_ROWS + RING - 1;

  if (isOuterEdge) return h < 0.35 ? 'hill' : (h < 0.7 ? 'grass' : 'grassAlt');
  if (h < 0.08) return 'hill';
  if (h < 0.16) return 'dirt';
  return h < 0.6 ? 'grass' : 'grassAlt';
}

/** All cells (grid + ring) in painter's order (ascending col + row). */
export function allGroundCells() {
  const cells = [];
  for (let row = -RING; row < GRID_ROWS + RING; row++) {
    for (let col = -RING; col < GRID_COLS + RING; col++) {
      const key = groundKeyFor(col, row);
      if (key) cells.push({ col, row, key });
    }
  }
  cells.sort((a, b) => (a.col + a.row) - (b.col + b.row) || a.row - b.row);
  return cells;
}

/**
 * Static decoration props: blueprint deco (parks/lamps) + procedural trees
 * in district gap cells and on the ring. dx/dy are world-px offsets from
 * the tile's diamond center.
 */
export function allProps() {
  const props = [];
  const TREE_SPOTS = [[-26, -6], [16, 6], [-2, -16], [24, -8]];

  // Hand-placed blueprint deco
  for (const d of CITY_BLUEPRINT.deco) {
    if (d.kind === 'tree') {
      props.push({ col: d.col, row: d.row, kind: 'tree', dx: -14, dy: -4 });
      props.push({ col: d.col, row: d.row, kind: 'tree', dx: 14, dy: 8 });
    } else if (d.kind === 'lamp') {
      props.push({ col: d.col, row: d.row, kind: 'lamp', dx: 0, dy: 0 });
    }
    // 'plaza' deco is ground-only — civic ground already reads as plaza
  }

  for (let row = -RING; row < GRID_ROWS + RING; row++) {
    for (let col = -RING; col < GRID_COLS + RING; col++) {
      const key = groundKeyFor(col, row);
      if (!key || key.startsWith('road')) continue;
      const h = cellHash(col, row);
      const inGrid = col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;

      if (inGrid) {
        // District gap cells (no plot, no deco): sparse greenery
        if (plotAt(col, row) || CITY_BLUEPRINT.deco.some(d => d.col === col && d.row === row)) continue;
        if (h < 0.22) {
          const [dx, dy] = TREE_SPOTS[Math.floor(h * 17) % TREE_SPOTS.length];
          props.push({ col, row, kind: 'tree', dx, dy });
        }
        // Lampposts along the avenue sidewalks
        if (row === AVENUE_ROW - 1 && col % 4 === 2) {
          props.push({ col, row, kind: 'lamp', dx: 20, dy: 18 });
        }
      } else if ((key === 'grass' || key === 'grassAlt') && h < 0.3) {
        // Ring greenery
        const [dx, dy] = TREE_SPOTS[Math.floor(h * 13) % TREE_SPOTS.length];
        props.push({ col, row, kind: 'tree', dx, dy });
      }
    }
  }
  return props;
}

/**
 * Road graph for ambient agents: every road cell (grid + the avenue's ring
 * extension) mapped to its road neighbours.
 * @returns {Map<string, {col:number,row:number}[]>}
 */
export function roadGraph() {
  const cells = new Set();
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      if (isRoad(col, row)) cells.add(`${col},${row}`);
    }
  }
  for (let col = -RING; col < GRID_COLS + RING; col++) cells.add(`${col},${AVENUE_ROW}`);

  const graph = new Map();
  for (const key of cells) {
    const [c, r] = key.split(',').map(Number);
    const n = [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]]
      .filter(([cc, rr]) => cells.has(`${cc},${rr}`))
      .map(([cc, rr]) => ({ col: cc, row: rr }));
    graph.set(key, n);
  }
  return graph;
}

/** Drone patrol waypoints — glides along the avenue, edge to edge. */
export function dronePath() {
  const path = [];
  for (let col = -RING; col < GRID_COLS + RING; col++) {
    path.push({ col, row: AVENUE_ROW });
  }
  return path;
}
