import test from 'node:test';
import assert from 'node:assert/strict';

import { groundSignature } from '../../js/ui/city/cityGround.js';

// Regression for the "glitchy rubble clearing" bug: the ground raster cache key
// must change when a sector goes clearing → cleared. The old key bucketed
// clearing WITH cleared (state !== 'rubble'), so completing a clear never
// invalidated the raster and the just-cleared sector kept drawing as rubble.
test('signature changes when a sector finishes clearing (root-cause regression)', () => {
  const skeleton = new Set(['20,20']);
  const connectors = new Set();
  const whileClearing = groundSignature({ clearedIds: [], skeleton, connectors });
  const afterCleared = groundSignature({ clearedIds: ['sector_1_0'], skeleton, connectors });
  assert.notEqual(whileClearing, afterCleared,
    'completing a clear must invalidate the ground raster');
});

test('signature is stable for the same cleared/road state', () => {
  const a = groundSignature({ clearedIds: ['sector_1_1', 'sector_1_0'], skeleton: new Set(['1,1', '0,0']), connectors: new Set(['5,5']) });
  const b = groundSignature({ clearedIds: ['sector_1_0', 'sector_1_1'], skeleton: new Set(['0,0', '1,1']), connectors: new Set(['5,5']) });
  assert.equal(a, b, 'order-independent over sets');
});

test('extending an arterial (more skeleton cells) invalidates the raster', () => {
  const base = groundSignature({ clearedIds: ['sector_1_0'], skeleton: new Set(['20,20']), connectors: new Set() });
  const extended = groundSignature({ clearedIds: ['sector_1_0'], skeleton: new Set(['20,20', '20,25']), connectors: new Set() });
  assert.notEqual(base, extended);
});
