import test from 'node:test';
import assert from 'node:assert/strict';

import { hqChain } from '../../js/entities/data/hqChain.js';
import { HQ_MAX } from '../../js/entities/GAME_DATA.js';

test('hqChain lists the explicit early gates', () => {
  const chain = hqChain();
  assert.deepEqual(chain[3], { farm: 2 });
  assert.deepEqual(chain[9], { barracks: 8 });
});

test('hqChain rotates the partner from level 10', () => {
  const chain = hqChain();
  assert.deepEqual(chain[10], { workshop: 9, barracks: 9 });
  assert.deepEqual(chain[16], { workshop: 15, barracks: 15 });
  assert.deepEqual(chain[30], { workshop: 29, archeryrange: 29 });
});

test('hqChain covers every HQ level from 3 to HQ_MAX', () => {
  const chain = hqChain();
  for (let level = 3; level <= HQ_MAX; level++) assert.ok(chain[level], `level ${level}`);
});
