import test from 'node:test';
import assert from 'node:assert/strict';

import { estimateBadge } from '../../js/ui/combat/estimateBadge.js';

test('70% and above is ready', () => {
  assert.deepEqual(estimateBadge({ winChance: 0.7, avgDead: 0, avgWounded: 0 }), { cls: 'ready', label: 'Likely win · ~70%' });
});

test('40% to 70% is risky', () => {
  assert.equal(estimateBadge({ winChance: 0.55, avgDead: 0, avgWounded: 0 }).cls, 'risky');
  assert.equal(estimateBadge({ winChance: 0.4, avgDead: 0, avgWounded: 0 }).label, 'Risky · ~40%');
});

test('below 40% is weak', () => {
  assert.deepEqual(estimateBadge({ winChance: 0.2, avgDead: 0, avgWounded: 0 }), { cls: 'weak', label: 'Unlikely · ~20%' });
});

test('expected losses append dead plus wounded rounded', () => {
  assert.equal(estimateBadge({ winChance: 0.9, avgDead: 2.2, avgWounded: 1.6 }).label, 'Likely win · ~90% · ~4 lost');
});
