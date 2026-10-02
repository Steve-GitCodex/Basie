import test from 'node:test';
import assert from 'node:assert/strict';

import { ChangeBatcher } from '../../scripts/launcher/watcher.mjs';

function fakeTimers() {
  const t = { pending: null, sets: 0, clears: 0 };
  t.setTimer = (fn) => { t.sets++; t.pending = fn; return t.sets; };
  t.clearTimer = () => { t.clears++; t.pending = null; };
  t.fire = () => { const fn = t.pending; t.pending = null; fn?.(); };
  return t;
}

function batcher() {
  const timers = fakeTimers();
  const batches = [];
  const b = new ChangeBatcher({ quietMs: 150, onBatch: (x) => batches.push(x), ...timers });
  return { b, timers, batches };
}

test('css-only changes batch as css with normalised, sorted paths', () => {
  const { b, timers, batches } = batcher();
  b.add('css\\base\\a.css');
  b.add('css/b.css');
  timers.fire();
  assert.deepEqual(batches, [{ kind: 'css', files: ['css/b.css', 'css/base/a.css'] }]);
});

test('any non-css change makes the batch a full reload', () => {
  const { b, timers, batches } = batcher();
  b.add('css/a.css');
  b.add('js/x.js');
  timers.fire();
  assert.equal(batches[0].kind, 'full');
});

test('editor temp files are ignored entirely', () => {
  const { b, timers, batches } = batcher();
  for (const f of ['js/x.js~', 'js/.x.swp', 'js/x.tmp', 'js/#x#']) b.add(f);
  assert.equal(timers.sets, 0);
  timers.fire();
  assert.deepEqual(batches, []);
});

test('a burst of 200 changes debounces into a single batch', () => {
  const { b, timers, batches } = batcher();
  for (let i = 0; i < 200; i++) b.add(`js/f${i}.js`);
  assert.equal(timers.sets, 200);
  assert.equal(timers.clears, 199);
  timers.fire();
  assert.equal(batches.length, 1);
  assert.equal(batches[0].files.length, 200);
});

test('repeated changes to one file are reported once', () => {
  const { b, timers, batches } = batcher();
  b.add('js/x.js'); b.add('js/x.js'); b.add('js\\x.js');
  timers.fire();
  assert.deepEqual(batches[0].files, ['js/x.js']);
});

test('the batch resets after firing', () => {
  const { b, timers, batches } = batcher();
  b.add('js/a.js'); timers.fire();
  b.add('css/b.css'); timers.fire();
  assert.deepEqual(batches[1], { kind: 'css', files: ['css/b.css'] });
});
