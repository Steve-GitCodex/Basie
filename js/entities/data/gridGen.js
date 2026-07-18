/**
 * data/gridGen.js
 * Deterministic world generation for the tile grid (grit reskin Phase B1).
 * Pure functions of (cell, seed) — nothing generated here is ever serialized;
 * terrain and filler POIs regenerate identically every load, so filler POI ids
 * stay stable for worldState.js reconcile (@see docs/20-decisions/0011).
 */

import {
  GRID, SECTOR, TERRAIN, WORLD_SEED,
  CURATED_CELLS, cellToPx, sectorCellRect,
} from './worldGrid.js';

const FILLER_MIN_SPACING = 3;
const FILLER_EDGE_MARGIN = 2;
const FILLER_PER_SECTOR = { min: 8, max: 14 };
const NODE_RESOURCES = ['wood', 'stone', 'iron', 'food', 'water'];

const NODE_META = {
  wood:  { name: 'Timber Stand',  icon: '🌲' },
  stone: { name: 'Rubble Quarry', icon: '🪨' },
  iron:  { name: 'Scrap Field',   icon: '⛏️' },
  food:  { name: 'Forage Patch',  icon: '🌾' },
  water: { name: 'Runoff Cistern',icon: '💧' },
};

function hash3(x, y, seed) {
  let h = seed >>> 0;
  h = Math.imul(h ^ (x >>> 0), 0x85ebca6b);
  h = Math.imul(h ^ (y >>> 0), 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function hashStr(str, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
  }
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function smooth(t) { return t * t * (3 - 2 * t); }

function valueNoise(x, y, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = smooth(x - x0), fy = smooth(y - y0);
  const n00 = hash3(x0, y0, seed), n10 = hash3(x0 + 1, y0, seed);
  const n01 = hash3(x0, y0 + 1, seed), n11 = hash3(x0 + 1, y0 + 1, seed);
  return (n00 * (1 - fx) + n10 * fx) * (1 - fy) + (n01 * (1 - fx) + n11 * fx) * fy;
}

function fbm(x, y, seed, octaves = 3) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, y * freq, seed + i * 7919) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** Stable per-cell random in [0,1) — vary `salt` for independent draws. */
export function cellNoise(cx, cy, salt = 0, seed = WORLD_SEED) {
  return hash3(cx, cy, (seed + salt) >>> 0);
}

export function terrainAt(cx, cy, seed = WORLD_SEED) {
  const elevation = fbm(cx / 14, cy / 14, seed);
  const moisture = fbm(cx / 9, cy / 9, seed + 0x9e37);
  if (elevation < 0.28) return TERRAIN.WATER;
  if (elevation > 0.74) return TERRAIN.RIDGE;
  if (moisture > 0.66) return TERRAIN.FOREST;
  if (moisture < 0.34) return TERRAIN.RUBBLE;
  return elevation > 0.52 ? TERRAIN.CRACKED : TERRAIN.WASTELAND;
}

export function isBuildableCell(cx, cy, seed = WORLD_SEED) {
  const t = terrainAt(cx, cy, seed);
  return t !== TERRAIN.WATER && t !== TERRAIN.RIDGE;
}

function curatedCellsInSector(rect) {
  return Object.values(CURATED_CELLS).filter(
    c => c.cx >= rect.cx0 && c.cx < rect.cx1 && c.cy >= rect.cy0 && c.cy < rect.cy1,
  );
}

function farEnough(cx, cy, taken) {
  return taken.every(t => Math.abs(t.cx - cx) + Math.abs(t.cy - cy) >= FILLER_MIN_SPACING);
}

function pickFillerCells(regionId, count, seed) {
  const rect = sectorCellRect(regionId);
  const taken = [...curatedCellsInSector(rect)];
  const out = [];
  const inner = {
    cx0: rect.cx0 + FILLER_EDGE_MARGIN, cx1: rect.cx1 - FILLER_EDGE_MARGIN,
    cy0: rect.cy0 + FILLER_EDGE_MARGIN, cy1: rect.cy1 - FILLER_EDGE_MARGIN,
  };
  const span = { w: inner.cx1 - inner.cx0, h: inner.cy1 - inner.cy0 };
  for (let attempt = 0; attempt < 400 && out.length < count; attempt++) {
    const cx = inner.cx0 + Math.floor(hash3(attempt, out.length, seed) * span.w);
    const cy = inner.cy0 + Math.floor(hash3(out.length, attempt, seed + 0x1234) * span.h);
    if (!isBuildableCell(cx, cy, seed)) continue;
    if (!farEnough(cx, cy, taken)) continue;
    taken.push({ cx, cy });
    out.push({ cx, cy });
  }
  return out;
}

function fillerCount(regionId, seed) {
  const spread = FILLER_PER_SECTOR.max - FILLER_PER_SECTOR.min + 1;
  return FILLER_PER_SECTOR.min + Math.floor(hashStr(regionId, seed + 0x77) * spread);
}

function nodeFor(region, cell, index, seed) {
  const preferred = region.buff?.flavor === 'economic' ? region.buff.resource : null;
  const roll = hash3(cell.cx, cell.cy, seed + 0x5150);
  const resource = preferred && roll < 0.4
    ? preferred
    : NODE_RESOURCES[Math.floor(roll * NODE_RESOURCES.length) % NODE_RESOURCES.length];
  const tier = region.tier ?? 1;
  const { x, y } = cellToPx(cell.cx, cell.cy);
  return {
    id: `gen_${region.id}_${index}`,
    type: 'resource_node',
    regionId: region.id,
    name: NODE_META[resource].name,
    icon: NODE_META[resource].icon,
    x, y,
    level: tier,
    resource,
    gatherRate: 3 + tier,
    capacity: 600 + tier * 150,
    regenPerSec: 0.8 + tier * 0.2,
  };
}

function campFor(region, cell, index, faction, seed) {
  const pool = faction?.enemyTypes ?? [];
  if (!pool.length) return null;
  const pick = Math.floor(hash3(cell.cy, cell.cx, seed + 0x9001) * pool.length) % pool.length;
  const tier = region.tier ?? 1;
  const { x, y } = cellToPx(cell.cx, cell.cy);
  return {
    id: `gen_${region.id}_${index}`,
    type: 'camp',
    regionId: region.id,
    name: 'Scav Warband',
    icon: '👺',
    x, y,
    level: tier,
    monsterId: pool[pick],
    respawnMs: 1_800_000,
  };
}

/**
 * Filler POIs for every region, deterministic in id and position.
 * Neutral regions get resource nodes only — they have no faction enemy pool.
 */
export function generateFillerPois(regions, factions, seed = WORLD_SEED) {
  const out = [];
  for (const region of regions) {
    const cells = pickFillerCells(region.id, fillerCount(region.id, seed), seed);
    const faction = factions[region.factionId];
    cells.forEach((cell, i) => {
      const campRoll = hash3(cell.cx + 1, cell.cy + 1, seed + 0xbeef);
      const wantsCamp = campRoll < 0.4;
      const poi = wantsCamp ? campFor(region, cell, i, faction, seed) : null;
      out.push(poi ?? nodeFor(region, cell, i, seed));
    });
  }
  return out;
}

/** Cell-derived px position for a curated POI id, or null if unmapped. */
export function curatedPx(poiId) {
  const cell = CURATED_CELLS[poiId];
  return cell ? cellToPx(cell.cx, cell.cy) : null;
}

export function gridStats() {
  return { cols: GRID.cols, rows: GRID.rows, cellPx: GRID.cellPx, sectorCells: SECTOR.cells };
}
