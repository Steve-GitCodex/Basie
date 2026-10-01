import test from 'node:test';
import assert from 'node:assert/strict';

import { pullCountFor, revealPlan, resultTotals } from '../../js/ui/heroes/pullPlan.js';

test('no tokens means no pull buttons', () => {
  assert.deepEqual(pullCountFor(0), { single: false, multi: 0 });
});

test('one token offers a single pull and no multi pull', () => {
  assert.deepEqual(pullCountFor(1), { single: true, multi: 0 });
});

test('the multi pull is labelled with exactly what it will spend', () => {
  assert.equal(pullCountFor(2).multi, 2);
  assert.equal(pullCountFor(9).multi, 9);
  assert.equal(pullCountFor(10).multi, 10);
  assert.equal(pullCountFor(25).multi, 10);
});

test('nonsense token counts are treated as zero', () => {
  assert.deepEqual(pullCountFor(undefined), { single: false, multi: 0 });
  assert.deepEqual(pullCountFor(-3), { single: false, multi: 0 });
});

test('a brand-new hero bursts and earns a spotlight', () => {
  assert.deepEqual(revealPlan([{ outcome: 'hero', isDuplicate: false }]), [{ hint: 'burst', spotlight: true }]);
});

test('a duplicate hero result never gets the new-hero spotlight', () => {
  assert.deepEqual(revealPlan([{ outcome: 'hero', isDuplicate: true }]), [{ hint: 'plain', spotlight: false }]);
});

test('a hero shard glows, everything else is plain', () => {
  const plan = revealPlan([
    { outcome: 'shard', isDuplicate: true },
    { outcome: 'fragment' },
    { outcome: 'xp' },
    { outcome: 'overflow' },
  ]);
  assert.deepEqual(plan.map(p => p.hint), ['glow', 'plain', 'plain', 'plain']);
  assert.ok(plan.every(p => p.spotlight === false));
});

test('a failed grant is plain even if it was a hero', () => {
  assert.deepEqual(revealPlan([{ outcome: 'hero', grantFailed: true }]), [{ hint: 'plain', spotlight: false }]);
});

test('totals count each outcome and skip failures and duplicate heroes', () => {
  const totals = resultTotals([
    { outcome: 'hero', isDuplicate: false },
    { outcome: 'hero', isDuplicate: true },
    { outcome: 'shard' }, { outcome: 'shard' },
    { outcome: 'fragment' }, { outcome: 'fragment' }, { outcome: 'fragment' },
    { outcome: 'xp' },
    { outcome: 'overflow' },
    { outcome: 'fragment', grantFailed: true },
  ]);
  assert.deepEqual(totals, { heroes: 1, shards: 2, fragments: 3, xp: 1, overflow: 1 });
});

test('an empty pull totals to zero', () => {
  assert.deepEqual(resultTotals([]), { heroes: 0, shards: 0, fragments: 0, xp: 0, overflow: 0 });
});
