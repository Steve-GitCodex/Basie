import test from 'node:test';
import assert from 'node:assert/strict';

import { eventBus } from '../../js/core/EventBus.js';
import { BuildingManager } from '../../js/systems/BuildingManager.js';

function stubRM() {
  return {
    canAfford: () => true,
    spend() {},
    add() {},
    setCap() {},
    setPopulationCap() {},
    setFoodCapacity() {},
    setWaterCapacity() {},
    getPopulation: () => ({ current: 0, cap: 999 }),
    recalculateRates() {},
  };
}

/** Fresh manager with `workers` build slots (via a completed Construction Hall). */
function makeManager(workers = 2) {
  const bm = new BuildingManager(stubRM());
  if (workers >= 2) bm._buildings.set('construction_hall', [{ instanceId: 'construction_hall_0', level: Math.max(1, workers - 1) }]);
  if (workers >= 3) bm._premiumBuildSlots = workers - 2;
  return bm;
}

function activeCount(bm) {
  return bm.getBuildQueue().filter(r => r.isActive).length;
}

test('slot count reflects an unlocked Construction Hall', () => {
  assert.equal(makeManager(1).getMaxBuildSlots(), 1);
  assert.equal(makeManager(2).getMaxBuildSlots(), 2);
});

test('K builds up to worker count all start concurrently', () => {
  const bm = makeManager(2);
  bm.build('farm', 0);
  bm.build('mine', 0);
  assert.equal(activeCount(bm), 2);
  for (const r of bm.getBuildQueue()) assert.ok(r.endsAt > Date.now());
});

test('same-instance upgrades run serially, not in parallel', () => {
  const bm = makeManager(2);
  bm.build('farm', 0);
  bm.build('farm', 0);
  bm.build('farm', 0);
  const active = bm._buildQueue.filter(q => q.endsAt != null);
  assert.equal(active.length, 1);
  assert.equal(active[0].pendingLevel, 1);
});

test('a free worker skips ahead past a same-instance-blocked item', () => {
  const bm = makeManager(2);
  bm.build('farm', 0);
  bm.build('farm', 0);
  bm.build('mine', 0);
  const activeIds = bm._buildQueue.filter(q => q.endsAt != null).map(q => q.buildingId);
  assert.deepEqual(activeIds.sort(), ['farm', 'mine']);
});

test('capacity is workers + 2 and rejects beyond it', () => {
  const bm = makeManager(2);
  assert.ok(bm.build('farm', 0).success);
  assert.ok(bm.build('mine', 0).success);
  assert.ok(bm.build('quarry', 0).success);
  assert.ok(bm.build('lumbermill', 0).success);
  const r = bm.build('well', 0);
  assert.equal(r.success, false);
  assert.match(r.reason, /full/i);
});

test('completing an active build refills a freed worker and cascades same-instance', () => {
  const bm = makeManager(1);
  bm.build('farm', 0);
  bm.build('farm', 0);
  const first = bm._buildQueue[0];
  const firstEnds = first.endsAt;
  bm.applyOffline(0, firstEnds);
  assert.equal(bm.getLevelOf('farm'), 1);
  const nextActive = bm._buildQueue.find(q => q.endsAt != null);
  assert.ok(nextActive);
  assert.equal(nextActive.pendingLevel, 2);
  assert.equal(nextActive.startedAt, firstEnds);
});

test('offline catchup emits a single queueUpdated for the whole batch', () => {
  const bm = makeManager(2);
  bm.build('farm', 0);
  bm.build('mine', 0);
  const latest = Math.max(...bm._buildQueue.map(q => q.endsAt));
  let updates = 0, completes = 0;
  const onU = () => updates++;
  const onC = () => completes++;
  eventBus.on('building:queueUpdated', onU);
  eventBus.on('building:completed', onC);
  bm.applyOffline(0, latest + 1000);
  eventBus.off('building:queueUpdated', onU);
  eventBus.off('building:completed', onC);
  assert.equal(completes, 2);
  assert.equal(updates, 1);
});

