import test from 'node:test';
import assert from 'node:assert/strict';

import { HeroManager } from '../../js/systems/HeroManager.js';
import { GACHA_CONFIG, INVENTORY_ITEMS } from '../../js/entities/GAME_DATA.js';

function stubRM() {
  return { canAfford: () => true, spend() {}, add() {}, getSnapshot: () => ({}) };
}

function stubBM() {
  return { getLevelOf: () => 1 };
}

function stubInv(overrides = {}) {
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
    ...overrides,
  };
}

function makeHM(inv = stubInv()) {
  return new HeroManager(stubRM(), stubBM(), inv);
}

// ── L7 regression: gacha resourcePool ids must resolve to real inventory items ──

test('every GACHA_CONFIG resourcePool id resolves to a real inventory item', () => {
  for (const itemId of GACHA_CONFIG.resourcePool) {
    assert.ok(INVENTORY_ITEMS[itemId], `resourcePool id '${itemId}' has no INVENTORY_ITEMS entry`);
  }
});

test('every GACHA_CONFIG xpPool id resolves to a real inventory item', () => {
  for (const pool of Object.values(GACHA_CONFIG.xpPool)) {
    for (const itemId of pool) {
      assert.ok(INVENTORY_ITEMS[itemId], `xpPool id '${itemId}' has no INVENTORY_ITEMS entry`);
    }
  }
});

test('every GACHA_CONFIG buffPool id resolves to a real inventory item', () => {
  for (const pool of Object.values(GACHA_CONFIG.buffPool)) {
    for (const itemId of pool) {
      assert.ok(INVENTORY_ITEMS[itemId], `buffPool id '${itemId}' has no INVENTORY_ITEMS entry`);
    }
  }
});

test('every GACHA_CONFIG fragmentItemId resolves to a real inventory item', () => {
  for (const itemId of Object.values(GACHA_CONFIG.fragmentItemId)) {
    assert.ok(INVENTORY_ITEMS[itemId], `fragmentItemId '${itemId}' has no INVENTORY_ITEMS entry`);
  }
});

test('rolling a resource outcome actually grants an item to the inventory', () => {
  const inv = stubInv();
  inv._seed('scroll_common', 1);
  const hm = makeHM(inv);

  let granted = false;
  for (let i = 0; i < 200 && !granted; i++) {
    const r = hm.rollScroll('common');
    if (r.outcome === 'resource') {
      granted = true;
      assert.ok(r.itemId, 'resource roll must report an itemId');
      assert.ok(!r.grantFailed, 'resource roll must not report grantFailed');
      assert.ok(inv.getQuantity(r.itemId) > 0, 'inventory must actually contain the granted item');
    }
    if (!granted) inv._seed('scroll_common', 1);
  }
  assert.ok(granted, 'expected at least one resource outcome across 200 rolls');
});

// ── L2: addItem failure must surface, not be swallowed as success ──

test('rollScroll marks the result as grantFailed when addItem rejects the reward', () => {
  const inv = stubInv({ addItem: () => false });
  inv._seed('scroll_common', 1);
  const hm = makeHM(inv);

  let sawFailure = false;
  for (let i = 0; i < 200; i++) {
    inv._seed('scroll_common', 1);
    const r = hm.rollScroll('common');
    if (r.outcome === 'resource' || r.outcome === 'xp_item' || r.outcome === 'buff') {
      assert.ok(r.grantFailed, `${r.outcome} roll should report grantFailed when addItem fails`);
      assert.ok(!r.itemId, `${r.outcome} roll should not report an itemId when the grant failed`);
      sawFailure = true;
    }
  }
  assert.ok(sawFailure, 'expected at least one resource/xp_item/buff outcome across 200 rolls');
});

// ── L9: HQ aura must key off actual assignment location, not hero config ──

test('getCombatBonuses does not apply a hero aura when stationed away from heroquarters', () => {
  const hm = makeHM();
  hm._owned.set('paladin', {
    heroId: 'paladin', level: 1, xp: 0, xpToNext: 650, stars: 0,
    effectiveStats: {},
    assignment: { type: 'building', buildingId: 'mine_0' },
  });

  const bonuses = hm.getCombatBonuses('squad_1');
  assert.equal(bonuses.defenseMult, 1.0, 'Paladin stationed in a mine must not grant defense_boost');
});

test('getCombatBonuses does not leak a hero from another squad barracks', () => {
  const hm = makeHM();
  hm._owned.set('paladin', {
    heroId: 'paladin', level: 1, xp: 0, xpToNext: 650, stars: 0,
    effectiveStats: {},
    assignment: { type: 'building', buildingId: 'barracks_1' }, // squad_2
  });

  const bonuses = hm.getCombatBonuses('squad_1');
  assert.equal(bonuses.defenseMult, 1.0, 'squad_1 must not receive squad_2\'s Paladin aura');
});

test('getCombatBonuses applies a hero aura when genuinely stationed at heroquarters', () => {
  const hm = makeHM();
  hm._owned.set('paladin', {
    heroId: 'paladin', level: 1, xp: 0, xpToNext: 650, stars: 0,
    effectiveStats: {},
    assignment: { type: 'building', buildingId: 'heroquarters_0' },
  });

  const bonuses = hm.getCombatBonuses('squad_1');
  assert.ok(bonuses.defenseMult > 1.0, 'Paladin genuinely at heroquarters should still apply globally');
});

