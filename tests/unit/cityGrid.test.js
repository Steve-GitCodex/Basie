import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CELL_COLS, CELL_ROWS, BUILD_RECT,
  cellToTile, rectFrontTile, rectCenterTile, rectCornersTile,
  rectsOverlap, inBounds, clampRect,
} from '../../js/entities/data/cityGrid.js';

test('cells subdivide tiles 2×2', () => {
  assert.deepEqual(cellToTile(0, 0), { col: 0, row: 0 });
  assert.deepEqual(cellToTile(2, 4), { col: 1, row: 2 });
  assert.equal(CELL_COLS, BUILD_RECT.w);
  assert.equal(CELL_ROWS, BUILD_RECT.h);
});

test('front corner sits on the cell-center grid (half-cell off the rect boundary)', () => {
  // 4×4 footprint at (20,14): occupies cell centers 20..23 / 14..17; the S vertex is
  // half a cell (0.25 tile) past the last cell center → tile (11.75, 8.75).
  assert.deepEqual(rectFrontTile(20, 14, 4, 4), { col: 11.75, row: 8.75 });
});

test('center tile is the footprint cell-center midpoint', () => {
  assert.deepEqual(rectCenterTile(20, 14, 4, 4), { col: 10.75, row: 7.75 });
  assert.deepEqual(rectCenterTile(0, 0, 2, 2), { col: 0.25, row: 0.25 });
});

test('rect corners align with the cell-center grid the ground/roads use', () => {
  // The ground draws cell (X,Y) centered at tile (X/2, Y/2). A footprint's outer
  // vertices must be exactly half a cell (0.25 tile) beyond its edge cell centers,
  // or every sprite/slot renders off the road grid (the half-cell offset bug).
  const cx = 8, cy = 6, w = 3, h = 3;
  const c = rectCornersTile(cx, cy, w, h);
  const HALF = 0.25; // half a cell in tile units
  assert.deepEqual(c.n, { col: cx / 2 - HALF, row: cy / 2 - HALF });
  assert.deepEqual(c.s, { col: (cx + w - 1) / 2 + HALF, row: (cy + h - 1) / 2 + HALF });
  assert.deepEqual(c.e, { col: (cx + w - 1) / 2 + HALF, row: cy / 2 - HALF });
  assert.deepEqual(c.w, { col: cx / 2 - HALF, row: (cy + h - 1) / 2 + HALF });
  // front anchor == south corner
  assert.deepEqual(rectFrontTile(cx, cy, w, h), c.s);
});

test('corners order N < E,W < S by tile sum', () => {
  const c = rectCornersTile(10, 10, 3, 3);
  const sum = p => p.col + p.row;
  assert.ok(sum(c.n) < sum(c.e));
  assert.ok(sum(c.e) < sum(c.s));
  assert.equal(sum(c.e), sum(c.w)); // E and W are the same diagonal
});

test('rect overlap is exclusive on shared edges (buildings may touch)', () => {
  const a = { cx: 0, cy: 0, w: 3, h: 3 };
  assert.ok(rectsOverlap(a, { cx: 2, cy: 2, w: 3, h: 3 }));
  assert.ok(!rectsOverlap(a, { cx: 3, cy: 0, w: 3, h: 3 })); // flush, no overlap
  assert.ok(!rectsOverlap(a, { cx: 0, cy: 3, w: 3, h: 3 }));
});

test('inBounds respects the buildable rect edges', () => {
  assert.ok(inBounds(0, 0, 4, 4));
  assert.ok(inBounds(CELL_COLS - 2, CELL_ROWS - 2, 2, 2));
  assert.ok(!inBounds(-1, 0, 2, 2));
  assert.ok(!inBounds(CELL_COLS - 1, 0, 2, 2));
});

test('clampRect keeps the whole footprint inside bounds', () => {
  assert.deepEqual(clampRect(-5, -5, 3, 3), { cx: 0, cy: 0 });
  assert.deepEqual(clampRect(999, 999, 4, 4), { cx: CELL_COLS - 4, cy: CELL_ROWS - 4 });
  assert.deepEqual(clampRect(5, 5, 3, 3), { cx: 5, cy: 5 });
});
