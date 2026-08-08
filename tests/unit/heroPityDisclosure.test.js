import test from 'node:test';
import assert from 'node:assert/strict';

import { pityDisclosure } from '../../js/systems/hero/heroPityDisclosure.js';

test('before soft pity the rate is the flat per-tier new-hero rate', () => {
  const d = pityDisclosure('epic', 0, false);
  assert.ok(Math.abs(d.rate - 0.12) < 1e-9);
  assert.equal(d.stage, 1);
  assert.equal(d.softPityFrom, 7);
  assert.equal(d.hardPityAt, 10);
});

test('inside the soft-pity window the rate ramps per pull', () => {
  const d = pityDisclosure('epic', 7, false);
  assert.ok(Math.abs(d.rate - (0.12 + 0.08)) < 1e-9, 'pull 8 is the first ramped pull');
});

test('the rate never exceeds 1', () => {
  assert.equal(pityDisclosure('legendary', 9, false).rate <= 1, true);
});

test('pullsUntilGuarantee counts down to the hard pity pull', () => {
  assert.equal(pityDisclosure('normal', 0, false).pullsUntilGuarantee, 10);
  assert.equal(pityDisclosure('normal', 9, false).pullsUntilGuarantee, 1);
});

test('a completed tier roster reports the stage-2 shard floor, not a hero guarantee', () => {
  const d = pityDisclosure('normal', 3, true);
  assert.equal(d.stage, 2);
  assert.equal(d.pullsUntilGuarantee, 7);
  assert.match(d.guaranteeLabel, /shard/i);
});

test('an unknown tier degrades to zero rate rather than NaN', () => {
  const d = pityDisclosure('mythic', 0, false);
  assert.equal(d.rate, 0);
  assert.ok(Number.isFinite(d.pullsUntilGuarantee));
});
