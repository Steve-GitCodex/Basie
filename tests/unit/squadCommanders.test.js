import test from 'node:test';
import assert from 'node:assert/strict';

import { squadCommanders } from '../../js/systems/campaign/squadCommanders.js';

const bonuses = { attackMult: 1.4, defenseMult: 1, baseDefense: 0.1, strikers: [{}, {}] };
const slots = [
  { slotIndex: 0, unitId: 'footman', tier: 1, count: 40, row: 'front' },
  { slotIndex: 1, unitId: 'archer', tier: 2, count: 30, row: 'back' },
];
const marcus = { heroId: 'warlord', level: 22, stars: 5, slotIndex: 0, skillLevels: { last_stand: 1 } };

test('slots without a hero have hero null', () => {
  const out = squadCommanders({ slots, squadHeroes: [marcus], supportHeroes: [], bonuses });
  assert.equal(out.slots[1].hero, null);
  assert.deepEqual(out.slots[1].auras, []);
  assert.deepEqual(out.slots[1].triggers, []);
  assert.equal(out.slots[1].unitId, 'archer');
});

test('hero maps to its barracks slotIndex', () => {
  const out = squadCommanders({ slots, squadHeroes: [marcus], supportHeroes: [], bonuses });
  assert.deepEqual(out.slots[0].hero, {
    heroId: 'warlord', name: 'Marcus Kestrel', icon: '⚔️', rarity: 'legendary', level: 22,
  });
  assert.equal(out.slots[0].count, 40);
});

test('aura and trigger chips use words', () => {
  const out = squadCommanders({ slots, squadHeroes: [marcus], supportHeroes: [], bonuses });
  assert.match(out.slots[0].auras[0], /^\+\d+% atk aura$/);
  assert.equal(out.slots[0].auras[1], 'Battle Cry +10%');
  assert.ok(out.slots[0].triggers.includes('Start: Charge'));
  assert.ok(out.slots[0].triggers.includes('Each wave: Rally'));
  assert.ok(out.slots[0].triggers.includes('Losing: Last Stand'));
});

test('locked major skills (level 0) produce no chip', () => {
  const out = squadCommanders({
    slots, squadHeroes: [{ ...marcus, skillLevels: undefined }], supportHeroes: [], bonuses,
  });
  assert.ok(!out.slots[0].triggers.includes('Losing: Last Stand'));
});

test('crit aura is labelled and skill chips carry through', () => {
  const kira = { heroId: 'shadowblade', level: 10, stars: 0, slotIndex: 1 };
  const out = squadCommanders({ slots, squadHeroes: [kira], supportHeroes: [], bonuses });
  assert.match(out.slots[1].auras[0], /^\+\d+% atk aura \(crit\)$/);
  assert.ok(out.slots[1].triggers.includes('Start: Shadowstep'));
});

test('totals come from the bonuses object, not re-derived', () => {
  const out = squadCommanders({ slots, squadHeroes: [], supportHeroes: [], bonuses });
  assert.deepEqual(out.totals, { attackPct: 40, defensePct: 10, strikesPerRound: 2 });
});

test('support lists Hero Quarters heroes', () => {
  const out = squadCommanders({
    slots, squadHeroes: [], bonuses,
    supportHeroes: [{ heroId: 'warlord', level: 5 }],
  });
  assert.match(out.support[0].text, /^\+\d+% atk aura$/);
  assert.deepEqual(out.support, [{ heroId: 'warlord', name: 'Marcus Kestrel', text: out.support[0].text }]);
});

test('a hero below a skill unlockLevel shows no chip for it', () => {
  const low = { heroId: 'warlord', level: 4, stars: 0, slotIndex: 0 };
  const out = squadCommanders({ slots, squadHeroes: [low], supportHeroes: [], bonuses });
  assert.deepEqual(out.slots[0].triggers, []);
  assert.ok(!out.slots[0].auras.some(a => a.startsWith('Battle Cry')));
});

test('a major skill with too few stars shows no trigger chip', () => {
  const out = squadCommanders({
    slots, squadHeroes: [{ ...marcus, stars: 4 }], supportHeroes: [], bonuses,
  });
  assert.ok(!out.slots[0].triggers.includes('Losing: Last Stand'));
  assert.ok(out.slots[0].triggers.includes('Start: Charge'));
});

test('aura chip reflects level and star scaling', () => {
  const read = hero => Number(squadCommanders({
    slots, squadHeroes: [hero], supportHeroes: [], bonuses,
  }).slots[0].auras[0].match(/\d+/)[0]);
  const base = read({ heroId: 'warlord', level: 1, stars: 0, slotIndex: 0 });
  assert.ok(read({ heroId: 'warlord', level: 22, stars: 5, slotIndex: 0 }) > base);
});

test('support text is null for a hero without a recognised aura', () => {
  const out = squadCommanders({
    slots, squadHeroes: [], bonuses, supportHeroes: [{ heroId: 'scholar_unknown', level: 1 }],
  });
  assert.equal(out.support[0].text, null);
});
