import test from 'node:test';
import assert from 'node:assert/strict';

import { WALKER_SPRITES, DRONE_SPRITE, TRUCK_SPRITE } from '../../js/ui/city/cityAmbientAssets.js';

test('ambient manifest names a non-empty walker pool + a drone + a truck', () => {
  assert.ok(Array.isArray(WALKER_SPRITES) && WALKER_SPRITES.length >= 1);
  assert.ok(WALKER_SPRITES.every((n) => typeof n === 'string' && n.length > 0));
  assert.equal(typeof DRONE_SPRITE, 'string');
  assert.equal(typeof TRUCK_SPRITE, 'string');
});
