import test from 'node:test';
import assert from 'node:assert/strict';

import { PlacementStore } from '../../js/systems/building/placementStore.js';
import { CELL_COLS } from '../../js/entities/data/cityGrid.js';

test('place / positionOf / rectOf round-trip', () => {
  const s = new PlacementStore();
  s.place('farm_0', 5, 6, 3, 3);
  assert.deepEqual(s.positionOf('farm_0'), { cx: 5, cy: 6 });
  assert.deepEqual(s.rectOf('farm_0'), { cx: 5, cy: 6, w: 3, h: 3 });
  assert.equal(s.positionOf('missing'), null);
});

test('rectFree detects overlap and honors the exception id', () => {
  const s = new PlacementStore();
  s.place('farm_0', 5, 5, 3, 3);
  assert.ok(!s.rectFree(6, 6, 3, 3));            // overlaps farm_0
  assert.ok(s.rectFree(8, 5, 3, 3));             // flush, clear
  assert.ok(s.rectFree(5, 5, 3, 3, 'farm_0'));   // its own footprint, ignored
});

test('rectFree rejects out-of-bounds footprints', () => {
  const s = new PlacementStore();
  assert.ok(!s.rectFree(CELL_COLS - 1, 0, 3, 3));
  assert.ok(!s.rectFree(-1, 0, 2, 2));
});

test('move keeps the footprint and updates the position', () => {
  const s = new PlacementStore();
  s.place('mine_0', 0, 0, 3, 3);
  assert.ok(s.move('mine_0', 10, 10));
  assert.deepEqual(s.rectOf('mine_0'), { cx: 10, cy: 10, w: 3, h: 3 });
  assert.ok(!s.move('ghost_9', 1, 1));
});

test('serialize emits only {cx,cy} pairs', () => {
  const s = new PlacementStore();
  s.place('farm_0', 5, 6, 3, 3);
  s.place('townhall_0', 20, 14, 4, 4);
  assert.deepEqual(s.serialize(), {
    farm_0: { cx: 5, cy: 6 },
    townhall_0: { cx: 20, cy: 14 },
  });
});
