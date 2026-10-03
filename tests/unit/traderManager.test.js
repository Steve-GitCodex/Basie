import test from 'node:test';
import assert from 'node:assert/strict';

import { eventBus } from '../../js/core/EventBus.js';
import { ResourceManager } from '../../js/systems/ResourceManager.js';
import { InventoryManager } from '../../js/systems/InventoryManager.js';
import { TraderManager } from '../../js/systems/TraderManager.js';
import { createRng } from '../../js/systems/combat/seededRng.js';
import { TRADER_TIMING, TRADER_STOCK_SIZE } from '../../js/entities/GAME_DATA.js';

const { stayMs, awayMs, activityCutMs, minAwayMs } = TRADER_TIMING;
const HOUR = 3600 * 1000;
const T0 = 1_000_000_000_000;

const created = [];
test.afterEach(() => { created.splice(0).forEach(t => t.destroy()); });

function build() {
  const rm = new ResourceManager();
  for (const res of ['wood', 'stone', 'iron', 'food', 'water']) {
    rm._resources[res].amount = 100000;
    rm._resources[res].cap = Infinity;
  }
  const inventory = new InventoryManager();
  const clock = { t: T0 };
  let snapshots = 0;
  const realSnapshot = rm.getSnapshot.bind(rm);
  rm.getSnapshot = () => { snapshots++; return realSnapshot(); };
  const trader = new TraderManager({ rm, inventory, now: () => clock.t, rng: createRng(5).next });
  created.push(trader);
  return { rm, inventory, trader, clock, generations: () => snapshots };
}

test('fresh trader is present with 6 stock slots', () => {
  const { trader } = build();
  const s = trader.getState();
  assert.equal(s.present, true);
  assert.equal(s.stock.length, TRADER_STOCK_SIZE);
  assert.equal(s.hasNew, true);
});

test('after stayMs it leaves and stock clears', () => {
  const { trader, clock } = build();
  clock.t = T0 + stayMs;
  trader.update();
  const s = trader.getState();
  assert.equal(s.present, false);
  assert.equal(s.stock.length, 0);
  assert.equal(s.nextVisitAt, T0 + stayMs + awayMs);
});

test('after awayMs it returns with new stock and hasNew', () => {
  const { trader, clock } = build();
  trader.markSeen();
  assert.equal(trader.getState().hasNew, false);
  clock.t = T0 + stayMs;
  trader.update();
  clock.t = T0 + stayMs + awayMs;
  trader.update();
  const s = trader.getState();
  assert.equal(s.present, true);
  assert.equal(s.stock.length, TRADER_STOCK_SIZE);
  assert.equal(s.hasNew, true);
});

test('markSeen clears hasNew and emits trader:updated', () => {
  const { trader } = build();
  let emitted = 0;
  const off = eventBus.on('trader:updated', () => { emitted++; });
  trader.markSeen();
  assert.equal(trader.getState().hasNew, false);
  assert.equal(emitted, 1);
  off();
});

test('offline jump of 3 full cycles + 1h lands present with leavesAt in the future and one generate call', () => {
  const { trader, clock, generations } = build();
  const before = generations();
  const now = T0 + 3 * (stayMs + awayMs) + HOUR;
  clock.t = now;
  trader.update();
  const s = trader.getState();
  assert.equal(s.present, true);
  assert.ok(s.leavesAt > now);
  assert.equal(s.arrivedAt, T0 + 3 * (stayMs + awayMs));
  assert.equal(s.stock.length, TRADER_STOCK_SIZE);
  assert.equal(generations() - before, 1);
});

test('activity while away cuts 10 min but never below 30 min from now', () => {
  const { trader, clock } = build();
  clock.t = T0 + stayMs;
  trader.update();
  const nextVisit = trader.getState().nextVisitAt;
  eventBus.emit('building:started', {});
  assert.equal(trader.getState().nextVisitAt, nextVisit - activityCutMs);

  clock.t = trader.getState().nextVisitAt - minAwayMs - 60 * 1000;
  eventBus.emit('unit:trainingStarted', {});
  assert.equal(trader.getState().nextVisitAt, clock.t + minAwayMs);

  const floor = trader.getState().nextVisitAt;
  eventBus.emit('combat:victory', {});
  assert.equal(trader.getState().nextVisitAt, floor);
});

test('activity while present changes nothing', () => {
  const { trader } = build();
  const before = trader.getState().nextVisitAt;
  eventBus.emit('building:started', {});
  assert.equal(trader.getState().nextVisitAt, before);
});

test('buy spends cost, adds item, marks sold; second buy rejects', () => {
  const { rm, inventory, trader } = build();
  const slot = trader.getState().stock[0];
  const r = trader.buy(slot.slotId);
  assert.deepEqual(r, { success: true, itemId: slot.itemId });
  assert.equal(inventory.getQuantity(slot.itemId), 1);
  for (const [res, amount] of Object.entries(slot.cost)) assert.equal(rm._resources[res].amount, 100000 - amount);
  assert.equal(trader.getState().stock[0].sold, true);
  assert.equal(trader.buy(slot.slotId).success, false);
});

