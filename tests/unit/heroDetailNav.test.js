import test from 'node:test';
import assert from 'node:assert/strict';

import { neighbourIds } from '../../js/ui/heroes/heroDetailNav.js';

const ORDER = ['a', 'b', 'c'];

test('neighbours wrap around both ends', () => {
  assert.deepEqual(neighbourIds(ORDER, 'a'), { prev: 'c', next: 'b' });
  assert.deepEqual(neighbourIds(ORDER, 'c'), { prev: 'b', next: 'a' });
});

test('a hero filtered out of the grid steps into the visible list', () => {
  assert.deepEqual(neighbourIds(ORDER, 'z'), { prev: 'c', next: 'a' });
});

test('a lone hero has nowhere to step', () => {
  assert.deepEqual(neighbourIds(['a'], 'a'), { prev: null, next: null });
});

test('an empty grid has no neighbours', () => {
  assert.deepEqual(neighbourIds([], 'a'), { prev: null, next: null });
});
