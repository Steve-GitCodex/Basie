import test from 'node:test';
import assert from 'node:assert/strict';

import { eventBus } from '../../js/core/EventBus.js';
import { BuildingManager } from '../../js/systems/BuildingManager.js';
import { SKELETON, rectHitsSkeleton } from '../../js/entities/GAME_DATA.js';

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

test('legacy plot-id placements are dropped and the packer re-places every instance', () => {
  const bm = makeManager(1);
  bm.deserialize({
    buildings: {
      townhall: [{ instanceId: 'townhall_0', level: 5 }],
      farm:     [{ instanceId: 'farm_0', level: 3 }],
      barracks: [{ instanceId: 'barracks_0', level: 2 }],
    },
    // Old save shape: instanceId → plotId string (must be dropped, not crash).
    placements: { townhall_0: 'civic_hq', farm_0: 'prod_01', barracks_0: 'mil_01' },
  });
  // No data loss on levels.
  assert.equal(bm.getLevelOf('townhall'), 5);
  assert.equal(bm.getLevelOf('farm'), 3);
  assert.equal(bm.getLevelOf('barracks'), 2);
  // Every unlocked instance got a cell position; HQ is centered.
  const rects = bm.getPlacementRects();
  assert.ok(rects.every(r => Number.isInteger(r.cx) && Number.isInteger(r.cy)));
  assert.ok(bm.positionOf('townhall_0'));
  assert.ok(bm.positionOf('farm_0'));
  // No two footprints overlap.
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      const overlap = a.cx < b.cx + b.w && b.cx < a.cx + a.w && a.cy < b.cy + b.h && b.cy < a.cy + a.h;
      assert.ok(!overlap, `${a.instanceId} overlaps ${b.instanceId}`);
    }
});

test('after load, NO placement rect (built, queued, or unbuilt) sits on the skeleton', () => {
  const [sx, sy] = [...SKELETON][Math.floor(SKELETON.size / 2)].split(',').map(Number);
  const bm = makeManager(1);
  bm.deserialize({
    buildings: {
      townhall: [{ instanceId: 'townhall_0', level: 3 }],
      barracks: [{ instanceId: 'barracks_0', level: 2 }],
      farm:     [{ instanceId: 'farm_0', level: 0 }], // unbuilt slot
    },
    // A legacy save dropped a built barracks straight onto a skeleton cell.
    placements: {
      townhall_0: { cx: 20, cy: 14 },
      barracks_0: { cx: sx, cy: sy },
    },
    sectors: { cleared: [], clearing: {} },
  });
  const rects = bm.getPlacementRects();
  for (const r of rects)
    assert.ok(!rectHitsSkeleton(r.cx, r.cy, r.w, r.h),
      `${r.instanceId} (${r.cx},${r.cy}) still overlaps the road skeleton`);
});

test('valid {cx,cy} placements survive a serialize → deserialize round-trip', () => {
  const bm = makeManager(1);
  bm.getPlacementRects();                 // force initial pack
  bm._sectors.markCleared('sector_1_0');  // open cleared ground to move into
  const moved = bm.moveBuilding('farm_0', 12, 2);
  assert.ok(moved.success);
  const saved = bm.serialize();
  assert.deepEqual(saved.placements.farm_0, { cx: 12, cy: 2 });

  const bm2 = makeManager(1);
  bm2.deserialize(saved);
  assert.deepEqual(bm2.positionOf('farm_0'), { cx: 12, cy: 2 });
});

test('legacy save grandfathers rubble sectors under existing buildings', () => {
  const bm = makeManager(1);
  bm.deserialize({
    buildings: {
      townhall: [{ instanceId: 'townhall_0', level: 5 }],
      farm:     [{ instanceId: 'farm_0', level: 3 }],
    },
    // Phase-A shape: valid {cx,cy} placements, no `sectors` key. farm sits in a
    // corner rubble sector — deserialize must clear it, not strand the building.
    placements: { townhall_0: { cx: 20, cy: 14 }, farm_0: { cx: 0, cy: 0 } },
  });
  assert.deepEqual(bm.positionOf('farm_0'), { cx: 0, cy: 0 });
  assert.ok(bm.isCellCleared(0, 0), 'rubble under the farm was auto-cleared');
});

