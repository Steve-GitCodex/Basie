import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEV_SAVE_PREFIX, DEFAULT_DEV_SLOT, sanitizeSlotName, devSlotKey, listDevSlots, deleteDevSlot,
} from '../../js/core/devSlots.js';

function makeMemoryStorage(entries = {}) {
  const store = new Map(Object.entries(entries));
  return {
    get length() { return store.size; },
    key: (i) => [...store.keys()][i] ?? null,
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
}

test('a bare ?dev flag maps to the default slot', () => {
  assert.equal(sanitizeSlotName(''), DEFAULT_DEV_SLOT);
  assert.equal(sanitizeSlotName(null), DEFAULT_DEV_SLOT);
  assert.equal(sanitizeSlotName('  '), DEFAULT_DEV_SLOT);
});

test('slot names are normalised to a url- and key-safe form', () => {
  assert.equal(sanitizeSlotName('World Test!'), 'world-test');
  assert.equal(sanitizeSlotName('Heroes_2'), 'heroes_2');
  assert.equal(sanitizeSlotName('x'.repeat(50)).length, 32);
});

test('dev slot keys never collide with the real save key', () => {
  assert.notEqual(devSlotKey(''), 'basie_game_state');
  assert.ok(devSlotKey('world').startsWith(DEV_SAVE_PREFIX));
});

test('listDevSlots returns only dev slots, sorted', () => {
  const storage = makeMemoryStorage({
    basie_game_state: '{}',
    [devSlotKey('world')]: '{}',
    [devSlotKey('default')]: '{}',
    basie_dev_dashboard_open: '1',
  });
  assert.deepEqual(listDevSlots(storage), ['default', 'world']);
});

test('deleteDevSlot removes only that slot', () => {
  const storage = makeMemoryStorage({
    basie_game_state: 'real',
    [devSlotKey('world')]: '{}',
    [devSlotKey('heroes')]: '{}',
  });
  deleteDevSlot(storage, 'world');
  assert.deepEqual(listDevSlots(storage), ['heroes']);
  assert.equal(storage.getItem('basie_game_state'), 'real');
});