test('buy rejects when unaffordable', () => {
  const { rm, inventory, trader } = build();
  for (const res of ['wood', 'stone', 'iron', 'food', 'water']) rm._resources[res].amount = 0;
  const slot = trader.getState().stock[0];
  assert.equal(trader.buy(slot.slotId).reason, 'unaffordable');
  assert.equal(inventory.getQuantity(slot.itemId), 0);
});

test('buy while away rejects', () => {
  const { trader, clock } = build();
  const slotId = trader.getState().stock[0].slotId;
  clock.t = T0 + stayMs;
  trader.update();
  assert.deepEqual(trader.buy(slotId), { success: false, reason: 'away' });
});

test('serialize round-trips through deserialize', () => {
  const a = build();
  a.trader.buy(a.trader.getState().stock[1].slotId);
  const saved = JSON.parse(JSON.stringify(a.trader.serialize()));
  const b = build();
  b.trader.deserialize(saved);
  assert.deepEqual(b.trader.getState(), a.trader.getState());
});

test('deserialize drops stock slots with unknown itemId', () => {
  const { trader } = build();
  const saved = trader.serialize();
  saved.stock[0].itemId = 'not_a_real_item';
  trader.deserialize(saved);
  assert.equal(trader.getState().stock.length, TRADER_STOCK_SIZE - 1);
});

test('garbage block → fresh state', () => {
  for (const garbage of [undefined, null, 'x', { present: 'yes' }, { present: true, arrivedAt: NaN }]) {
    const { trader } = build();
    trader.deserialize(garbage);
    const s = trader.getState();
    assert.equal(s.present, true);
    assert.equal(s.stock.length, TRADER_STOCK_SIZE);
  }
});

function awayState(extra) {
  return { present: false, arrivedAt: 0, leavesAt: 0, nextVisitAt: 1e300, seenVisitAt: 0, stock: [], ...extra };
}

test('away save with absurd future nextVisitAt reseeds to a present trader', () => {
  const { trader } = build();
  trader.deserialize(awayState({}));
  eventBus.emit('building:started', {});
  trader.update();
  const s = trader.getState();
  assert.equal(s.present, true);
  assert.equal(s.stock.length, TRADER_STOCK_SIZE);
});

test('present save with leavesAt far in the future reseeds', () => {
  const { trader } = build();
  const saved = trader.serialize();
  trader.deserialize({ ...saved, arrivedAt: T0, leavesAt: 1e300 });
  assert.equal(trader.getState().leavesAt, T0 + stayMs);
});

test('present save with arrivedAt in the future reseeds', () => {
  const { trader } = build();
  const saved = trader.serialize();
  trader.deserialize({ ...saved, arrivedAt: T0 + 5 * HOUR, leavesAt: T0 + 5 * HOUR + stayMs });
  assert.equal(trader.getState().arrivedAt, T0);
});

test('slot validation rejects prototype keys, empty/invalid costs, bad discounts, duplicate ids', () => {
  const { trader } = build();
  const saved = trader.serialize();
  const good = saved.stock[0];
  const bad = [
    { ...good, slotId: 'a', itemId: 'toString', cost: {} },
    { ...good, slotId: 'b', cost: {} },
    { ...good, slotId: 'c', cost: { money: 50 } },
    { ...good, slotId: 'd', cost: { wood: -50 } },
    { ...good, slotId: 'e', discountPct: 99 },
    { ...good },
  ];
  trader.deserialize({ ...saved, stock: [good, ...bad] });
  assert.deepEqual(trader.getState().stock.map(s => s.slotId), [good.slotId]);
});

test('present save whose stock filters to empty regenerates stock', () => {
  const { trader } = build();
  const saved = trader.serialize();
  trader.deserialize({ ...saved, stock: [{ slotId: 'x', itemId: 'nope', cost: { wood: 50 }, discountPct: 0, sold: false }] });
  assert.equal(trader.getState().stock.length, TRADER_STOCK_SIZE);
});

test('activity while away emits trader:updated only when nextVisitAt changes', () => {
  const { trader, clock } = build();
  clock.t = T0 + stayMs;
  trader.update();
  let emitted = 0;
  const off = eventBus.on('trader:updated', () => { emitted++; });
  eventBus.emit('building:started', {});
  assert.equal(emitted, 1);
  clock.t = trader.getState().nextVisitAt - minAwayMs;
  eventBus.emit('building:started', {});
  assert.equal(emitted, 1);
  off();
});

test('trader stock prices never exceed the storage caps', () => {
  const { rm } = build();
  for (const res of ['wood', 'stone', 'iron', 'food', 'water']) rm._resources[res].cap = 5000;
  const capped = new TraderManager({ rm, inventory: new InventoryManager(), now: () => T0, rng: createRng(8).next });
  created.push(capped);
  for (const slot of capped.getState().stock) {
    for (const amount of Object.values(slot.cost)) assert.ok(amount <= 5000);
  }
});
