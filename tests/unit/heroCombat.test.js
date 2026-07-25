import test from 'node:test';
import assert from 'node:assert/strict';

import { HeroManager } from '../../js/systems/HeroManager.js';
import { INVENTORY_ITEMS } from '../../js/entities/GAME_DATA.js';

function stubRM() {
  return { canAfford: () => true, spend() {}, add() {}, getSnapshot: () => ({}) };
}

function stubBM({ heroquartersLevel = 1 } = {}) {
  return { getLevelOf: (id) => (id === 'heroquarters' ? heroquartersLevel : 1) };
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
    addItem: (id, qty = 1) => {
      if (!INVENTORY_ITEMS[id]) return false;
      items.set(id, (items.get(id) ?? 0) + qty);
      return true;
    },
    getQuantity: (id) => items.get(id) ?? 0,
    _seed: (id, qty = 1) => items.set(id, qty),
  };
}

function makeManager({ heroquartersLevel = 1 } = {}) {
  return new HeroManager(stubRM(), stubBM({ heroquartersLevel }), stubInv());
}

test('aura is bounded and fully relative to base at endgame', () => {
  const m = makeManager({ heroquartersLevel: 10 });
  m._recruitHero('archsorceress');                  // Vera, base 0.20
  const h = m._owned.get('archsorceress');
  h.level = 100; h.stars = 10;
  h.assignment = { type: 'building', buildingId: 'heroquarters_0' };
  // 0.20·(1 + 0.005·99 + 0.04·10 + 0.15) = 0.20·2.045 = 0.409
  // arcane_nova (unlockLevel 10) is unlocked at level 100 with no skillLevels data,
  // so its old flat effect.value (0.15) applies via the level-gate fallback (finding 5).
  const b = m.getCombatBonuses();
  assert.ok(Math.abs((b.attackMult - 1) - 0.409) < 0.01, `got ${b.attackMult}`);
});

// ── Review finding 5: aura-passive skills must not be permanently inert ──

test('an unlocked aura-passive skill without skillLevels data still contributes its flat effect.value', () => {
  const m = makeManager({ heroquartersLevel: 10 });
  m._recruitHero('paladin'); // Aldric, base aura 0.20, holy_light unlockLevel 10, effect.value 0.10
  const hero = m._owned.get('paladin');
  hero.level = 10; hero.stars = 0;
  hero.assignment = { type: 'building', buildingId: 'heroquarters_0' };
  assert.equal(hero.skillLevels, undefined);

  const b = m.getCombatBonuses();
  // 0.20 * (1 + 0.005*9 + 0.04*0 + 0.10) = 0.20 * 1.145 = 0.229
  const expected = 0.20 * (1 + 0.005 * 9 + 0.10);
  assert.ok(Math.abs((b.defenseMult - 1) - expected) < 0.001, `defenseMult got ${b.defenseMult}`);
});

test('an aura-passive skill below its unlockLevel contributes nothing', () => {
  const m = makeManager({ heroquartersLevel: 10 });
  m._recruitHero('paladin');
  const hero = m._owned.get('paladin');
  hero.level = 9; hero.stars = 0; // holy_light unlocks at 10
  hero.assignment = { type: 'building', buildingId: 'heroquarters_0' };

  const b = m.getCombatBonuses();
  const expected = 0.20 * (1 + 0.005 * 8);
  assert.ok(Math.abs((b.defenseMult - 1) - expected) < 0.001, `defenseMult got ${b.defenseMult}`);
});

test('magic_amplify aura is treated like every other aura type (no x0.8 special-case)', () => {
  const m = makeManager({ heroquartersLevel: 10 });
  m._recruitHero('archsorceress'); // Vera, base 0.20 (magic_amplify)
  m._recruitHero('paladin');       // Aldric, base 0.20 (defense_boost, no special-case)
  const vera   = m._owned.get('archsorceress');
  const aldric = m._owned.get('paladin');
  // Levels stay below all passive skill unlock thresholds (5/10/20) so the test isolates
  // the aura formula from unrelated squad-passive skill contributions.
  vera.level = 9; vera.stars = 3;
  aldric.level = 9; aldric.stars = 3;
  vera.assignment   = { type: 'building', buildingId: 'heroquarters_0' };
  aldric.assignment = { type: 'building', buildingId: 'heroquarters_0' };

  const b = m.getCombatBonuses();
  const expected = 0.20 * (1 + 0.005 * 8 + 0.04 * 3); // same base + same formula
  assert.ok(Math.abs((b.attackMult - 1) - expected) < 0.001, `attackMult got ${b.attackMult}`);
  assert.ok(Math.abs((b.defenseMult - 1) - expected) < 0.001, `defenseMult got ${b.defenseMult}`);
});
