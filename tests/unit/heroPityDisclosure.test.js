import test from 'node:test';
import assert from 'node:assert/strict';

import { pityDisclosure } from '../../js/systems/hero/heroPityDisclosure.js';
import { PITY_CONFIG } from '../../js/entities/GAME_DATA.js';

test('before soft pity the rate is the flat per-tier new-hero rate', () => {
  const d = pityDisclosure('epic', 0, false);
  assert.ok(Math.abs(d.rate - PITY_CONFIG.newHeroRate.epic) < 1e-9);
  assert.equal(d.stage, 1);
  assert.equal(d.softPityFrom, 7);
  assert.equal(d.hardPityAt, 10);
});

test('6 pulls completed disclose the ramped rate for the next pull, pull 7', () => {
  const d = pityDisclosure('epic', 6, false);
  assert.ok(Math.abs(d.rate - (PITY_CONFIG.newHeroRate.epic + PITY_CONFIG.softPityBonusPerPull)) < 1e-9, 'pull 7 is the first ramped pull');
});

test('stage 2 (roster complete) never ramps, even inside the soft-pity window', () => {
  const d = pityDisclosure('epic', 8, true);
  assert.ok(Math.abs(d.rate - PITY_CONFIG.newHeroRate.epic) < 1e-9);
});

test('the disclosed rate matches what the next real pull will roll at', () => {
  const pullsCompleted = 6;
  const nextPull = pullsCompleted + 1;
  const softBonus = nextPull >= PITY_CONFIG.softPityFrom
    ? (nextPull - PITY_CONFIG.softPityFrom + 1) * PITY_CONFIG.softPityBonusPerPull
    : 0;
  const expected = Math.min(1, PITY_CONFIG.newHeroRate.epic + softBonus);
  const d = pityDisclosure('epic', pullsCompleted, false);
  assert.ok(Math.abs(d.rate - expected) < 1e-9);
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

test('the next pull landing on hard pity discloses a guaranteed rate of 1', () => {
  const pullsCompleted = PITY_CONFIG.stage1HardPityN - 1;
  const d = pityDisclosure('epic', pullsCompleted, false);
  assert.equal(d.rate, 1);
});

test('one pull below the hard-pity boundary still discloses the ramped rate', () => {
  const pullsCompleted = PITY_CONFIG.stage1HardPityN - 2;
  const nextPull = pullsCompleted + 1;
  const softBonus = nextPull >= PITY_CONFIG.softPityFrom
    ? (nextPull - PITY_CONFIG.softPityFrom + 1) * PITY_CONFIG.softPityBonusPerPull
    : 0;
  const expected = Math.min(1, PITY_CONFIG.newHeroRate.epic + softBonus);
  const d = pityDisclosure('epic', pullsCompleted, false);
  assert.ok(d.rate < 1);
  assert.ok(Math.abs(d.rate - expected) < 1e-9);
});

test('an unknown tier stays at zero rate even at the hard-pity boundary', () => {
  const pullsCompleted = PITY_CONFIG.stage1HardPityN - 1;
  const d = pityDisclosure('mythic', pullsCompleted, false);
  assert.equal(d.rate, 0);
});
