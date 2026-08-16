import test from 'node:test';
import assert from 'node:assert/strict';

import { HeroManager } from '../../js/systems/HeroManager.js';

function stubRM() {
  return { canAfford: () => true, spend() {}, add() {}, getSnapshot: () => ({}) };
}

function stubBM() {
  return { getLevelOf: () => 1 };
}

function stubInv() {
  const items = new Map();
  return {
    hasItem: (id, qty = 1) => (items.get(id) ?? 0) >= qty,
    removeItem: (id, qty = 1) => {
      const cur = items.get(id) ?? 0;
      if (cur < qty) return false;
      items.set(id, cur - qty);
      return true;
    },
    addItem: (id, qty = 1) => { items.set(id, (items.get(id) ?? 0) + qty); return true; },
    getQuantity: (id) => items.get(id) ?? 0,
  };
}

function makeHM() {
  return new HeroManager(stubRM(), stubBM(), stubInv());
}

test('stationing a hero does not throw after the production-bonus map removal', () => {
  const hm = makeHM();
  hm._owned.set('kaelenthorne', { heroId: 'kaelenthorne', level: 1, stars: 0, assignment: { type: 'none' } });
  assert.doesNotThrow(() => hm.assignHeroToBuilding('kaelenthorne', 'farm_0'));
  assert.doesNotThrow(() => hm.unassignHeroFromBuilding('kaelenthorne'));
});

test('a stationed hero cannot be moved to another building without removal', () => {
  const hm = makeHM();
  hm._recruitHero('warlord');
  assert.equal(hm.assignHeroToBuilding('warlord', 'farm_0').success, true);

  const res = hm.assignHeroToBuilding('warlord', 'mine_0');
  assert.equal(res.success, false);
  assert.match(res.reason, /remove/i, 'the reason should tell the player to remove them first');
  assert.equal(hm._owned.get('warlord').assignment.buildingId, 'farm_0',
    'the hero moved despite the rejection');
});

test('the rejection names the building the hero currently holds', () => {
  const hm = makeHM();
  hm._recruitHero('warlord');
  hm.assignHeroToBuilding('warlord', 'farm_0');
  assert.match(hm.assignHeroToBuilding('warlord', 'mine_0').reason, /farm/i);
});

test('unassigning first makes the move succeed', () => {
  const hm = makeHM();
  hm._recruitHero('warlord');
  hm.assignHeroToBuilding('warlord', 'farm_0');
  assert.equal(hm.unassignHeroFromBuilding('warlord').success, true);
  assert.equal(hm.assignHeroToBuilding('warlord', 'mine_0').success, true);
  assert.equal(hm._owned.get('warlord').assignment.buildingId, 'mine_0');
});

test('a squad move is rejected until the hero leaves their current barracks', () => {
  const hm = makeHM();
  hm._recruitHero('warlord');
  assert.equal(hm.assignHeroToBuilding('warlord', 'barracks_0', 0).success, true);
  assert.equal(hm.assignHeroToBuilding('warlord', 'barracks_1', 0).success, false);
  assert.equal(hm._owned.get('warlord').assignment.buildingId, 'barracks_0');
});

test('the barracks same-slot swap still works', () => {
  const hm = makeHM();
  hm._recruitHero('warlord');
  hm._recruitHero('paladin');
  assert.equal(hm.assignHeroToBuilding('warlord', 'barracks_0', 0).success, true);
  assert.equal(hm.assignHeroToBuilding('paladin', 'barracks_0', 0).success, true);
  assert.equal(hm._owned.get('warlord').assignment.type, 'none', 'the evicted hero was not cleared');
});

test('re-picking the slot a hero already holds is still a no-op, not a reassignment error', () => {
  const hm = makeHM();
  hm._recruitHero('warlord');
  hm.assignHeroToBuilding('warlord', 'farm_0');
  assert.match(hm.assignHeroToBuilding('warlord', 'farm_0').reason, /already assigned to this slot/i);
});
