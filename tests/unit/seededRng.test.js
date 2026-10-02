import test from 'node:test';
import assert from 'node:assert/strict';

import { createRng } from '../../js/systems/combat/seededRng.js';

const draw = (rng, n) => Array.from({ length: n }, () => rng.next());

test('same seed yields the same sequence', () => {
  assert.deepEqual(draw(createRng(42), 100), draw(createRng(42), 100));
});

test('different seeds diverge', () => {
  assert.notDeepEqual(draw(createRng(1), 10), draw(createRng(2), 10));
});

test('values stay in [0,1)', () => {
  for (const v of draw(createRng(7), 10000)) assert.ok(v >= 0 && v < 1);
});
