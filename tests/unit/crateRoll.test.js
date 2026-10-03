import test from 'node:test';
import assert from 'node:assert/strict';

import { rollCrate } from '../../js/systems/trading/crateRoll.js';
import { createRng } from '../../js/systems/combat/seededRng.js';
import { CRATE_TABLE } from '../../js/entities/GAME_DATA.js';

const constant = (v) => () => v;

test('10k seeded rolls land within 3% of 50/25/15/10', () => {
  const rng = createRng(1).next;
  const counts = { resources: 0, speedup: 0, xp: 0, money: 0 };
  for (let i = 0; i < 10000; i++) counts[rollCrate({ hqLevel: 1, rng }).kind]++;
  for (const [kind, weight] of Object.entries(CRATE_TABLE.weights)) {
    assert.ok(Math.abs(counts[kind] / 10000 - weight / 100) <= 0.03, `${kind} ${counts[kind]}`);
  }
});

test('resources roll at HQ 4 grants 4x base of one resource', () => {
  const roll = rollCrate({ hqLevel: 4, rng: constant(0) });
  assert.equal(roll.kind, 'resources');
  assert.deepEqual(roll.grants, { wood: 1200 });
});

test('resources roll can land on iron at 4x its base', () => {
  const rolls = [0.1, 0.99];
  const roll = rollCrate({ hqLevel: 4, rng: () => rolls.shift() });
  assert.deepEqual(roll.grants, { iron: 320 });
});

test('money = 100 x hqLevel', () => {
  const roll = rollCrate({ hqLevel: 3, rng: constant(0.99) });
  assert.equal(roll.kind, 'money');
  assert.deepEqual(roll.grants, { money: 300 });
});

test('speedup roll returns a CRATE_TABLE speed-up item and xp roll the xp bundle', () => {
  const speed = rollCrate({ hqLevel: 1, rng: constant(0.6) });
  assert.equal(speed.kind, 'speedup');
  assert.ok(CRATE_TABLE.speedups.some(s => s.itemId === speed.itemId));
  const xp = rollCrate({ hqLevel: 1, rng: constant(0.8) });
  assert.deepEqual(xp, { kind: 'xp', itemId: CRATE_TABLE.xpItemId });
});

test('eligible restricts the resource pick, falling back to all when empty', () => {
  const only = rollCrate({ hqLevel: 1, rng: constant(0), eligible: ['iron'] });
  assert.deepEqual(only.grants, { iron: 80 });
  const fallback = rollCrate({ hqLevel: 1, rng: constant(0), eligible: [] });
  assert.deepEqual(fallback.grants, { wood: 300 });
});
