import { test } from 'node:test';
import assert from 'node:assert/strict';

let clock = 0;
const frames = [];
globalThis.performance = { now: () => clock };
globalThis.requestAnimationFrame = (cb) => { frames.push(cb); return frames.length; };
globalThis.cancelAnimationFrame = () => {};

function flush(step = 16) {
  let guard = 0;
  while (frames.length && guard++ < 500) {
    clock += step;
    frames.shift()(clock);
  }
}

const { tickTo } = await import('../../js/ui/fx/numberTicker.js');

test('first call sets the value instantly (no count-from-zero on boot)', () => {
  const el = { textContent: '' };
  tickTo(el, 500, String);
  assert.equal(el.textContent, '500');
  assert.equal(frames.length, 0);
});

test('non-finite target is written through the formatter without animating', () => {
  const el = { textContent: '10' };
  tickTo(el, NaN, (n) => `[${n}]`);
  assert.equal(el.textContent, '[NaN]');
  assert.equal(frames.length, 0);
});

test('a changed target animates and lands exactly on the target', () => {
  const el = { textContent: '' };
  tickTo(el, 100, String);        // seed
  tickTo(el, 200, String);        // retarget → animates
  assert.ok(frames.length > 0, 'expected an animation frame to be scheduled');
  flush();
  assert.equal(el.textContent, '200');
});

test('intermediate frames render rounded integers', () => {
  const el = { textContent: '' };
  const seen = [];
  const fmt = (n) => { seen.push(n); return String(n); };
  tickTo(el, 0, fmt);
  tickTo(el, 1000, fmt);
  flush(8);
  const mid = seen.filter((n) => n > 0 && n < 1000);
  assert.ok(mid.length > 0, 'expected mid-flight values');
  assert.ok(mid.every((n) => Number.isInteger(n)), 'mid-flight values must be integers');
});

test('retargeting to the current value settles instantly', () => {
  const el = { textContent: '' };
  tickTo(el, 42, String);
  tickTo(el, 42, String);
  assert.equal(el.textContent, '42');
  assert.equal(frames.length, 0);
});
