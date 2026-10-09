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
  rm.setHeroManager({});
  rm.recalculateRates([{ effects: { iron: 10, money: 10 }, level: 1 }]);
  assert.equal(rm._resources.iron.perSec, 10, 'per-instance hero scaling belongs to buildingEconomy, not here');
  assert.equal(rm._resources.money.perSec, 10, 'an unrelated resource must never be boosted by a hero bonus map');
});

test('lowering a cap below current stock never deletes resources', () => {
  const rm = new ResourceManager();
  rm._resources.wood.amount = 500;
  rm.setCap('wood', 100);
  assert.equal(rm._resources.wood.amount, 500);
});

test('item boost multiplier comes from BuffManager production.all', () => {
  const rm = new ResourceManager();
  rm.setBuffManager({ multiplierFor: s => (s === 'production.all' ? 0.5 : 0) });
  rm.recalculateRates([{ effects: { wood: 10 }, level: 1 }]);
  assert.equal(rm._resources.wood.perSec, 15);
});

test('getRateBreakdown multiplier × base equals perSec with every layer active', () => {
  const rm = new ResourceManager();
  rm._techBonuses = { woodBonus: 0.1 };
  rm._vipProductionBonus = 0.05;
  rm._difficultyProductionMult = 0.9;
  rm.setBuildingManager({ getHQBenefits: () => ({ productionBonus: 0.05 }) });
  rm.setBuffManager({ multiplierFor: () => 0.5, getBoosts: () => [] });
  rm.setWorldMapManager({ activeBuffs: () => [{ flavor: 'economic', resource: 'wood', pct: 0.15 }] });
  rm.addModifier('wood', 2, 'evt');
  rm.recalculateRates([{ effects: { wood: 10 }, level: 2 }]);
  const b = rm.getRateBreakdown('wood');
  assert.equal(b.base, 20);
  assert.ok(Math.abs(b.base * b.multiplier - rm._resources.wood.perSec) < 1e-9);
});

test('getRateBreakdown with zero base returns a finite multiplier', () => {
  const rm = new ResourceManager();
  rm.setBuffManager({ multiplierFor: () => 0.5, getBoosts: () => [] });
  rm.recalculateRates([]);
  const b = rm.getRateBreakdown('stone');
  assert.equal(b.base, 0);
  assert.ok(Number.isFinite(b.multiplier));
});

test('cap floors survive building-driven setCap and never shrink a larger cap', () => {
  const rm = new ResourceManager();
  rm.setCapFloors({ wood: 2000 });
  assert.equal(rm._resources.wood.cap >= 2000, true);
  rm.setCap('wood', 100);
  assert.equal(rm._resources.wood.cap, 2000);
  rm.setCap('wood', 5000);
  assert.equal(rm._resources.wood.cap, 5000);
  rm.setCap('stone', 100);
  assert.equal(rm._resources.stone.cap, 100);
});

test('setAmount sets an exact stockpile and clamps at zero', () => {
  const rm = new ResourceManager();
  rm.setAmount('iron', 1234);
  assert.equal(rm._resources.iron.amount, 1234);
  rm.setAmount('iron', -5);
  assert.equal(rm._resources.iron.amount, 0);
});
