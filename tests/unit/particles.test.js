import test from 'node:test';
import assert from 'node:assert/strict';

import { ParticleField } from '../../js/ui/fx/particles.js';

test('spawn respects the pool cap', () => {
  const f = new ParticleField(5);
  for (let i = 0; i < 20; i++) f.spawn({ x: 0, y: 0, life: 1 });
  assert.equal(f.count, 5);
});

test('particles integrate position from velocity/acceleration', () => {
  const f = new ParticleField();
  f.spawn({ x: 0, y: 0, vx: 10, vy: 0, ay: 20, life: 10 });
  f.update(1);
  const p = f._live[0];
  assert.equal(p.x, 10);
  assert.equal(p.vy, 20);
  assert.equal(p.y, 20);
});

test('particles are reaped once age reaches life', () => {
  const f = new ParticleField();
  f.spawn({ x: 0, y: 0, life: 1 });
  f.update(0.5);
  assert.equal(f.count, 1);
  f.update(0.6);
  assert.equal(f.count, 0);
});

test('update compacts the live array without leaving holes', () => {
  const f = new ParticleField();
  f.spawn({ x: 0, y: 0, life: 0.1 });
  f.spawn({ x: 1, y: 0, life: 10 });
  f.spawn({ x: 2, y: 0, life: 0.1 });
  f.update(0.2);
  assert.equal(f.count, 1);
  assert.equal(f._live[0].x, 1);
});

test('fade envelope covers each mode across the lifetime', () => {
  const f = new ParticleField();
  assert.equal(f._envelope('none', 0.5), 1);
  assert.equal(f._envelope('in', 0.25), 0.25);
  assert.equal(f._envelope('out', 0.25), 0.75);
  assert.ok(Math.abs(f._envelope('inout', 0.5) - 1) < 1e-9);
  assert.equal(f._envelope('out', 1), 0);
});

test('haze paces spawns by an internal accumulator', () => {
  const f = new ParticleField();
  f.haze(1, { w: 100, h: 100, rate: 10 });
  assert.equal(f.count, 10);
});

test('burst emits the requested spark count', () => {
  const f = new ParticleField();
  f.burst(0, 0, { count: 12 });
  assert.equal(f.count, 12);
  assert.ok(f._live.every(p => p.shape === 'spark'));
});

test('ripple grows its radius over time', () => {
  const f = new ParticleField();
  f.ripple(0, 0, { size: 6, grow: 100, life: 10 });
  f.update(0.5);
  assert.equal(f._live[0].size, 56);
  assert.equal(f._live[0].shape, 'ring');
});
