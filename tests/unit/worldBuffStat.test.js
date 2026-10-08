import test from 'node:test';
import assert from 'node:assert/strict';
import { worldBuffStat } from '../../js/systems/buffs/worldBuffStat.js';

test('worldBuffStat maps the three flavors', () => {
  assert.equal(worldBuffStat({ flavor: 'economic', resource: 'wood' }), 'production.wood');
  assert.equal(worldBuffStat({ flavor: 'military' }), 'troop.attack');
  assert.equal(worldBuffStat({ flavor: 'logistic' }), 'march.speed');
});
