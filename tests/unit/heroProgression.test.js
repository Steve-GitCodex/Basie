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

test('xpToNext follows the linear-step curve with tier multiplier', () => {
  const m = makeManager({ heroquartersLevel: 10 });
  m._recruitHero('warlord');
  const h0 = m.getRosterWithState().find(x => x.id === 'warlord');
  assert.equal(h0.xpToNext, Math.round((100 + 20 * 0) * 1.5));
});

test('xpToNext scales with level and tier for a normal-tier hero', () => {
  const m = makeManager({ heroquartersLevel: 10 });
  m._recruitHero('shadowblade');
  m.awardHeroXP('shadowblade', 100);
  const h = m.getRosterWithState().find(x => x.id === 'shadowblade');
  assert.equal(h.level, 2);
  assert.equal(h.xpToNext, Math.round((100 + 20 * 1) * 1.0));
});

test('level is capped at heroquarters level x 10', () => {
  const m = makeManager({ heroquartersLevel: 1 });
  m._recruitHero('shadowblade');
  m.awardHeroXP('shadowblade', 10_000_000);
  assert.equal(m.getRosterWithState().find(x => x.id === 'shadowblade').level, 10);
});

test('XP awarded past the level cap is discarded, not banked', () => {
  const m = makeManager({ heroquartersLevel: 1 });
  m._recruitHero('shadowblade');
  m.awardHeroXP('shadowblade', 10_000_000);
  const capped = m.getRosterWithState().find(x => x.id === 'shadowblade');
  assert.equal(capped.level, 10);
  assert.equal(capped.xp, 0);

  m.awardHeroXP('shadowblade', 5000);
  const stillCapped = m.getRosterWithState().find(x => x.id === 'shadowblade');
  assert.equal(stillCapped.level, 10);
  assert.equal(stillCapped.xp, 0);
});

test('raising heroquarters level raises the hero cap for further leveling', () => {
  const m = makeManager({ heroquartersLevel: 1 });
  m._recruitHero('shadowblade');
  m.awardHeroXP('shadowblade', 10_000_000);
  assert.equal(m.getRosterWithState().find(x => x.id === 'shadowblade').level, 10);

  m._bm = stubBM({ heroquartersLevel: 2 });
  m.awardHeroXP('shadowblade', 10_000_000);
  assert.equal(m.getRosterWithState().find(x => x.id === 'shadowblade').level, 20);
});

test('a multi-level XP award recomputes xpToNext at each intermediate level', () => {
  const m = makeManager({ heroquartersLevel: 10 });
  m._recruitHero('warlord'); // legendary, tierMult 1.5
  m.awardHeroXP('warlord', 500);
  const h = m.getRosterWithState().find(x => x.id === 'warlord');
  assert.equal(h.level, 3);
  assert.equal(h.xpToNext, Math.round((100 + 20 * 2) * 1.5));
});

// ── Review finding 2: XP cards must be a spendable currency ──

test('applyXPCard consumes the card and grants its configured XP to the target hero', () => {
  const m = makeManager({ heroquartersLevel: 10 });
  m._recruitHero('shadowblade'); // normal tier
  m._inv._seed('xpcard_normal', 1);

  const r = m._progression.applyXPCard('xpcard_normal', 'shadowblade');
  assert.equal(r.success, true);
  assert.equal(r.xpAmount, 500);
  assert.equal(m._inv.getQuantity('xpcard_normal'), 0);
  assert.ok(m.getRosterWithState().find(x => x.id === 'shadowblade').level > 1);
});

test('applyXPCard fails when the player holds no such card', () => {
  const m = makeManager({ heroquartersLevel: 10 });
  m._recruitHero('shadowblade');
  const r = m._progression.applyXPCard('xpcard_normal', 'shadowblade');
  assert.equal(r.success, false);
});

test('applyXPCard fails for a hero not in the roster', () => {
  const m = makeManager({ heroquartersLevel: 10 });
  m._inv._seed('xpcard_normal', 1);
  const r = m._progression.applyXPCard('xpcard_normal', 'shadowblade');
  assert.equal(r.success, false);
  assert.equal(m._inv.getQuantity('xpcard_normal'), 1);
});

test('HeroManager.applyXPCard delegates to HeroProgression', () => {
  const m = makeManager({ heroquartersLevel: 10 });
  m._recruitHero('shadowblade');
  m._inv._seed('xpcard_normal', 1);
  const r = m.applyXPCard('xpcard_normal', 'shadowblade');
  assert.equal(r.success, true);
});
