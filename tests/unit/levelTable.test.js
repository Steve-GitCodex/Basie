import test from 'node:test';
import assert from 'node:assert/strict';

import { levelTable } from '../../js/systems/building/levelTable.js';

test('levelTable returns the entry at the level', () => {
  assert.equal(levelTable([0, 5, 9], 2, 'x'), 9);
});

test('levelTable throws naming the table and level when the entry is missing', () => {
  assert.throws(
    () => levelTable([0, 5], 2, 'storehouse.storageCap.wood'),
    /storehouse\.storageCap\.wood: no entry for level 2/,
  );
});

test('levelTable returns a legitimate zero entry', () => {
  assert.equal(levelTable([0, 5], 0, 'x'), 0);
});
