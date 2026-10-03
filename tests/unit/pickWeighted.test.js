import test from 'node:test';
import assert from 'node:assert/strict';

import { pickWeighted } from '../../js/systems/trading/pickWeighted.js';

const entries = [{ id: 'a', weight: 1 }, { id: 'b', weight: 3 }];

test('pickWeighted maps the roll onto cumulative weights', () => {
  assert.equal(pickWeighted(entries, () => 0).id, 'a');
  assert.equal(pickWeighted(entries, () => 0.24).id, 'a');
  assert.equal(pickWeighted(entries, () => 0.26).id, 'b');
  assert.equal(pickWeighted(entries, () => 0.9999).id, 'b');
});

test('pickWeighted falls back to the last entry', () => {
  assert.equal(pickWeighted(entries, () => 1).id, 'b');
});