test('clearSector gates on HQ, spends, and completes on a sandbox tick', () => {
  const bm = makeManager(1);
  bm._buildings.set('townhall', [{ instanceId: 'townhall_0', level: 5 }]);
  bm._gameMode = 'sandbox';
  assert.equal(bm.getSectors().find(s => s.id === 'sector_1_0').cleared, false);
  assert.ok(bm.clearSector('sector_1_0').success);
  bm.update(0.016);
  assert.ok(bm.isCellCleared(12, 2), 'sector_1_0 cell is now cleared');
});

test('roads and ground are never serialized; sectors are', () => {
  const saved = makeManager(1).serialize();
  assert.ok(!('roads' in saved) && !('roadCells' in saved) && !('ground' in saved));
  assert.ok('sectors' in saved);
});

test('cleared sectors survive a serialize → deserialize round-trip', () => {
  const bm = makeManager(1);
  bm._sectors.markCleared('sector_1_0');
  const bm2 = makeManager(1);
  bm2.deserialize(bm.serialize());
  assert.ok(bm2.getSectors().find(s => s.id === 'sector_1_0').cleared);
});

test('HQ is anchored; moveBuilding rejects it and blocked targets', () => {
  const bm = makeManager(1);
  bm.getPlacementRects();
  assert.equal(bm.isMovable('townhall_0'), false);
  assert.equal(bm.moveBuilding('townhall_0', 0, 0).success, false);
  // Move a building onto the HQ footprint → blocked.
  const hq = bm.positionOf('townhall_0');
  assert.equal(bm.moveBuilding('farm_0', hq.cx, hq.cy).success, false);
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

test('moving a building away drops its adjacency bonus, moving back restores it', () => {
  const rates = [];
  const rm = stubRM();
  rm.recalculateRates = (active) => rates.push(active);
  const bm = new BuildingManager(rm);
  bm._buildings.set('farm', [{ instanceId: 'farm_0', level: 1 }]);
  bm._buildings.set('mine', [{ instanceId: 'mine_0', level: 1 }]);
  bm.getPlacementRects();
  bm._recalcAdjacency();

  const home = bm.positionOf('mine_0');
  assert.ok(bm.getAdjacency('farm_0').bonus > 0, 'packer seats production side by side');

  const farm = bm.rectOf('farm_0');
  const isFar = (cx, cy) => Math.abs(cx - farm.cx) > 6 || Math.abs(cy - farm.cy) > 6;
  let moved = false;
  for (let cy = 0; cy < 32 && !moved; cy++) {
    for (let cx = 0; cx < 44 && !moved; cx++) {
      if (!isFar(cx, cy) || !bm.rectFree(cx, cy, 3, 3, 'mine_0')) continue;
      moved = bm.moveBuilding('mine_0', cx, cy).success;
    }
  }
  assert.equal(moved, true, 'found a distant free cell');
  assert.equal(bm.getAdjacency('farm_0').bonus, 0);

  assert.equal(bm.moveBuilding('mine_0', home.cx, home.cy).success, true);
  assert.ok(bm.getAdjacency('farm_0').bonus > 0);
  assert.ok(rates.at(-1).length > 0, 'each recompute pushes fresh rates');
});

test('an unbuilt instance earns no adjacency bonus', () => {
  const bm = makeManager(1);
  bm.getPlacementRects();
  assert.equal(bm.getAdjacency('farm_0').bonus, 0);
});

test('adjacency is never serialized — it re-derives on load', () => {
  const bm = makeManager(1);
  bm._buildings.set('farm', [{ instanceId: 'farm_0', level: 1 }]);
  bm._buildings.set('mine', [{ instanceId: 'mine_0', level: 1 }]);
  bm.getPlacementRects();
  bm._recalcAdjacency();
  const saved = bm.serialize();
  assert.equal('adjacency' in saved, false);

  const bm2 = makeManager(1);
  bm2.deserialize(saved);
  assert.equal(bm2.getAdjacency('farm_0').bonus, bm.getAdjacency('farm_0').bonus);
});
