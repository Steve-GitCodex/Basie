import test from 'node:test';
import assert from 'node:assert/strict';

import { assignSlotRows } from '../../js/systems/units/squadRows.js';

const rowsOf = (map) => [...map.entries()].sort((a, b) => a[0] - b[0]).map(([, row]) => row);

test('assignSlotRows keeps stored rows under the cap', () => {
  const rows = assignSlotRows([
    { slotIndex: 0, unitId: 'infantry', stored: 'front' },
    { slotIndex: 1, unitId: 'ranged', stored: 'front' },
  ]);
  assert.deepEqual(rowsOf(rows), ['front', 'front']);
});

test('a slot whose default row is full falls back a row', () => {
  const rows = assignSlotRows([0, 1, 2, 3].map(slotIndex => ({ slotIndex, unitId: 'infantry' })));
  assert.deepEqual(rowsOf(rows), ['front', 'front', 'mid', 'mid']);
});

test('full back falls forward to mid', () => {
  const rows = assignSlotRows([0, 1, 2].map(slotIndex => ({ slotIndex, unitId: 'ranged' })));
  assert.deepEqual(rowsOf(rows), ['back', 'back', 'mid']);
});

test('stored rows over the cap are re-flowed by the default rule', () => {
  const rows = assignSlotRows([0, 1, 2].map(slotIndex => ({ slotIndex, unitId: 'infantry', stored: 'front' })));
  assert.deepEqual(rowsOf(rows), ['front', 'front', 'mid']);
});
