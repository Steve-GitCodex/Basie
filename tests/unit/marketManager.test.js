import test from 'node:test';
import assert from 'node:assert/strict';

import { eventBus } from '../../js/core/EventBus.js';
import { ResourceManager } from '../../js/systems/ResourceManager.js';
import { MarketManager } from '../../js/systems/MarketManager.js';

const RESOURCES = ['wood', 'stone', 'food', 'water', 'iron', 'money'];

function setup(day = '2026-10-02') {
  const rm = new ResourceManager();
  rm._resources.wood.amount = 5000;
  rm._resources.iron.amount = 0;
  const clock = { day };
  const market = new MarketManager(rm, { today: () => clock.day });
  return { rm, market, clock };
}

const held = (rm, key) => rm.getSnapshot()[key].amount;

test('exchange moves both resources by the quoted amounts', () => {
  const { rm, market } = setup();
  const { gain } = market.quote('wood', 'iron', 3100);
  const result = market.exchange('wood', 'iron', 3100);
  assert.deepEqual(result, { success: true, gain });
  assert.equal(held(rm, 'wood'), 1900);
  assert.equal(held(rm, 'iron'), gain);
});

test('exchange raises give-pressure by 2% per 1000 worth', () => {
  const { market } = setup();
  market.exchange('wood', 'stone', 1000);
  assert.equal(market.getPressure().wood, 1.02);
  assert.equal(market.getPressure().stone, 1);
});

test('exchange rejects amount above held and spends nothing', () => {
  const { rm, market } = setup();
  const stoneBefore = held(rm, 'stone');
  const result = market.exchange('wood', 'stone', 5001);
  assert.equal(result.success, false);
  assert.equal(held(rm, 'wood'), 5000);
  assert.equal(held(rm, 'stone'), stoneBefore);
  assert.equal(market.getPressure().wood, 1);
});

test('exchange rejects invalid pairs and amounts without throwing', () => {
  const { market } = setup();
  assert.equal(market.exchange('wood', 'wood', 10).success, false);
  assert.equal(market.exchange('wood', 'stone', 0).success, false);
  assert.equal(market.exchange('wood', 'stone', 2.5).success, false);
});

test('exchange emits market:exchanged', () => {
  const { market } = setup();
  let payload;
  const off = eventBus.on('market:exchanged', p => { payload = p; });
  market.exchange('wood', 'stone', 100);
  off();
  assert.deepEqual(payload, { give: 'wood', get: 'stone', amount: 100, gain: 85 });
});

test('day change resets pressure and announces it', () => {
  const { market, clock } = setup();
  market.exchange('wood', 'stone', 1000);
  let resets = 0;
  const off = eventBus.on('market:pricesReset', () => { resets++; });
  clock.day = '2026-10-03';
  market.update();
  off();
  assert.equal(market.getPressure().wood, 1);
  assert.equal(resets, 1);
});

test('deserialize of a missing / garbage / old TRADES-shaped block seeds pressure 1 for every resource', () => {
  const blocks = [undefined, null, 'junk', 42, { pressure: 'x' }, { pressure: { wood: 'NaN', stone: -3 } },
    { purchaseCounts: { wood_for_stone: 4 }, lastResetDate: '2026-10-02' }];
  for (const block of blocks) {
    const { market } = setup();
    market.deserialize(block);
    const pressure = market.getPressure();
    assert.deepEqual(Object.keys(pressure).sort(), [...RESOURCES].sort());
    for (const key of RESOURCES) assert.equal(pressure[key], 1);
  }
});

test('serialize→deserialize round trip', () => {
  const { market } = setup();
  market.exchange('wood', 'stone', 1000);
  const saved = JSON.parse(JSON.stringify(market.serialize()));
  const { market: restored } = setup();
  restored.deserialize(saved);
  assert.deepEqual(restored.getPressure(), market.getPressure());
  assert.deepEqual(restored.serialize(), saved);
});

test('deserialize of a stale-day block resets pressure', () => {
  const { market } = setup('2026-10-03');
  market.deserialize({ pressure: { wood: 1.5 }, lastResetDate: '2026-10-02' });
  assert.equal(market.getPressure().wood, 1);
});

test('deserialize clamps over-cap saved pressure to PRESSURE_CAP', () => {
  const { market } = setup();
  market.deserialize({ pressure: { wood: 50 }, lastResetDate: '2026-10-02' });
  assert.equal(market.getPressure().wood, 2);
});

test('exchange rejects when the gain exceeds free storage and spends nothing', () => {
  const { rm, market } = setup();
  rm._resources.stone.cap = 1000;
  rm._resources.stone.amount = 950;
  const result = market.exchange('wood', 'stone', 100);
  assert.deepEqual(result, { success: false, reason: 'Not enough storage.' });
  assert.equal(held(rm, 'wood'), 5000);
  assert.equal(held(rm, 'stone'), 950);
  assert.equal(market.getPressure().wood, 1);
});

test('exchange succeeds when the gain exactly fills storage; infinite cap is unlimited', () => {
  const { rm, market } = setup();
  rm._resources.stone.cap = 1000;
  rm._resources.stone.amount = 915;
  assert.equal(market.exchange('wood', 'stone', 100).success, true);
  assert.equal(held(rm, 'stone'), 1000);
  rm._resources.food.cap = Infinity;
  assert.equal(market.exchange('wood', 'food', 1000).success, true);
});

test('storageRoom reports cap minus amount, Infinity when uncapped', () => {
  const { rm, market } = setup();
  rm._resources.stone.cap = 1000;
  rm._resources.stone.amount = 400;
  assert.equal(market.storageRoom('stone'), 600);
  rm._resources.stone.cap = Infinity;
  assert.equal(market.storageRoom('stone'), Infinity);
});

test('deserialize with a missing or invalid lastResetDate reseeds pressure', () => {
  for (const block of [{ pressure: { wood: 1.5 } }, { pressure: { wood: 1.5 }, lastResetDate: 20261002 }]) {
    const { market } = setup();
    market.deserialize(block);
    assert.equal(market.getPressure().wood, 1);
  }
});
