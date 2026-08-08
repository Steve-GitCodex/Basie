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

test('addModifier then removeModifier restores perSec and clears the modifier map', () => {
  const rm = new ResourceManager();
  rm.recalculateRates([{ effects: { iron: 10 }, level: 1 }]);
  const baseline = rm._resources.iron.perSec;

  rm.addModifier('iron', 2.0, 'double_iron_weekend');
  assert.equal(rm._resources.iron.perSec, baseline * 2);

  rm.removeModifier('double_iron_weekend', 'iron');
  assert.equal(rm._resources.iron.perSec, baseline);
  assert.equal(rm._modifiers.size, 0);
});

test('removeModifier with the bare id (no resourceType) is a no-op, not a match', () => {
  const rm = new ResourceManager();
  rm.addModifier('iron', 2.0, 'double_iron_weekend');
  rm.removeModifier('double_iron_weekend');
  assert.equal(rm._modifiers.size, 1);
});

test('a cap drop never destroys existing stock — production halts instead of snapping down', () => {
  const rm = new ResourceManager();
  rm._resources.wood.amount = 3600;
  rm._resources.wood.cap = 3600;
  rm._resources.wood.perSec = 100;

  rm.setCap('wood', 3000);
  assert.equal(rm._resources.wood.amount, 3600, 'setCap must not clamp existing stock');

  rm.update(1);
  assert.equal(rm._resources.wood.amount, 3600, 'update must not snap over-cap stock down');

  rm._resources.wood.amount = 2000;
  rm.update(1);
  assert.equal(rm._resources.wood.amount, 2100);
  rm.update(100);
  assert.equal(rm._resources.wood.amount, 3000, 'production still respects the cap once back under it');
});

test('add() never reduces an already-over-cap amount', () => {
  const rm = new ResourceManager();
  rm._resources.wood.amount = 3600;
  rm._resources.wood.cap = 3000;
  rm.add({ wood: 50 });
  assert.equal(rm._resources.wood.amount, 3600);
});

test('applyOffline never snaps an over-cap amount down', () => {
  const rm = new ResourceManager();
  rm._resources.wood.amount = 3600;
  rm._resources.wood.cap = 3000;
  rm._resources.wood.perSec = 100;
  rm.applyOffline(3600);
  assert.equal(rm._resources.wood.amount, 3600);
});

test('hero building production bonus is not applied globally (no double count)', () => {
  const rm = new ResourceManager();
  rm.setHeroManager({
    getActiveProductionMultiplier: () => 0,
  });
  rm.recalculateRates([{ effects: { iron: 10, money: 10 }, level: 1 }]);
  assert.equal(rm._resources.iron.perSec, 10, 'per-instance hero scaling belongs to buildingEconomy, not here');
  assert.equal(rm._resources.money.perSec, 10, 'an unrelated resource must never be boosted by a hero bonus map');
});
