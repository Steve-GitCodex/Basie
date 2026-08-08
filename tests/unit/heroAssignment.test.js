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
