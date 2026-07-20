/**
 * cityRoads.js
 * Auto-derived decorative roads for the base view (ADR 0022, Phase B — amended
 * §4). Roads are NEVER serialized: a pure function of the grid + placement rects,
 * regenerated on any layout change. Two-level hierarchy:
 *
 *   • Skeleton — a fixed ring around the HQ + four arterials (N/E/S/W) reaching
 *     the map edge. Deterministic from the grid; its cells are UNBUILDABLE
 *     (placement/move/packer reject them). Arterials render only through the core
 *     and cleared sectors, so they visibly extend as rubble clears.
 *   • Connectors — from each building's door cell to the nearest skeleton cell,
 *     pathed with BFS over free ground so a road NEVER crosses a footprint (the
 *     old L-paths did — that was the bug). Drawn lighter/narrower than skeleton.
 *
 * Walkers follow the combined visible graph.
 */
import { CELL_COLS, CELL_ROWS, SKELETON, coreContains, BUILDINGS_CONFIG } from '../../entities/GAME_DATA.js';
import { buildingIdOf } from '../../systems/building/cityPacker.js';

export function key(cx, cy) { return `${cx},${cy}`; }

/**
 * The building's visible door cell — the middle cell of the iso face given by
 * `side` ('sw' = front-left, 'se' = front-right, 's' = front corner). Always on
 * the footprint rect's perimeter.
 */
export function doorCell(rect, side = 's') {
  const maxX = rect.cx + rect.w - 1, maxY = rect.cy + rect.h - 1;
  if (side === 'sw') return { cx: rect.cx + Math.floor((rect.w - 1) / 2), cy: maxY };
  if (side === 'se') return { cx: maxX, cy: rect.cy + Math.floor((rect.h - 1) / 2) };
  return { cx: maxX, cy: maxY };
}

/** Door cell for a placement rect, using its building type's authored door side. */
function rectDoor(rect) {
  const bid = rect.buildingId ?? buildingIdOf(rect.instanceId);
  return doorCell(rect, BUILDINGS_CONFIG[bid]?.doorSide ?? 's');
}

const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** BFS from a door cell over free ground to the nearest visible-skeleton cell. */
function connectorPath(door, skeletonVisible, occupied, isCleared) {
  const start = key(door.cx, door.cy);
  const parent = new Map([[start, null]]);
  const queue = [door];
  let goal = null;
  while (queue.length) {
    const cur = queue.shift();
    const ck = key(cur.cx, cur.cy);
    if (skeletonVisible.has(ck) && ck !== start) { goal = cur; break; }
    for (const [dx, dy] of NEIGHBORS) {
      const nx = cur.cx + dx, ny = cur.cy + dy;
      if (nx < 0 || ny < 0 || nx >= CELL_COLS || ny >= CELL_ROWS) continue;
      const nk = key(nx, ny);
      if (parent.has(nk)) continue;
      const isSkel = skeletonVisible.has(nk);
      const ground = isCleared(nx, ny) && !occupied.has(nk);
      if (!isSkel && !ground) continue;
      parent.set(nk, ck);
      queue.push({ cx: nx, cy: ny });
    }
  }
  if (!goal) return [];
  const cells = [];
  let k = key(goal.cx, goal.cy);
  while (k && k !== start) {
    if (!skeletonVisible.has(k)) cells.push(k); // connector = free-ground cells only
    k = parent.get(k);
  }
  return cells;
}

/**
 * Derive the visible road graph from placement rects.
 * @param {{instanceId,cx,cy,w,h}[]} rects
 * @param {(cx:number,cy:number)=>boolean} isCleared - core or a cleared sector
 * @returns {{ skeleton: Set<string>, connectors: Set<string>, cells: Set<string> }}
 */
export function deriveRoads(rects, isCleared = () => true) {
  const skeleton = new Set();
  for (const k of SKELETON) {
    const [cx, cy] = k.split(',').map(Number);
    if (coreContains(cx, cy) || isCleared(cx, cy)) skeleton.add(k);
  }

  const connectors = new Set();
  if (rects.length) {
    const occupied = new Set();
    for (const r of rects)
      for (let y = r.cy; y < r.cy + r.h; y++)
        for (let x = r.cx; x < r.cx + r.w; x++) occupied.add(key(x, y));

    const ordered = [...rects].sort((a, b) =>
      a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0);
    for (const r of ordered)
      for (const c of connectorPath(rectDoor(r), skeleton, occupied, isCleared)) connectors.add(c);
  }

  const cells = new Set([...skeleton, ...connectors]);
  return { skeleton, connectors, cells };
}

/** Adjacency graph over a road-cell set for ambient walkers. @returns {Map<string,{cx,cy}[]>} */
export function roadGraph(cells) {
  const graph = new Map();
  for (const k of cells) {
    const [cx, cy] = k.split(',').map(Number);
    const n = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]
      .filter(([x, y]) => cells.has(key(x, y)))
      .map(([x, y]) => ({ cx: x, cy: y }));
    graph.set(k, n);
  }
  return graph;
}
