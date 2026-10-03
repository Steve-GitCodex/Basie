import test from 'node:test';
import assert from 'node:assert/strict';

import { pickForYou } from '../../js/systems/trading/forYouPicks.js';

const snapshot = (over = {}) => ({
  queues: { build: null, train: null, research: null },
  resources: {},
  heroes: [],
  featured: [],
  ...over,
});

test('running build with 3120s left picks speedup_build_15m with reason', () => {
  const picks = pickForYou(snapshot({
    queues: { build: { label: 'Barracks Lv4', secsLeft: 3120 }, train: null, research: null },
  }));
  assert.deepEqual(picks[0], { entryId: 'speedup_build_15m', reason: 'Barracks Lv4 · 52m left' });
});

test('queue shorter than 5m falls back to 5m; hours format as h m', () => {
  const short = pickForYou(snapshot({
    queues: { build: null, train: { label: 'Squad', secsLeft: 120 }, research: null },
  }));
  assert.equal(short[0].entryId, 'speedup_train_5m');
  const long = pickForYou(snapshot({
    queues: { build: null, train: null, research: { label: 'Tech', secsLeft: 3 * 3600 + 5 * 60 } },
  }));
  assert.deepEqual(long[0], { entryId: 'speedup_research_1h', reason: 'Tech · 3h 5m left' });
});

test('lowest resource by amount/cap picks its resources entry', () => {
  const picks = pickForYou(snapshot({
    resources: {
      wood: { amount: 900, cap: 1000 },
      iron: { amount: 10, cap: 1000 },
      food: { amount: 500, cap: 1000 },
      money: { amount: 0, cap: 1000 },
    },
  }));
  assert.deepEqual(picks[0], { entryId: 'res_bundle_iron_t4', reason: 'Iron is your lowest resource' });
});

test('hero within 25% of next level picks xp_bundle_medium', () => {
  const picks = pickForYou(snapshot({
    heroes: [{ name: 'Kira', level: 11, xp: 460, xpToNext: 600 }],
  }));
  assert.deepEqual(picks[0], { entryId: 'xp_bundle_medium', reason: 'Kira is 140 XP from Lv12' });
});

test('hero far from next level is not picked', () => {
  const picks = pickForYou(snapshot({
    heroes: [{ name: 'Kira', level: 11, xp: 100, xpToNext: 600 }],
  }));
  assert.equal(picks.length, 0);
});

test('no candidates pads with featured, reason null', () => {
  const picks = pickForYou(snapshot({ featured: ['token_epic', 'speedup_universal_1h'] }));
  assert.deepEqual(picks, [
    { entryId: 'token_epic', reason: null },
    { entryId: 'speedup_universal_1h', reason: null },
  ]);
});

test('never more than 6 and no duplicate entryIds', () => {
  const picks = pickForYou(snapshot({
    queues: {
      build: { label: 'A', secsLeft: 4000 },
      train: { label: 'B', secsLeft: 4000 },
      research: { label: 'C', secsLeft: 4000 },
    },
    resources: { wood: { amount: 1, cap: 100 } },
    heroes: [{ name: 'Kira', level: 1, xp: 90, xpToNext: 100 }],
    featured: ['speedup_build_1h', 'a', 'b', 'c', 'd', 'e', 'f'],
  }));
  assert.ok(picks.length <= 6);
  assert.equal(new Set(picks.map(p => p.entryId)).size, picks.length);
});
