import test from 'node:test';
import assert from 'node:assert/strict';

import { starsFor } from '../../js/systems/campaign/starRules.js';

const base = { victory: true, sent: 100, dead: 0, wounded: 0, rounds: 5, roundPar: 8 };

test('a defeat earns 0 stars', () => {
  assert.equal(starsFor({ ...base, victory: false }), 0);
});

test('a win with 30% losses earns 1 star', () => {
  assert.equal(starsFor({ ...base, dead: 20, wounded: 10 }), 1);
});

test('a win with 25% losses over par rounds earns 2 stars', () => {
  assert.equal(starsFor({ ...base, dead: 15, wounded: 10, rounds: 9 }), 2);
});

test('a win with 25% losses or fewer within par earns 3 stars', () => {
  assert.equal(starsFor({ ...base, dead: 15, wounded: 10, rounds: 8 }), 3);
});

test('a win with 0 sent earns 1 star without dividing by zero', () => {
  assert.equal(starsFor({ ...base, sent: 0 }), 1);
});
