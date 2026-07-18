import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BASE_SPEED_PX, CARRY_PER_UNIT, MIN_DWELL_MS, MAX_DWELL_MS, CATEGORY_SPEED,
  distance, squadBaseSpeed, armySpeed, travelMs, squadSize, loadCapacity, gatherDwellMs,
} from '../../js/systems/march/marchMath.js';

const squad = (units) => ({ units });

test('distance is euclidean and order-independent', () => {
  assert.equal(distance(0, 0, 3, 4), 5);
  assert.equal(distance(3, 4, 0, 0), 5);
  assert.equal(distance(10, 10, 10, 10), 0);
});

test('an empty or missing squad falls back to speed 1', () => {
  assert.equal(squadBaseSpeed(squad([])), 1.0);
  assert.equal(squadBaseSpeed(null), 1.0);
  assert.equal(squadBaseSpeed(undefined), 1.0);
});

test('a squad marches at its slowest member', () => {
  const mixed = squad([
    { category: 'cavalry', count: 5 },
    { category: 'siege', count: 1 },
  ]);
  assert.equal(squadBaseSpeed(mixed), CATEGORY_SPEED.siege);
});

test('an explicit unit speed stat overrides its category speed', () => {
  assert.equal(squadBaseSpeed(squad([{ category: 'cavalry', stats: { speed: 0.5 } }])), 0.5);
});

test('a unit with neither speed nor known category defaults to 1', () => {
  assert.equal(squadBaseSpeed(squad([{ category: 'balloon' }])), 1.0);
});

test('army speed scales base speed by rally bonus and logistic buffs', () => {
  const infantry = squad([{ category: 'infantry', count: 10 }]);
  assert.equal(armySpeed(infantry), BASE_SPEED_PX);
  assert.equal(armySpeed(infantry, { rallySpeedBonus: 0.5 }), BASE_SPEED_PX * 1.5);
  assert.equal(armySpeed(infantry, { logisticMult: 1.2 }), BASE_SPEED_PX * 1.2);
  assert.equal(
    armySpeed(infantry, { rallySpeedBonus: 0.5, logisticMult: 1.2 }),
    BASE_SPEED_PX * 1.5 * 1.2,
  );
});

test('cavalry outrun infantry over the same distance', () => {
  const dist = 5000;
  const foot = travelMs(dist, armySpeed(squad([{ category: 'infantry', count: 1 }])));
  const horse = travelMs(dist, armySpeed(squad([{ category: 'cavalry', count: 1 }])));
  assert.ok(horse < foot);
});

test('travel time is distance over speed in ms', () => {
  assert.equal(travelMs(1000, 100), 10_000);
  assert.equal(travelMs(0, 100), 0);
});

test('a stopped army never arrives', () => {
  assert.equal(travelMs(1000, 0), Infinity);
  assert.equal(travelMs(1000, -5), Infinity);
});

test('squad size sums unit counts and tolerates missing ones', () => {
  assert.equal(squadSize(squad([{ count: 3 }, { count: 7 }])), 10);
  assert.equal(squadSize(squad([{ count: 3 }, {}])), 3);
  assert.equal(squadSize(squad([])), 0);
  assert.equal(squadSize(null), 0);
});

test('load capacity is carry-per-unit times squad size', () => {
  assert.equal(loadCapacity(squad([{ count: 4 }])), 4 * CARRY_PER_UNIT);
  assert.equal(loadCapacity(squad([])), 0);
});

test('gather dwell scales with load over node rate', () => {
  assert.equal(gatherDwellMs(50, 10), 5000);
});

test('gather dwell is clamped at both ends', () => {
  assert.equal(gatherDwellMs(1, 1000), MIN_DWELL_MS);
  assert.equal(gatherDwellMs(100_000, 1), MAX_DWELL_MS);
  assert.equal(gatherDwellMs(100, 0), MIN_DWELL_MS);
});
