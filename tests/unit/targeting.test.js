import test from 'node:test';
import assert from 'node:assert/strict';

import { frontRow, livingInRow, allocate, applyDamage, strikeRow } from '../../js/systems/combat/targeting.js';

const stack = (over) => ({
  id: 's', type: 'infantry', tier: 1, row: 'front', count: 10, startCount: 10,
  hp: 100, attack: 10, defense: 10, hpPool: 1000, ...over,
});

test('front row is targeted first', () => {
  assert.equal(frontRow([stack({ row: 'back' }), stack({ row: 'front' })]), 'front');
});

test('next row takes over when the front is wiped', () => {
  const stacks = [stack({ row: 'front', count: 0, hpPool: 0 }), stack({ row: 'mid' }), stack({ row: 'back' })];
  assert.equal(frontRow(stacks), 'mid');
  assert.equal(livingInRow(stacks, 'front').length, 0);
  assert.equal(frontRow([stack({ count: 0 })]), null);
});

test('lower tiers soak more of the allocation', () => {
  const shares = allocate(100, [stack({ tier: 1 }), stack({ tier: 5 })]);
  assert.ok(shares[0] > shares[1]);
  assert.ok(Math.abs(shares[0] + shares[1] - 100) < 1e-9);
});

test('allocate returns zeros when nothing is alive', () => {
  assert.deepEqual(allocate(50, []), []);
});

test('applyDamage carries the wound on the front unit', () => {
  const s = stack();
  const result = applyDamage(s, 150);
  assert.equal(result.kills, 1);
  assert.equal(result.overflow, 0);
  assert.equal(s.count, 9);
  assert.equal(s.hpPool, 850);
});

test('applyDamage reports overflow beyond the pool', () => {
  const s = stack();
  const result = applyDamage(s, 1200);
  assert.equal(result.kills, 10);
  assert.equal(result.overflow, 200);
  assert.equal(s.count, 0);
});

test('spill never produces negative counts', () => {
  const targets = [stack({ id: 'a' }), stack({ id: 'b', tier: 2 })];
  const attacker = { count: 1e9, attack: 1000, type: 'infantry' };
  const { kills } = strikeRow({ attacker, mult: 1, targets, structure: false });
  for (const t of targets) {
    assert.equal(t.count, 0);
    assert.equal(t.hpPool, 0);
  }
  assert.equal(kills, 20);
  assert.ok(Number.isFinite(kills));
});

test('overflow from a wiped stack spills onto the survivor', () => {
  const weak = stack({ id: 'a', count: 1, hpPool: 100, tier: 1 });
  const big = stack({ id: 'b', count: 100, hpPool: 10000, tier: 10 });
  const attacker = { count: 1000, attack: 100, type: 'infantry' };
  const { kills } = strikeRow({ attacker, mult: 1, targets: [weak, big], structure: false });
  assert.equal(weak.count, 0);
  assert.ok(big.hpPool < 10000);
  assert.ok(kills >= 1);
});

test('strikeRow returns per-target hits whose kills sum to kills', () => {
  const targets = [stack({ id: 'a' }), stack({ id: 'b', tier: 3 })];
  const poolBefore = targets.reduce((sum, t) => sum + t.hpPool, 0);
  const { kills, hits } = strikeRow({ attacker: { count: 20, attack: 50, type: 'infantry' }, mult: 1, targets, structure: false });
  assert.deepEqual(hits.map((h) => h.targetId), ['a', 'b']);
  assert.ok(kills > 0);
  assert.equal(hits.reduce((sum, h) => sum + h.kills, 0), kills);
  const poolAfter = targets.reduce((sum, t) => sum + t.hpPool, 0);
  assert.ok(Math.abs(hits.reduce((sum, h) => sum + h.damage, 0) - (poolBefore - poolAfter)) < 1e-6);
});

test('overflow spill is credited to the survivor\'s hit', () => {
  const weak = stack({ id: 'a', count: 1, hpPool: 100, tier: 1 });
  const big = stack({ id: 'b', count: 100, hpPool: 10000, tier: 10 });
  const { kills, hits } = strikeRow({ attacker: { count: 1000, attack: 100, type: 'infantry' }, mult: 1, targets: [weak, big], structure: false });
  const hitOn = (id) => hits.find((h) => h.targetId === id);
  assert.equal(hits.length, 2);
  assert.deepEqual(hitOn('a'), { targetId: 'a', damage: 100, kills: 1 });
  assert.ok(Math.abs(hitOn('b').damage - (10000 - big.hpPool)) < 1e-6);
  assert.equal(hitOn('b').kills, 100 - big.count);
  assert.equal(hitOn('a').kills + hitOn('b').kills, kills);
});
