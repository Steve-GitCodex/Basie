/**
 * cityBlueprint.js
 * The hand-designed city plan (Slot-and-Graph model): a road network with
 * districts hanging off it, fixed building plots that always front a street,
 * and decoration fill. Buildings are assigned to plots at runtime
 * (BuildingManager placements) — the blueprint itself never changes.
 *
 * Grid: 22×16 logical tiles, surrounded by a decorative terrain ring.
 *
 * Layout sketch (R = road):
 *
 *        cols 0........11........21
 *   row 0  prod plots
 *   row 1  RRRRRRRRRRRRRRRRRRRR     field lane
 *   row 2  prod plots
 *   row 3      RRRRRRRRRRRRRR       ring road (north)
 *   rows 4-6   res | civic | mil    (col 4 / col 11 / col 17 roads vertical)
 *   row 7  RRRRRRRRRRRRRRRRRRRRRR   main avenue
 *   rows 8-11  res | civic | mil
 *   row 12     RRRRRRRRRRRRRR       ring road (south)
 *   rows 13-15 residential | military outskirts
 */

/** Inclusive cell rectangle helper. */
function rect(c0, r0, c1, r1) {
  return { c0, r0, c1, r1 };
}

export const CITY_BLUEPRINT = {
  cols: 22,
  rows: 16,
  ring: 5, // decorative terrain ring width (tiles beyond the grid)

  /**
   * Road polylines (inclusive endpoints, axis-aligned segments).
   * The renderer derives per-tile orientation (straight / intersection)
   * from neighbouring road cells.
   */
  roads: [
    { path: [[0, 7], [21, 7]] },   // main avenue (east–west, runs off both edges)
    { path: [[11, 0], [11, 15]] }, // main avenue (north–south)
    { path: [[2, 1], [19, 1]] },   // field lane through the production district
    { path: [[4, 3], [17, 3]] },   // ring road north
    { path: [[4, 12], [17, 12]] }, // ring road south
    { path: [[4, 3], [4, 12]] },   // ring road west
    { path: [[17, 3], [17, 12]] }, // ring road east
  ],

  /** District areas (for ground tint + zone rules). Roads override visually. */
  districts: [
    { zone: 'production',  area: rect(0, 0, 21, 2) },
    { zone: 'civic',       area: rect(5, 4, 16, 11) },
    { zone: 'residential', area: rect(0, 3, 3, 15) },
    { zone: 'residential', area: rect(4, 13, 10, 15) },
    { zone: 'military',    area: rect(18, 3, 21, 15) },
    { zone: 'military',    area: rect(11, 13, 17, 15) },
  ],

  /**
   * Building plots. Every plot is orthogonally adjacent to a road tile
   * (validated below). `fixed` pins a building type to the plot (HQ only).
   */
  plots: [
    // ── Civic (inner ring, around the central crossroads) ──────────────
    { id: 'civic_hq', zone: 'civic', col: 10, row: 6, fixed: 'townhall' },
    { id: 'civic_01', zone: 'civic', col: 6,  row: 4 },
    { id: 'civic_02', zone: 'civic', col: 8,  row: 4 },
    { id: 'civic_03', zone: 'civic', col: 13, row: 4 },
    { id: 'civic_04', zone: 'civic', col: 15, row: 4 },
    { id: 'civic_05', zone: 'civic', col: 6,  row: 6 },
    { id: 'civic_06', zone: 'civic', col: 12, row: 6 },
    { id: 'civic_07', zone: 'civic', col: 15, row: 6 },
    { id: 'civic_08', zone: 'civic', col: 6,  row: 8 },
    { id: 'civic_09', zone: 'civic', col: 8,  row: 8 },
    { id: 'civic_10', zone: 'civic', col: 13, row: 8 },
    { id: 'civic_11', zone: 'civic', col: 15, row: 8 },
    { id: 'civic_12', zone: 'civic', col: 8,  row: 11 },
    { id: 'civic_13', zone: 'civic', col: 13, row: 11 },

    // ── Production (north fields, lining the field lane + ring road) ───
    { id: 'prod_01', zone: 'production', col: 2,  row: 0 },
    { id: 'prod_02', zone: 'production', col: 4,  row: 0 },
    { id: 'prod_03', zone: 'production', col: 6,  row: 0 },
    { id: 'prod_04', zone: 'production', col: 8,  row: 0 },
    { id: 'prod_05', zone: 'production', col: 10, row: 0 },
    { id: 'prod_06', zone: 'production', col: 13, row: 0 },
    { id: 'prod_07', zone: 'production', col: 15, row: 0 },
    { id: 'prod_08', zone: 'production', col: 17, row: 0 },
    { id: 'prod_09', zone: 'production', col: 19, row: 0 },
    { id: 'prod_10', zone: 'production', col: 2,  row: 2 },
    { id: 'prod_11', zone: 'production', col: 4,  row: 2 },
    { id: 'prod_12', zone: 'production', col: 6,  row: 2 },
    { id: 'prod_13', zone: 'production', col: 8,  row: 2 },
    { id: 'prod_14', zone: 'production', col: 10, row: 2 },
    { id: 'prod_15', zone: 'production', col: 13, row: 2 },
    { id: 'prod_16', zone: 'production', col: 15, row: 2 },
    { id: 'prod_17', zone: 'production', col: 17, row: 2 },
    { id: 'prod_18', zone: 'production', col: 19, row: 2 },
    { id: 'prod_19', zone: 'production', col: 12, row: 0 },
    { id: 'prod_20', zone: 'production', col: 12, row: 2 },

    // ── Residential (west side + south-west, lining ring road west) ────
    { id: 'res_01', zone: 'residential', col: 3, row: 4 },
    { id: 'res_02', zone: 'residential', col: 3, row: 5 },
    { id: 'res_03', zone: 'residential', col: 3, row: 6 },
    { id: 'res_04', zone: 'residential', col: 3, row: 8 },
    { id: 'res_05', zone: 'residential', col: 3, row: 9 },
    { id: 'res_06', zone: 'residential', col: 3, row: 10 },
    { id: 'res_07', zone: 'residential', col: 3, row: 11 },
    { id: 'res_08', zone: 'residential', col: 5, row: 13 },
    { id: 'res_09', zone: 'residential', col: 7, row: 13 },
    { id: 'res_10', zone: 'residential', col: 9, row: 13 },
    { id: 'res_11', zone: 'residential', col: 10, row: 13 },

    // ── Military (east side + south-east, lining ring road east) ───────
    { id: 'mil_01', zone: 'military', col: 18, row: 4 },
    { id: 'mil_02', zone: 'military', col: 18, row: 5 },
    { id: 'mil_03', zone: 'military', col: 18, row: 6 },
    { id: 'mil_04', zone: 'military', col: 20, row: 6 },
    { id: 'mil_05', zone: 'military', col: 18, row: 8 },
    { id: 'mil_06', zone: 'military', col: 20, row: 8 },
    { id: 'mil_07', zone: 'military', col: 18, row: 9 },
    { id: 'mil_08', zone: 'military', col: 18, row: 10 },
    { id: 'mil_09', zone: 'military', col: 18, row: 11 },
    { id: 'mil_10', zone: 'military', col: 12, row: 13 },
    { id: 'mil_11', zone: 'military', col: 13, row: 13 },
    { id: 'mil_12', zone: 'military', col: 14, row: 13 },
    { id: 'mil_13', zone: 'military', col: 15, row: 13 },
    { id: 'mil_14', zone: 'military', col: 16, row: 13 },
    { id: 'mil_15', zone: 'military', col: 17, row: 13 },
  ],

  /**
   * Hand-placed decoration (parks/plazas in district gaps).
   * Tree/lamp scatter beyond these is procedural in cityLayout.
   */
  deco: [
    { kind: 'plaza', col: 9,  row: 5 }, { kind: 'plaza', col: 12, row: 5 },
    { kind: 'plaza', col: 9,  row: 8 }, { kind: 'plaza', col: 12, row: 8 },
    { kind: 'tree',  col: 5,  row: 5 }, { kind: 'tree',  col: 16, row: 5 },
    { kind: 'tree',  col: 5,  row: 10 }, { kind: 'tree', col: 16, row: 10 },
    { kind: 'tree',  col: 6,  row: 11 }, { kind: 'tree', col: 15, row: 11 },
  ],
};

