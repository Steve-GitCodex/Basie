import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHUNK_CELLS, CHUNK_COLS, CHUNK_ROWS, LOD_ZOOM,
  chunkKey, cellToChunk, chunkCellRect, visibleChunkRange, useCellDetail,
} from '../../js/ui/world/gridLayer.js';
import { GRID, SECTOR } from '../../js/entities/data/worldGrid.js';

const SPAN = CHUNK_CELLS * GRID.cellPx;

test('the chunk grid tiles the cell grid exactly', () => {
  assert.equal(CHUNK_COLS * CHUNK_CELLS, GRID.cols);
  assert.equal(CHUNK_ROWS * CHUNK_CELLS, GRID.rows);
});

test('every chunk lies wholly inside one sector', () => {
  // GridLayer resolves tint/fog once per chunk from its top-left cell; a chunk
  // straddling two sectors would tint half its cells wrong.
  assert.equal(SECTOR.cells % CHUNK_CELLS, 0);
});

test('cellToChunk maps cells to their containing chunk', () => {
  assert.deepEqual(cellToChunk(0, 0), { kx: 0, ky: 0 });
  assert.deepEqual(cellToChunk(15, 15), { kx: 0, ky: 0 });
  assert.deepEqual(cellToChunk(16, 0), { kx: 1, ky: 0 });
  assert.deepEqual(cellToChunk(95, 95), { kx: CHUNK_COLS - 1, ky: CHUNK_ROWS - 1 });
});

test('chunkKey is unique per chunk', () => {
  const seen = new Set();
  for (let ky = 0; ky < CHUNK_ROWS; ky++) {
    for (let kx = 0; kx < CHUNK_COLS; kx++) seen.add(chunkKey(kx, ky));
  }
  assert.equal(seen.size, CHUNK_COLS * CHUNK_ROWS);
});

test('chunk cell rects partition the grid with no gaps or overlaps', () => {
  const covered = new Set();
  for (let ky = 0; ky < CHUNK_ROWS; ky++) {
    for (let kx = 0; kx < CHUNK_COLS; kx++) {
      const r = chunkCellRect(kx, ky);
      for (let cy = r.cy0; cy < r.cy1; cy++) {
        for (let cx = r.cx0; cx < r.cx1; cx++) {
          const key = `${cx},${cy}`;
          assert.ok(!covered.has(key), `cell ${key} covered by two chunks`);
          covered.add(key);
        }
      }
    }
  }
  assert.equal(covered.size, GRID.cols * GRID.rows);
});

test('chunkCellRect agrees with cellToChunk', () => {
  for (const [cx, cy] of [[0, 0], [17, 3], [48, 48], [95, 95]]) {
    const { kx, ky } = cellToChunk(cx, cy);
    const r = chunkCellRect(kx, ky);
    assert.ok(cx >= r.cx0 && cx < r.cx1 && cy >= r.cy0 && cy < r.cy1);
  }
});

test('visibleChunkRange covers the viewport rect', () => {
  const rect = { minX: SPAN * 1.5, minY: SPAN * 0.5, maxX: SPAN * 2.5, maxY: SPAN * 1.2 };
  assert.deepEqual(visibleChunkRange(rect), { kx0: 1, ky0: 0, kx1: 2, ky1: 1 });
});

test('visibleChunkRange clamps to the grid when panned into the margin', () => {
  const world = GRID.cols * GRID.cellPx;
  const r = visibleChunkRange({ minX: -5000, minY: -5000, maxX: world + 5000, maxY: world + 5000 });
  assert.deepEqual(r, { kx0: 0, ky0: 0, kx1: CHUNK_COLS - 1, ky1: CHUNK_ROWS - 1 });
});

test('a fully zoomed-out view still yields a finite chunk count', () => {
  const world = GRID.cols * GRID.cellPx;
  const r = visibleChunkRange({ minX: 0, minY: 0, maxX: world, maxY: world });
  const count = (r.kx1 - r.kx0 + 1) * (r.ky1 - r.ky0 + 1);
  assert.equal(count, CHUNK_COLS * CHUNK_ROWS);
});

test('LOD switches to flat chunks below the zoom threshold', () => {
  assert.equal(useCellDetail(LOD_ZOOM), true);
  assert.equal(useCellDetail(LOD_ZOOM - 0.01), false);
  assert.equal(useCellDetail(1.6), true);
});
