import test from 'node:test';
import assert from 'node:assert/strict';

import {
  terrainAt, isBuildableCell, generateFillerPois, curatedPx, gridStats,
} from '../../js/entities/data/gridGen.js';
import {
  GRID, SECTOR, TERRAIN, WORLD_SEED, CURATED_CELLS,
  cellToPx, pxToCell, cellInBounds, sectorCellRect, regionAtCell,
} from '../../js/entities/data/worldGrid.js';
import { WORLD_MAP } from '../../js/entities/GAME_DATA.js';

const TERRAIN_TYPES = new Set(Object.values(TERRAIN));
const FACTIONS = WORLD_MAP.factions;
const REGIONS = WORLD_MAP.regions;

test('terrain is stable for the same cell and seed', () => {
  for (const [cx, cy] of [[0, 0], [13, 47], [95, 95], [48, 48]]) {
    assert.equal(terrainAt(cx, cy), terrainAt(cx, cy));
    assert.ok(TERRAIN_TYPES.has(terrainAt(cx, cy)), `cell ${cx},${cy} produced unknown terrain`);
  }
});

test('a different seed produces a different world', () => {
  const withSeed = (seed) => Array.from({ length: 200 }, (_, i) => terrainAt(i % 20, Math.floor(i / 20), seed));
  assert.notDeepEqual(withSeed(WORLD_SEED), withSeed(WORLD_SEED + 1));
});

test('water and ridge cells are not buildable, others are', () => {
  for (let cx = 0; cx < GRID.cols; cx += 7) {
    for (let cy = 0; cy < GRID.rows; cy += 7) {
      const blocked = terrainAt(cx, cy) === TERRAIN.WATER || terrainAt(cx, cy) === TERRAIN.RIDGE;
      assert.equal(isBuildableCell(cx, cy), !blocked, `cell ${cx},${cy}`);
    }
  }
});

test('cell and pixel coords round-trip', () => {
  for (const [cx, cy] of [[0, 0], [16, 80], [95, 95]]) {
    const { x, y } = cellToPx(cx, cy);
    assert.deepEqual(pxToCell(x, y), { cx, cy });
  }
});

test('cellToPx returns the cell centre', () => {
  assert.deepEqual(cellToPx(0, 0), { x: GRID.cellPx / 2, y: GRID.cellPx / 2 });
});

test('bounds checking rejects cells outside the grid', () => {
  assert.ok(cellInBounds(0, 0));
  assert.ok(cellInBounds(GRID.cols - 1, GRID.rows - 1));
  assert.ok(!cellInBounds(-1, 0));
  assert.ok(!cellInBounds(0, GRID.rows));
});

test('the nine sectors tile the grid without gaps', () => {
  assert.equal(SECTOR.cols * SECTOR.cells, GRID.cols);
  assert.equal(SECTOR.rows * SECTOR.cells, GRID.rows);
  for (let cx = 0; cx < GRID.cols; cx += 5) {
    for (let cy = 0; cy < GRID.rows; cy += 5) {
      assert.ok(regionAtCell(cx, cy), `cell ${cx},${cy} belongs to no region`);
    }
  }
});

test('every curated POI cell lands inside its own region sector', () => {
  for (const poi of WORLD_MAP.pois.filter(p => !p.id.startsWith('gen_'))) {
    const cell = CURATED_CELLS[poi.id];
    assert.ok(cell, `curated POI '${poi.id}' has no mapped cell`);
    assert.equal(regionAtCell(cell.cx, cell.cy), poi.regionId, `POI '${poi.id}' is in the wrong sector`);
  }
});

test('curatedPx matches the mapped cell and is null when unmapped', () => {
  assert.deepEqual(curatedPx('home_city'), cellToPx(CURATED_CELLS.home_city.cx, CURATED_CELLS.home_city.cy));
  assert.equal(curatedPx('not_a_poi'), null);
});

test('filler generation is byte-identical across runs', () => {
  const a = generateFillerPois(REGIONS, FACTIONS);
  const b = generateFillerPois(REGIONS, FACTIONS);
  assert.deepEqual(a, b);
});

test('a different seed moves the filler', () => {
  const a = generateFillerPois(REGIONS, FACTIONS);
  const b = generateFillerPois(REGIONS, FACTIONS, WORLD_SEED + 1);
  assert.notDeepEqual(a, b);
});

test('filler ids are unique and namespaced by region', () => {
  const seen = new Set();
  for (const poi of generateFillerPois(REGIONS, FACTIONS)) {
    assert.ok(!seen.has(poi.id), `duplicate filler id '${poi.id}'`);
    seen.add(poi.id);
    assert.equal(poi.id.startsWith(`gen_${poi.regionId}_`), true, `id '${poi.id}' misnames its region`);
  }
});

test('filler never collides with a curated POI id', () => {
  const curated = new Set(Object.keys(CURATED_CELLS));
  for (const poi of generateFillerPois(REGIONS, FACTIONS)) {
    assert.ok(!curated.has(poi.id), `filler '${poi.id}' shadows a curated POI`);
  }
});

test('every region gets filler within the configured band', () => {
  const filler = generateFillerPois(REGIONS, FACTIONS);
  for (const region of REGIONS) {
    const count = filler.filter(p => p.regionId === region.id).length;
    assert.ok(count >= 8 && count <= 14, `region '${region.id}' got ${count} filler POIs`);
  }
});

test('filler sits inside its region sector and off unbuildable terrain', () => {
  for (const poi of generateFillerPois(REGIONS, FACTIONS)) {
    const { cx, cy } = pxToCell(poi.x, poi.y);
    const rect = sectorCellRect(poi.regionId);
    assert.ok(cx >= rect.cx0 && cx < rect.cx1 && cy >= rect.cy0 && cy < rect.cy1, `${poi.id} escaped its sector`);
    assert.ok(isBuildableCell(cx, cy), `${poi.id} sits on unbuildable terrain`);
  }
});

test('filler is only nodes or camps, and camps always name a monster', () => {
  for (const poi of generateFillerPois(REGIONS, FACTIONS)) {
    assert.ok(poi.type === 'resource_node' || poi.type === 'camp', `${poi.id} has type '${poi.type}'`);
    if (poi.type === 'camp') assert.ok(poi.monsterId, `camp '${poi.id}' has no monster`);
    else assert.ok(poi.resource && poi.capacity > 0, `node '${poi.id}' is not gatherable`);
  }
});

test('a faction with no enemy pool yields resource nodes only', () => {
  const neutral = REGIONS.filter(r => !(FACTIONS[r.factionId]?.enemyTypes?.length));
  assert.ok(neutral.length > 0, 'expected at least one region with no enemy pool');
  const filler = generateFillerPois(neutral, FACTIONS);
  for (const poi of filler) assert.equal(poi.type, 'resource_node', `${poi.id} should be a node`);
});

test('filler levels follow their region tier', () => {
  for (const poi of generateFillerPois(REGIONS, FACTIONS)) {
    const tier = REGIONS.find(r => r.id === poi.regionId).tier ?? 1;
    assert.equal(poi.level, tier, `${poi.id} level does not match its region tier`);
  }
});

test('grid stats report the configured geometry', () => {
  assert.deepEqual(gridStats(), {
    cols: GRID.cols, rows: GRID.rows, cellPx: GRID.cellPx, sectorCells: SECTOR.cells,
  });
});
