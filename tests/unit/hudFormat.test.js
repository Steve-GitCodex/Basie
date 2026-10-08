import test from 'node:test';
import assert from 'node:assert/strict';
import { compact, fillState, fillRatio, timeToFull, formatDuration } from '../../js/ui/hud/hudFormat.js';

test('compact keeps small numbers exact and abbreviates large ones', () => {
  assert.equal(compact(999.7), '999');
  assert.equal(compact(48200), '48.2K');
  assert.equal(compact(2410000), '2.4M');
  assert.equal(compact(18400000000), '18.4B');
});

test('compact never exceeds 5 characters up to 999B', () => {
  for (const n of [1000, 99999, 999999, 1e6, 99.9e6, 999e9]) {
    assert.ok(compact(n).length <= 5, compact(n));
  }
});

test('fillState thresholds and infinite caps', () => {
  assert.equal(fillState(899, 1000), 'ok');
  assert.equal(fillState(900, 1000), 'near');
  assert.equal(fillState(1000, 1000), 'full');
  assert.equal(fillState(5, Infinity), 'ok');
  assert.equal(fillState(5, 0), 'ok');
});

test('fillRatio clamps and handles bad caps', () => {
  assert.equal(fillRatio(1500, 1000), 1);
  assert.equal(fillRatio(5, Infinity), 0);
});

test('timeToFull', () => {
  assert.equal(timeToFull(1000, 1000, 2), 0);
  assert.equal(timeToFull(0, 1000, 2), 500);
  assert.equal(timeToFull(0, Infinity, 2), null);
  assert.equal(timeToFull(0, 1000, 0), null);
});

test('formatDuration', () => {
  assert.equal(formatDuration(4800), '1h 20m');
  assert.equal(formatDuration(245), '4m 05s');
  assert.equal(formatDuration(12), '12s');
  assert.equal(formatDuration(245.5), '4m 05s');
  assert.equal(formatDuration(NaN), '0s');
});