// ── L10: deserialize must not drop activeBuffs when `owned` is absent ──

test('deserialize preserves activeBuffs even when owned is missing', () => {
  const hm = makeHM();
  const futureEndsAt = Date.now() + 1_000_000;
  hm.deserialize({ activeBuffs: [{ value: 0.1, endsAt: futureEndsAt }] });

  assert.equal(hm.getActiveBuffs().length, 1);
  assert.equal(hm.getActiveBuffs()[0].endsAt, futureEndsAt);
});

test('deserialize with no data at all is a safe no-op', () => {
  const hm = makeHM();
  assert.doesNotThrow(() => hm.deserialize(null));
  assert.doesNotThrow(() => hm.deserialize(undefined));
});

// ── L8-partial: building production bonus must respect buildingType ──

test('getBuildingProductionBonusMap ignores a hero stationed off their preferred building type', () => {
  const hm = makeHM();
  hm._owned.set('shadowblade', {
    heroId: 'shadowblade', level: 1, xp: 0, xpToNext: 550, stars: 0,
    effectiveStats: {},
    assignment: { type: 'building', buildingId: 'barracks_0' },
  });

  const map = hm.getBuildingProductionBonusMap();
  assert.equal(map.money ?? 0, 0, 'Shadowblade stationed in a barracks must not boost money production');
});

test('getBuildingProductionBonusMap applies the bonus when stationed at the matching building type', () => {
  const hm = makeHM();
  hm._owned.set('shadowblade', {
    heroId: 'shadowblade', level: 1, xp: 0, xpToNext: 550, stars: 0,
    effectiveStats: {},
    assignment: { type: 'building', buildingId: 'mine_0' },
  });

  const map = hm.getBuildingProductionBonusMap();
  assert.ok((map.money ?? 0) > 0, 'Shadowblade stationed in a mine should boost money production');
});

test('awardHeroXP levels a hero up using the 1.3^level curve', () => {
  const m = makeHM();
  m._recruitHero('warlord');
  m.awardHeroXP('warlord', 500);
  const h = m.getRosterWithState().find(x => x.id === 'warlord');
  assert.equal(h.level, 2);
  assert.equal(h.xpToNext, Math.floor(500 * Math.pow(1.3, 1)));
});

test('awardHeroXP ignores non-finite or non-positive amounts', () => {
  const m = makeHM();
  m._recruitHero('warlord');
  m.awardHeroXP('warlord', NaN);
  m.awardHeroXP('warlord', -100);
  assert.equal(m.getRosterWithState().find(x => x.id === 'warlord').level, 1);
});

test('awardBattleXP only feeds heroes assigned to the target squad barracks', () => {
  const m = makeHM();
  m._recruitHero('warlord');
  m._recruitHero('paladin');
  m.assignHeroToBuilding('warlord', 'barracks_0');
  m.assignHeroToBuilding('paladin', 'barracks_1');
  m.awardBattleXP(500, 'squad_1');
  const roster = m.getRosterWithState();
  assert.equal(roster.find(x => x.id === 'warlord').level, 2);
  assert.equal(roster.find(x => x.id === 'paladin').level, 1);
});

test('awakenHero via fragments increments stars and consumes fragments', () => {
  const m = makeHM();
  m._recruitHero('warlord');
  m._inv.addItem('fragment_warlord', 10);
  const r = m.awakenHero('warlord', 'fragment');
  assert.equal(r.success, true);
  assert.equal(r.stars, 1);
  assert.equal(m._inv.getQuantity('fragment_warlord'), 0);
});

test('assignHeroToBuilding blocks a second hero past a non-barracks heroCapacity', () => {
  const m = makeHM();
  m._recruitHero('warlord');
  m._recruitHero('paladin');
  const first = m.assignHeroToBuilding('warlord', 'mine_0');
  const second = m.assignHeroToBuilding('paladin', 'mine_0');
  assert.equal(first.success, true);
  assert.equal(second.success, false);
});

test('assignHeroToSquad maps squad_1 to barracks_0 and getSquadHeroIds reflects it', () => {
  const m = makeHM();
  m._recruitHero('warlord');
  m.assignHeroToSquad('warlord', 'squad_1');
  assert.deepEqual(m.getSquadHeroIds('squad_1'), ['warlord']);
});

test('every delegated public method still works after the split', () => {
  const m = makeHM();
  m._recruitHero('warlord');
  assert.equal(typeof m.rollScroll, 'function');
  assert.equal(typeof m.awardHeroXP, 'function');
  assert.equal(typeof m.assignHeroToSquad, 'function');
  assert.equal(typeof m.getCombatBonuses, 'function');
  assert.equal(typeof m.getBuildingProductionBonusMap, 'function');
  // round-trip: assign → combat bonus reflects it (heroquarters has heroCapacity: 0, so barracks_0 is the real hero-station path)
  m.assignHeroToBuilding('warlord', 'barracks_0');
  assert.ok(m.getCombatBonuses().attackMult > 1.0);
});