test('cancelling an active build refunds and promotes a waiting item', () => {
  const bm = makeManager(1);
  bm.build('farm', 0);
  bm.build('mine', 0);
  let refunded = false;
  bm._rm.add = () => { refunded = true; };
  const active = bm.getBuildQueue().find(r => r.isActive);
  bm.cancelBuild(active.queuePosition);
  assert.ok(refunded);
  assert.equal(activeCount(bm), 1);
  assert.equal(bm._buildQueue[0].buildingId, 'mine');
  assert.ok(bm._buildQueue[0].endsAt > Date.now());
});

test('cancelling a waiting item leaves the active timer untouched', () => {
  const bm = makeManager(1);
  bm.build('farm', 0);
  bm.build('mine', 0);
  const activeEnds = bm._buildQueue.find(q => q.endsAt != null).endsAt;
  const waiting = bm.getBuildQueue().find(r => !r.isActive);
  bm.cancelBuild(waiting.queuePosition);
  assert.equal(bm._buildQueue.find(q => q.endsAt != null).endsAt, activeEnds);
});

test('reduceActiveTimer targets by instanceId, else the earliest-ending active', () => {
  const bm = makeManager(2);
  bm.build('farm', 0);
  bm.build('mine', 0);
  const mine = bm._buildQueue.find(q => q.buildingId === 'mine');
  const before = mine.endsAt;
  bm.reduceActiveTimer(5, mine.instanceId);
  assert.equal(mine.endsAt, before - 5000);

  const r = bm.reduceActiveTimer(999999);
  assert.ok(r.success);
  assert.ok(r.remaining <= 0 || r.completed);
});

test('legacy save with only a head timer migrates to N parallel workers', () => {
  const bm = makeManager(2);
  const future = Date.now() + 60_000;
  bm.deserialize({
    buildings: { construction_hall: [{ instanceId: 'construction_hall_0', level: 1 }] },
    buildQueue: [
      { buildingId: 'farm', instanceIndex: 0, instanceId: 'farm_0', pendingLevel: 1, buildTimeSec: 10, cost: {}, startedAt: future - 10_000, endsAt: future },
      { buildingId: 'mine', instanceIndex: 0, instanceId: 'mine_0', pendingLevel: 1, buildTimeSec: 15, cost: {}, startedAt: null, endsAt: null },
    ],
  });
  assert.equal(activeCount(bm), 2);
});

test('applyOffline no longer throws and drains cafeteria with elapsed seconds', () => {
  const bm = makeManager(1);
  let drainedWith = null;
  bm._cafeteria.applyOffline = (sec) => { drainedWith = sec; };
  assert.doesNotThrow(() => bm.applyOffline(3600, Date.now()));
  assert.equal(drainedWith, 3600);
});

test('multi-instance types get a #N displayName so copies are distinguishable', () => {
  const bm = makeManager(1);
  bm._buildings.set('townhall', [{ instanceId: 'townhall_0', level: 2 }]);
  const house = bm.getBuildingTypesWithInstances().find(t => t.id === 'house');
  assert.equal(house.instances[0].displayName, `${house.name} 1`);
  assert.equal(house.instances[1].displayName, `${house.name} 2`);

  const townhall = bm.getBuildingTypesWithInstances().find(t => t.id === 'townhall');
  assert.equal(townhall.instances[0].displayName, townhall.name);
});

test('extra actives above a lowered worker count run to completion', () => {
  const bm = makeManager(2);
  bm.build('farm', 0);
  bm.build('mine', 0);
  assert.equal(activeCount(bm), 2);
  bm._buildings.delete('construction_hall');
  bm.build('quarry', 0);
  assert.equal(activeCount(bm), 2);
  assert.equal(bm.getMaxBuildSlots(), 1);
});
