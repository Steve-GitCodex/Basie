import test from 'node:test';
import assert from 'node:assert/strict';

import { UnitManager } from '../../js/systems/UnitManager.js';

function stubRM() {
  return { canAfford: () => true, spend() {}, add() {} };
}

function stubBM() {
  return {
    getLevelOf: () => 0,
    getBuiltInstanceCount: () => 5,
    getHQUnlockedIds: () => new Set(['infantry']),
    getRequiredHQLevel: () => 1,
  };
}

function makeSquadWithReserve(count = 100) {
  const um = new UnitManager(stubRM(), stubBM());
  um._reserve.set('infantry_t1', count);
  const { squadId } = um.createSquad('Alpha');
  assert.ok(um.assignToSquad(squadId, 'infantry', count, 1, 0).success);
  return { um, squadId };
}

function assertSlotInvariant(um, squadId) {
  const squad = um._squads.get(squadId);
  const bySlot = new Map();
  for (const entry of squad.slotUnits.values()) {
    bySlot.set(entry.tierKey, (bySlot.get(entry.tierKey) ?? 0) + entry.count);
  }
  for (const [tierKey, count] of squad.units) {
    assert.equal(bySlot.get(tierKey) ?? 0, count, `slotUnits/units mismatch for ${tierKey}`);
  }
}

test('removeUnitsFromSquad then clearSlotUnits does not duplicate units', () => {
  const { um, squadId } = makeSquadWithReserve(100);
  const before = um.getTotalUnitCount();

  um.removeUnitsFromSquad(squadId, { infantry_t1: 40 });
  assertSlotInvariant(um, squadId);
  assert.ok(um.getTotalUnitCount() <= before);

  um.clearSlotUnits(squadId, 0);
  assertSlotInvariant(um, squadId);

  assert.equal(um._reserve.get('infantry_t1'), 60);
  assert.ok(um.getTotalUnitCount() <= before);
});

test('removeFromSquad keeps slotUnits in sync and cannot duplicate units', () => {
  const { um, squadId } = makeSquadWithReserve(100);
  const before = um.getTotalUnitCount();

  const result = um.removeFromSquad(squadId, 'infantry', 40, 1);
  assert.ok(result.success);
  assertSlotInvariant(um, squadId);
  assert.equal(um._reserve.get('infantry_t1'), 40);
  assert.equal(um.getTotalUnitCount(), before);

  um.clearSlotUnits(squadId, 0);
  assertSlotInvariant(um, squadId);
  assert.equal(um._reserve.get('infantry_t1'), 100);
  assert.equal(um.getTotalUnitCount(), before);
});

test('deleteSquad refuses a squad deployed on a march', () => {
  const { um, squadId } = makeSquadWithReserve(100);
  um.setSquadDeployed(squadId, true);

  const result = um.deleteSquad(squadId);
  assert.equal(result.success, false);

  const squad = um.getSquad(squadId);
  assert.ok(squad, 'squad must still exist');
  assert.equal(squad.units.find(u => u.tierKey === 'infantry_t1')?.count, 100);
  assert.equal(um._reserve.get('infantry_t1') ?? 0, 0);
});

test('deleteSquad succeeds once a squad is no longer deployed', () => {
  const { um, squadId } = makeSquadWithReserve(100);
  um.setSquadDeployed(squadId, true);
  assert.equal(um.deleteSquad(squadId).success, false);

  um.setSquadDeployed(squadId, false);
  const result = um.deleteSquad(squadId);
  assert.ok(result.success);
  assert.equal(um._reserve.get('infantry_t1'), 100);
  assert.equal(um.getSquad(squadId), null);
});

test('slotUnits stays consistent with squad.units across combat losses and manual removal', () => {
  const { um, squadId } = makeSquadWithReserve(100);
  assertSlotInvariant(um, squadId);

  um.removeUnitsFromSquad(squadId, { infantry_t1: 10 });
  assertSlotInvariant(um, squadId);

  um.removeFromSquad(squadId, 'infantry', 20, 1);
  assertSlotInvariant(um, squadId);

  um.removeUnitsFromSquad(squadId, { infantry_t1: 70 });
  assertSlotInvariant(um, squadId);

  const squad = um._squads.get(squadId);
  assert.equal(squad.units.get('infantry_t1'), 0);
  assert.equal(squad.slotUnits.size, 0);
});

test('a barracks-stationed hero shortens train time via the global trainingSpeed effect', () => {
  const um = new UnitManager(stubRM(), stubBM());
  um._hm = { getHeroGlobalEffects: () => ({ trainingSpeed: 0.12 }) };
  const withHero = um._trainMultiplier();

  um._hm = { getHeroGlobalEffects: () => ({}) };
  const without = um._trainMultiplier();

  assert.ok(withHero < without, 'a training-speed hero reduces the multiplier');
  assert.ok(Math.abs(withHero - without / 1.12) < 1e-9);
});

test('_trainMultiplier is unchanged when no hero manager is present', () => {
  const um = new UnitManager(stubRM(), stubBM());
  um._hm = null;
  assert.ok(Number.isFinite(um._trainMultiplier()));
});
