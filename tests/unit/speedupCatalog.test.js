import test from 'node:test';
import assert from 'node:assert/strict';

import { INVENTORY_ITEMS } from '../../js/entities/GAME_DATA.js';
import {
  SPEEDUP_DURATIONS, SPEEDUP_TYPES, speedupItemId, durationSeconds,
} from '../../js/systems/trading/speedupCatalog.js';

test('every duration x type resolves to an existing INVENTORY_ITEMS id', () => {
  for (const duration of SPEEDUP_DURATIONS) {
    for (const type of SPEEDUP_TYPES) {
      const id = speedupItemId(duration, type);
      assert.ok(INVENTORY_ITEMS[id], `${duration}/${type} -> ${id}`);
    }
  }
});

test('speedupItemId builds typed ids', () => {
  assert.equal(speedupItemId('1h', 'train'), 'speedup_train_1h');
  assert.equal(speedupItemId('5m', 'universal'), 'speedup_universal_5m');
});

test('instant maps to speedup_universal_instant for all types', () => {
  for (const type of SPEEDUP_TYPES) {
    assert.equal(speedupItemId('instant', type), 'speedup_universal_instant');
  }
});

test('unknown duration or type returns null', () => {
  assert.equal(speedupItemId('2h', 'build'), null);
  assert.equal(speedupItemId('1h', 'bogus'), null);
});

test('durationSeconds matches inventory skipSeconds for timed durations', () => {
  assert.equal(durationSeconds('5m'), 300);
  assert.equal(durationSeconds('15m'), 900);
  assert.equal(durationSeconds('1h'), 3600);
  assert.equal(durationSeconds('8h'), 28800);
  assert.equal(durationSeconds('instant'), Infinity);
});
