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
  // Phase 2c's bulwark (unlockLevel 1, defense +10% scope squad) is always unlocked here
  // and stacks flatly on top of the aura term via the squad-passive loop.
  const expected = 0.20 * (1 + 0.005 * 9 + 0.10) + 0.10;
  assert.ok(Math.abs((b.defenseMult - 1) - expected) < 0.001, `defenseMult got ${b.defenseMult}`);
});

test('an aura-passive skill below its unlockLevel contributes nothing', () => {
  const m = makeManager({ heroquartersLevel: 10 });
  m._recruitHero('paladin');
  const hero = m._owned.get('paladin');
  hero.level = 9; hero.stars = 0; // holy_light unlocks at 10
  hero.assignment = { type: 'building', buildingId: 'heroquarters_0' };

  const b = m.getCombatBonuses();
  // bulwark (unlockLevel 1) is still active here, unlike holy_light (unlockLevel 10).
  const expected = 0.20 * (1 + 0.005 * 8) + 0.10;
  assert.ok(Math.abs((b.defenseMult - 1) - expected) < 0.001, `defenseMult got ${b.defenseMult}`);
});

test('magic_amplify aura is treated like every other aura type (no x0.8 special-case)', () => {
  const m = makeManager({ heroquartersLevel: 10 });
  m._recruitHero('archsorceress'); // Vera, base 0.20 (magic_amplify)
  m._recruitHero('paladin');       // Aldric, base 0.20 (defense_boost, no special-case)
  const vera   = m._owned.get('archsorceress');
  const aldric = m._owned.get('paladin');
  // Levels stay below the 10/20 passive thresholds so the test isolates the aura formula
  // from those; bulwark (unlockLevel 1) is unavoidably always active on Aldric and is
  // added to defenseMult's expectation explicitly below.
  vera.level = 9; vera.stars = 3;
  aldric.level = 9; aldric.stars = 3;
  vera.assignment   = { type: 'building', buildingId: 'heroquarters_0' };
  aldric.assignment = { type: 'building', buildingId: 'heroquarters_0' };

  const b = m.getCombatBonuses();
  const expected = 0.20 * (1 + 0.005 * 8 + 0.04 * 3); // same base + same formula
  assert.ok(Math.abs((b.attackMult - 1) - expected) < 0.001, `attackMult got ${b.attackMult}`);
  assert.ok(Math.abs((b.defenseMult - 1) - (expected + 0.10)) < 0.001, `defenseMult got ${b.defenseMult}`);
});

test('the schema migration does not change combat aggregation for a squad hero', () => {
  const m = makeManager({ heroquartersLevel: 10 });
  m._recruitHero('warlord');
  const h = m._owned.get('warlord');
  h.level = 20;
  h.assignment = { type: 'building', buildingId: 'barracks_0' };

  const bonus = m.getCombatBonuses();

  assert.ok(bonus.lossReduction >= 0.08, 'iron_will lossReduction no longer applies');
  const chargeEntry = bonus.activeSkills.find(e => e.skill.id === 'charge');
  assert.ok(chargeEntry, 'charge is no longer collected as a triggered skill');
  assert.equal(chargeEntry.skill.effect.attackBonus, 0.20, 'charge lost its magnitude');
});

test('postBattleHeal from a passive skill reaches the returned combat bonuses', () => {
  const m = makeManager({ heroquartersLevel: 10 });
  m._recruitHero('paladin'); // Aldric, consecration (unlockLevel 20) grants postBattleHeal 0.05
  const hero = m._owned.get('paladin');
  hero.level = 20; hero.stars = 0;
  hero.assignment = { type: 'building', buildingId: 'heroquarters_0' };

  const b = m.getCombatBonuses();
  assert.ok(b.postBattleHeal > 0, 'consecration postBattleHeal never reached heroBonus.postBattleHeal');
});
