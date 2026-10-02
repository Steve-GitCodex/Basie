import test from 'node:test';
import assert from 'node:assert/strict';

import { hitDamage, counterMult, varianceMult } from '../../js/systems/combat/hitMath.js';
import { createRng } from '../../js/systems/combat/seededRng.js';

const field = { structure: false };

test('25 attack into 100 defense deals 5', () => {
  assert.equal(hitDamage(25, 100), 5);
});

test('1000 attack into 10 defense deals about 990', () => {
  assert.ok(Math.abs(hitDamage(1000, 10) - 990.099) < 0.1);
});

test('zero attack deals zero', () => {
  assert.equal(hitDamage(0, 50), 0);
  assert.equal(hitDamage(-5, 0), 0);
});

test('infantry beats cavalry, cavalry beats ranged, ranged beats infantry', () => {
  assert.equal(counterMult('infantry', 'cavalry', field), 1.15);
  assert.equal(counterMult('cavalry', 'ranged', field), 1.15);
  assert.equal(counterMult('ranged', 'infantry', field), 1.15);
  assert.equal(counterMult('cavalry', 'infantry', field), 1);
  assert.equal(counterMult('ranged', 'cavalry', field), 1);
  assert.equal(counterMult('infantry', 'ranged', field), 1);
});

test('unknown types get no counter bonus', () => {
  assert.equal(counterMult('hero', 'infantry', field), 1);
  assert.equal(counterMult('infantry', 'hero', field), 1);
});

test('siege gets 1.5 only in structure fights', () => {
  assert.equal(counterMult('siege', 'infantry', { structure: true }), 1.5);
  assert.equal(counterMult('siege', 'infantry', { structure: false }), 1);
});

test('variance stays within +-10%', () => {
  const rng = createRng(99);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < 10000; i++) {
    const v = varianceMult(rng);
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  assert.ok(min >= 0.9 && max <= 1.1);
});
