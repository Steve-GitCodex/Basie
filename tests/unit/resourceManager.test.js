import test from 'node:test';
import assert from 'node:assert/strict';

import { eventBus } from '../../js/core/EventBus.js';
import { ResourceManager } from '../../js/systems/ResourceManager.js';

function withMode(mode, fn) {
  eventBus.emit('game:modeChanged', { mode });
  try { fn(); } finally { eventBus.emit('game:modeChanged', { mode: 'campaign' }); }
}

test('campaign spend deducts resources and fails when unaffordable', () => {
  const rm = new ResourceManager();
  rm._resources.wood.amount = 100;
  assert.equal(rm.spend({ wood: 40 }), true);
  assert.equal(rm._resources.wood.amount, 60);
  assert.equal(rm.spend({ wood: 1000 }), false);
  assert.equal(rm._resources.wood.amount, 60);
});

test('sandbox spend is free — stockpile never depletes so builds never wait', () => {
  const rm = new ResourceManager();
  withMode('sandbox', () => {
    rm._resources.wood.amount = 100;
    assert.equal(rm.canAfford({ wood: 1e9 }), true);
    assert.equal(rm.spend({ wood: 1e9, stone: 1e9 }), true);
    assert.equal(rm._resources.wood.amount, 100);
  });
});
