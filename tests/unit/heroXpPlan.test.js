import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xpToNext, project, xpNeeded, autoPick } from '../../js/systems/hero/heroXpPlan.js';
import { HeroProgression } from '../../js/systems/hero/heroProgression.js';

const items = () => [
  { id: 'xp_bundle_small', xp: 250, owned: 14, fragment: false },
  { id: 'xp_bundle_medium', xp: 1000, owned: 6, fragment: false },
  { id: 'xp_card', xp: 500, owned: 9, fragment: false },
  { id: 'frag', xp: 50, owned: 99, fragment: true },
];

test('xpToNext epic level 21 is 625', () => {
  assert.equal(xpToNext(21, 'epic'), 625);
});

test('HeroProgression.xpToNext delegates to the shared formula', () => {
  assert.equal(new HeroProgression({}).xpToNext(21, 'epic'), xpToNext(21, 'epic'));
});

test('project carries overflow into the next level', () => {
  const r = project({ level: 21, xp: 300, tier: 'epic', cap: 40 }, 750);
  assert.deepEqual(r, { level: 22, xp: 425, wasted: 0 });
});

test('project stops at the cap and reports wasted xp, leaving xp 0', () => {
  const need = xpToNext(10, 'epic');
  const r = project({ level: 10, xp: 0, tier: 'epic', cap: 11 }, need + 70);
  assert.deepEqual(r, { level: 11, xp: 0, wasted: 70 });
});

test('project at cap wastes everything', () => {
  assert.deepEqual(project({ level: 11, xp: 0, tier: 'epic', cap: 11 }, 90), { level: 11, xp: 0, wasted: 90 });
});

test('xpNeeded sums remaining xp to the target level', () => {
  const hero = { level: 5, xp: 30, tier: 'epic' };
  assert.equal(xpNeeded(hero, 7), xpToNext(5, 'epic') + xpToNext(6, 'epic') - 30);
  assert.equal(xpNeeded(hero, 5), 0);
});

test('autoPick takes one medium for 1000', () => {
  assert.deepEqual(autoPick(items(), 1000), { xp_bundle_medium: 1 });
});

test('autoPick adds one smallest item to cover the remainder', () => {
  assert.deepEqual(autoPick(items(), 1100), { xp_bundle_medium: 1, xp_bundle_small: 1 });
});

test('autoPick never includes fragments and returns {} for no need', () => {
  assert.equal(autoPick(items(), 1e9).frag, undefined);
  assert.deepEqual(autoPick(items(), 0), {});
});

test('autoPick short of need returns every non-fragment item at its owned count', () => {
  assert.deepEqual(autoPick(items(), 1e9), { xp_bundle_small: 14, xp_bundle_medium: 6, xp_card: 9 });
});

test('autoPick finisher falls back to the next-smallest item when the smallest is fully consumed', () => {
  const stock = [
    { id: 'small', xp: 250, owned: 1, fragment: false },
    { id: 'card', xp: 500, owned: 5, fragment: false },
    { id: 'medium', xp: 1000, owned: 1, fragment: false },
  ];
  assert.deepEqual(autoPick(stock, 1800), { medium: 1, card: 2, small: 1 });
});
