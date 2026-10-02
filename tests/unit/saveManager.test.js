import test from 'node:test';
import assert from 'node:assert/strict';

import { eventBus } from '../../js/core/EventBus.js';
import { SaveManager } from '../../js/core/SaveManager.js';

function makeMemoryStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
}

test('a save issued after a wipe persists — wipe does not permanently disable saving', () => {
  const sm = new SaveManager(makeMemoryStorage());
  sm.wipe();
  sm.save({ a: 1 });
  assert.equal(sm.hasSave(), true);
});

test('wipe still clears any existing save', () => {
  const sm = new SaveManager(makeMemoryStorage());
  sm.save({ a: 1 });
  assert.equal(sm.hasSave(), true);
  sm.wipe();
  assert.equal(sm.hasSave(), false);
});

test('suppressSaves blocks the beforeunload re-save that would resurrect a wipe', () => {
  const sm = new SaveManager(makeMemoryStorage());
  sm.save({ a: 1 });
  sm.wipe();
  sm.suppressSaves();
  sm.save({ a: 1 });
  assert.equal(sm.hasSave(), false);
});

test('quota exhaustion emits game:saveFailed and not game:saved', () => {
  const storage = makeMemoryStorage();
  storage.setItem = () => {
    const err = new Error('quota exceeded');
    err.name = 'QuotaExceededError';
    throw err;
  };
  const sm = new SaveManager(storage);

  let savedFired = false;
  let failedPayload = null;
  const offSaved = eventBus.on('game:saved', () => { savedFired = true; });
  const offFailed = eventBus.on('game:saveFailed', (payload) => { failedPayload = payload; });

  try {
    sm.save({ a: 1 });
  } finally {
    offSaved();
    offFailed();
  }

  assert.equal(savedFired, false);
  assert.ok(failedPayload);
  assert.equal(failedPayload.reason, 'quota');
});

test('a non-quota save error also emits game:saveFailed with a distinct reason', () => {
  const storage = makeMemoryStorage();
  storage.setItem = () => { throw new Error('disk unavailable'); };
  const sm = new SaveManager(storage);

  let failedPayload = null;
  const offFailed = eventBus.on('game:saveFailed', (payload) => { failedPayload = payload; });

  try {
    sm.save({ a: 1 });
  } finally {
    offFailed();
  }

  assert.ok(failedPayload);
  assert.equal(failedPayload.reason, 'unknown');
});

test('a SaveManager with a custom key never reads or writes the default save', () => {
  const storage = makeMemoryStorage();
  const real = new SaveManager(storage);
  const dev = new SaveManager(storage, 'basie_dev_save:world');
  real.save({ who: 'real' });
  assert.equal(dev.load(), null);
  dev.save({ who: 'dev' });
  dev.wipe();
  assert.equal(real.load().who, 'real');
});