/** Building category → plot zone. */
export const CATEGORY_ZONE = {
  production: 'production',
  military:   'military',
  core:       'civic',
  special:    'civic',
  population: 'residential',
};

// ── Derived lookups ─────────────────────────────────────────────────────

const roadSet = new Set();
for (const { path } of CITY_BLUEPRINT.roads) {
  for (let i = 0; i < path.length - 1; i++) {
    const [c0, r0] = path[i];
    const [c1, r1] = path[i + 1];
    const dc = Math.sign(c1 - c0), dr = Math.sign(r1 - r0);
    let c = c0, r = r0;
    roadSet.add(`${c},${r}`);
    while (c !== c1 || r !== r1) { c += dc; r += dr; roadSet.add(`${c},${r}`); }
  }
}

export function isRoad(col, row) { return roadSet.has(`${col},${row}`); }

export function zoneAt(col, row) {
  for (const { zone, area } of CITY_BLUEPRINT.districts) {
    if (col >= area.c0 && col <= area.c1 && row >= area.r0 && row <= area.r1) return zone;
  }
  return null;
}

export function plotAt(col, row) {
  return CITY_BLUEPRINT.plots.find(p => p.col === col && p.row === row) ?? null;
}

export function plotById(id) {
  return CITY_BLUEPRINT.plots.find(p => p.id === id) ?? null;
}

export function plotsInZone(zone) {
  return CITY_BLUEPRINT.plots.filter(p => p.zone === zone);
}

// ── Dev-time validation (logs loudly, never throws in production) ──────

(function validate() {
  const seen = new Set();
  for (const p of CITY_BLUEPRINT.plots) {
    if (seen.has(p.id)) console.error(`[cityBlueprint] duplicate plot id ${p.id}`);
    seen.add(p.id);
    if (isRoad(p.col, p.row)) {
      console.error(`[cityBlueprint] plot ${p.id} sits on a road (${p.col},${p.row})`);
    }
    const nextToRoad = isRoad(p.col + 1, p.row) || isRoad(p.col - 1, p.row) ||
                       isRoad(p.col, p.row + 1) || isRoad(p.col, p.row - 1);
    if (!nextToRoad) {
      console.error(`[cityBlueprint] plot ${p.id} (${p.col},${p.row}) has no adjacent road`);
    }
    const key = `${p.col},${p.row}`;
    if (CITY_BLUEPRINT.plots.some(q => q !== p && `${q.col},${q.row}` === key)) {
      console.error(`[cityBlueprint] overlapping plots at (${key})`);
    }
  }
  for (const d of CITY_BLUEPRINT.deco) {
    if (isRoad(d.col, d.row) || plotAt(d.col, d.row)) {
      console.error(`[cityBlueprint] deco at (${d.col},${d.row}) collides with road/plot`);
    }
  }
})();
