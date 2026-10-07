import test from 'node:test';
import assert from 'node:assert/strict';

import { heroBarModel } from '../../js/ui/combat/scene/heroBarModel.js';

const skill = (id, type, extra = {}) => ({
  id, type, domain: 'combat', unlocked: true, level: 1, effect: { trigger: 'battle_start' }, ...extra,
});

const roster = [
  {
    id: 'warlord', level: 12, tier: 'legendary',
    skills: {
      passive: [skill('battle_cry', 'passive', { effect: { stat: 'attack' } })],
      support: [skill('charge', 'support'), skill('rally', 'support', { unlocked: false })],
      major: [skill('last_stand', 'major', { level: 0 })],
    },
  },
  { id: 'shadowblade', level: 4, tier: 'normal', skills: { passive: [], support: [], major: [] } },
  { id: 'paladin', level: 9, tier: 'epic', skills: {} },
];

test('squad heroes are ordered by slot and carry level and tier from the roster', () => {
  const out = heroBarModel(roster, {
    squadHeroes: [{ heroId: 'shadowblade', slotIndex: 2 }, { heroId: 'warlord', slotIndex: 0 }],
    supportHeroes: [{ heroId: 'paladin' }],
  });
  assert.deepEqual(out.squadHeroes.map(h => [h.heroId, h.slotIndex, h.level, h.tier]), [
    ['warlord', 0, 12, 'legendary'],
    ['shadowblade', 2, 4, 'normal'],
  ]);
  assert.deepEqual(out.supportHeroes, [{ heroId: 'paladin', level: 9, tier: 'epic' }]);
});

test('only unlocked triggered combat skills are shown, plus any the battle fired', () => {
  const out = heroBarModel(roster, {
    squadHeroes: [{ heroId: 'warlord', slotIndex: 0 }, { heroId: 'shadowblade', slotIndex: 1 }],
  }, { shadowblade: { shadowstep: 'ready' } });
  assert.deepEqual(out.squadHeroes[0].skillIds, ['charge']);
  assert.deepEqual(out.squadHeroes[1].skillIds, ['shadowstep']);
});

test('heroes missing from the roster fall back to level 1 normal with no skills', () => {
  const out = heroBarModel([], { squadHeroes: [{ heroId: 'ghost', slotIndex: 0 }] });
  assert.deepEqual(out.squadHeroes, [{ heroId: 'ghost', level: 1, tier: 'normal', slotIndex: 0, skillIds: [] }]);
  assert.deepEqual(out.supportHeroes, []);
});
