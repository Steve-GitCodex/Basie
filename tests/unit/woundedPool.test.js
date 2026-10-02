import test from 'node:test';
import assert from 'node:assert/strict';

import { WoundedPool } from '../../js/systems/units/woundedPool.js';

test('add accumulates per tierKey', () => {
  const pool = new WoundedPool();
  pool.add({ infantry_t1: 5, ranged_t1: 2 });
  pool.add({ infantry_t1: 3 });
  assert.deepEqual(pool.get(), { infantry_t1: 8, ranged_t1: 2 });
});

test('serialize round-trips', () => {
  const pool = new WoundedPool();
  pool.add({ cavalry_t2: 7 });
  const copy = new WoundedPool();
  copy.deserialize(pool.serialize());
  assert.deepEqual(copy.get(), { cavalry_t2: 7 });
});
