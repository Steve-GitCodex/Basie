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

// ── L7 regression: gacha fragmentItemId ids must resolve to real inventory items ──

test('every GACHA_CONFIG fragmentItemId resolves to a real inventory item', () => {
  for (const itemId of Object.values(GACHA_CONFIG.fragmentItemId)) {
    assert.ok(INVENTORY_ITEMS[itemId], `fragmentItemId '${itemId}' has no INVENTORY_ITEMS entry`);
  }
});

// ── Task 6: rollScroll retired in favor of heroes-only rollToken ──

test('rollToken marks the result as grantFailed when addItem rejects the reward', () => {
  const inv = stubInv({ addItem: () => false });
  inv._seed('token_normal', 1);
  const hm = makeHM(inv);

  let sawFailure = false;
  for (let i = 0; i < 200; i++) {
    inv._seed('token_normal', 1);
    const r = hm.rollToken('normal');
    if (r.grantFailed) {
      assert.ok(!r.itemId, `${r.outcome} roll should not report an itemId when the grant failed`);
      sawFailure = true;
    }
  }
  assert.ok(sawFailure, 'expected at least one grantFailed outcome across 200 rolls');
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

test('getHeroInstanceBonus ignores a hero stationed off their preferred building type', () => {
  const hm = makeHM();
  hm._owned.set('shadowblade', {
    heroId: 'shadowblade', level: 1, xp: 0, xpToNext: 550, stars: 0,
    effectiveStats: {},
    assignment: { type: 'building', buildingId: 'barracks_0' },
  });

  assert.equal(hm.getHeroInstanceBonus('barracks_0'), 0, 'Shadowblade stationed in a barracks must not boost iron production');
});

test('getHeroInstanceBonus applies the bonus when stationed at the matching building type', () => {
  const hm = makeHM();
  hm._owned.set('shadowblade', {
    heroId: 'shadowblade', level: 1, xp: 0, xpToNext: 550, stars: 0,
    effectiveStats: {},
    assignment: { type: 'building', buildingId: 'mine_0' },
  });

  assert.ok(hm.getHeroInstanceBonus('mine_0') > 0, 'Shadowblade stationed in a mine should boost iron production');
});

test('awardHeroXP levels a hero up using the linear-step XP curve with tier multiplier', () => {
  const m = makeHM();
  m._recruitHero('warlord'); // legendary, tierMult 1.5
  m.awardHeroXP('warlord', 500);
  const h = m.getRosterWithState().find(x => x.id === 'warlord');
  assert.equal(h.level, 3);
  assert.equal(h.xpToNext, Math.round((100 + 20 * 2) * 1.5));
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
  assert.equal(roster.find(x => x.id === 'warlord').level, 3);
  assert.equal(roster.find(x => x.id === 'paladin').level, 1);
});

test('awakenHero consumes Hero Shards and increments stars', () => {
  const m = makeHM();
  m._recruitHero('warlord');
  m._inv.addItem('shard_warlord', 30);
  const r = m.awakenHero('warlord');
  assert.equal(r.success, true);
  assert.equal(r.stars, 1);
  assert.equal(m._inv.getQuantity('shard_warlord'), 28);
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
  assert.equal(typeof m.rollToken, 'function');
  assert.equal(typeof m.awardHeroXP, 'function');
  assert.equal(typeof m.assignHeroToSquad, 'function');
  assert.equal(typeof m.getCombatBonuses, 'function');
  assert.equal(typeof m.getHeroInstanceBonus, 'function');
  assert.equal(typeof m.getHeroGlobalEffects, 'function');
  // round-trip: assign → combat bonus reflects it (heroquarters has heroCapacity: 0, so barracks_0 is the real hero-station path)
  m.assignHeroToBuilding('warlord', 'barracks_0');
  assert.ok(m.getCombatBonuses().attackMult > 1.0);
});

// ── Task 4: awakenHero now supports the full shard-only 10-star track past star 5 ──

test('awakenHero succeeds via shards at stars 5, beyond the old legacy starCosts array bound', () => {
  const m = makeHM();
  m._recruitHero('warlord');
  const hero = m._owned.get('warlord');
  hero.stars = 5;
  m._inv.addItem('shard_warlord', 30);

  const result = m.awakenHero('warlord');
  assert.equal(result.success, true);
  assert.equal(result.stars, 6);
});

test('awakenHero succeeds via shards at stars 9, then rejects at stars 10', () => {
  const m = makeHM();
  m._recruitHero('paladin');
  const hero = m._owned.get('paladin');
  hero.stars = 9;
  m._inv.addItem('shard_paladin', 30);

  const result = m.awakenHero('paladin');
  assert.equal(result.success, true);
  assert.equal(result.stars, 10);

  const capped = m.awakenHero('paladin');
  assert.equal(capped.success, false);
  assert.equal(capped.reason, 'Hero is at max stars.');
});

test('getRosterWithState publishes a positive nextStarShardCost for a hero mid-track at stars 5', () => {
  const m = makeHM();
  m._recruitHero('shadowblade');
  const hero = m._owned.get('shadowblade');
  hero.stars = 5;

  const roster = m.getRosterWithState();
  const shadowbladeEntry = roster.find(x => x.id === 'shadowblade');
  assert.ok(shadowbladeEntry.nextStarShardCost > 0);
});

test('getRosterWithState returns null for nextStarShardCost when hero is at stars 10 (max)', () => {
  const m = makeHM();
  m._recruitHero('warlord');
  const hero = m._owned.get('warlord');
  hero.stars = 10;

  const roster = m.getRosterWithState();
  const warlordEntry = roster.find(x => x.id === 'warlord');
  assert.equal(warlordEntry.nextStarShardCost, null);
});

// ── Task 7: two-stage pity persistence ──

test('HeroManager starts with zeroed per-tier pity counters', () => {
  const m = makeHM();
  assert.deepEqual(m._pity, { normal: 0, epic: 0, legendary: 0 });
});

test('pity counters survive serialize/deserialize', () => {
  const m = makeHM();
  m._inv.addItem('token_normal', 5);
  for (let i = 0; i < 5; i++) m.rollToken('normal');
  const data = m.serialize();
  const m2 = makeHM();
  m2.deserialize(data);
  assert.equal(m2._pity.normal, m._pity.normal);
});

test('deserialize reconciles a legacy save missing _pity to zeroed defaults', () => {
  const m = makeHM();
  assert.doesNotThrow(() => m.deserialize({ owned: {}, activeBuffs: [] }));
  assert.deepEqual(m._pity, { normal: 0, epic: 0, legendary: 0 });
});

test('rosterComplete is false with no heroes owned and true once every hero of that tier is recruited', () => {
  const m = makeHM();
  assert.equal(m.rosterComplete('normal'), false);
  for (const h of m.getRosterWithState().filter(h => h.tier === 'normal')) {
    m._recruitHero(h.id);
  }
  assert.equal(m.rosterComplete('normal'), true);
});

test('rosterComplete is scoped to the given tier: completing one tier leaves the others incomplete', () => {
  const m = makeHM();
  for (const h of m.getRosterWithState().filter(h => h.tier === 'normal')) {
    m._recruitHero(h.id);
  }
  assert.equal(m.rosterComplete('normal'), true);
  assert.equal(m.rosterComplete('epic'), false);
  assert.equal(m.rosterComplete('legendary'), false);
});

// ── Task 10: full persistence round-trip (ADR 0002 guard) ──

test('serialize→deserialize preserves owned heroes, stars, and pity', () => {
  const m = makeHM();
  m._recruitHero('warlord');
  m._owned.get('warlord').stars = 4;
  m._inv.addItem('token_normal', 3);
  for (let i = 0; i < 3; i++) m.rollToken('normal');

  const data = m.serialize();
  const m2 = makeHM();
  m2.deserialize(data);

  assert.equal(m2._owned.get('warlord').stars, 4);
  assert.deepEqual(m2._pity, m._pity);
});

test('deserialize computes xpToNext from the current XP curve, not a legacy per-hero constant, for a corrupted legacy save', () => {
  const m = makeHM();
  m._recruitHero('warlord');
  const freshXpToNext = m._owned.get('warlord').xpToNext;

  const m2 = makeHM();
  m2.deserialize({
    owned: { warlord: { level: 1, xp: 0, xpToNext: NaN, stars: 0 } },
    activeBuffs: [],
  });

  assert.equal(m2._owned.get('warlord').xpToNext, freshXpToNext);
});

test('deserialize reconciles a legacy save missing stars to 0', () => {
  const m = makeHM();
  m.deserialize({ owned: { warlord: { level: 1, xp: 0, xpToNext: 500 } }, activeBuffs: [] });
  assert.equal(m._owned.get('warlord').stars, 0);
});

// ── Review finding 3: a finite-but-stale legacy xpToNext must not survive a load ──

test('deserialize recomputes xpToNext from the current curve even when the saved value is finite but stale', () => {
  const m = makeHM();
  m._recruitHero('warlord');
  const freshXpToNext = m._owned.get('warlord').xpToNext;

  const m2 = makeHM();
  m2.deserialize({
    owned: { warlord: { level: 10, xp: 0, xpToNext: 5300, stars: 0 } },
    activeBuffs: [],
  });

  assert.notEqual(m2._owned.get('warlord').xpToNext, 5300);
  assert.equal(m2._owned.get('warlord').xpToNext, m2._progression.xpToNext(10, 'legendary'));
  assert.notEqual(freshXpToNext, m2._owned.get('warlord').xpToNext);
});

// ── Review finding 6: ADR 0025 dual-shape cleanup — legacy awaken fields are gone ──

test('getRosterWithState no longer publishes the retired legacy-shape awaken fields', () => {
  const m = makeHM();
  m._recruitHero('shadowblade');
  const entry = m.getRosterWithState().find(x => x.id === 'shadowblade');
  assert.equal('nextStarCost' in entry, false);
  assert.equal('fragForAwaken' in entry, false);
  assert.equal('canAwakenByCard' in entry, false);
  assert.equal('canAwakenByFrag' in entry, false);
  assert.equal('canSummonByFrags' in entry, false);
});

test('getRosterWithState publishes a shard-based next-awaken cost instead', () => {
  const m = makeHM();
  m._recruitHero('shadowblade');
  const hero = m._owned.get('shadowblade');
  hero.stars = 10;
  const entry = m.getRosterWithState().find(x => x.id === 'shadowblade');
  assert.equal(entry.nextStarShardCost, null);

  hero.stars = 0;
  const entry2 = m.getRosterWithState().find(x => x.id === 'shadowblade');
  assert.equal(entry2.nextStarShardCost, 1);
});

// ── Task 6: shard-funded skill leveling ──

test('leveling a skill spends the exact shard cost and raises the level', () => {
  const m = makeHM();
  m._recruitHero('warlord');
  m._owned.get('warlord').level = 20;
  m._inv._seed('shard_warlord', 10);

  const before = m._inv.getQuantity('shard_warlord');
  const res = m.levelUpSkill('warlord', 'iron_will');

  assert.equal(res.success, true, res.reason);
  assert.equal(res.level, 2);
  assert.equal(m._inv.getQuantity('shard_warlord'), before - 1, 'L2 costs exactly 1 shard');
  assert.equal(m._owned.get('warlord').skillLevels.iron_will, 2);
});

test('leveling fails with a reason when shards are short, and spends nothing', () => {
  const m = makeHM();
  m._recruitHero('warlord');
  m._owned.get('warlord').level = 20;

  const res = m.levelUpSkill('warlord', 'iron_will');
  assert.equal(res.success, false);
  assert.match(res.reason, /shard/i);
  assert.equal(m._owned.get('warlord').skillLevels?.iron_will ?? 1, 1, 'level moved despite failure');
});

test('a locked skill cannot be leveled', () => {
  const m = makeHM();
  m._recruitHero('warlord');
  m._owned.get('warlord').level = 1;
  m._inv._seed('shard_warlord', 50);

  const res = m.levelUpSkill('warlord', 'iron_will');
  assert.equal(res.success, false);
  assert.match(res.reason, /Lv\.?\s*20|locked/i);
});

test('a major cannot be leveled below star 5 but can at star 5', () => {
  const m = makeHM();
  m._recruitHero('warlord');
  const h = m._owned.get('warlord');
  h.level = 100; h.stars = 4;
  m._inv._seed('shard_warlord', 100);

  assert.equal(m.levelUpSkill('warlord', 'last_stand').success, false);
  h.stars = 5;
  const res = m.levelUpSkill('warlord', 'last_stand');
  assert.equal(res.success, true, res.reason);
  assert.equal(res.level, 1, 'the first purchase takes a major from 0 to 1');
  assert.equal(m._inv.getQuantity('shard_warlord'), 100 - 5, 'major L1 costs 5 shards');
});

test('a capped skill reports at-cap rather than spending', () => {
  const m = makeHM();
  m._recruitHero('warlord');
  const h = m._owned.get('warlord');
  h.level = 20;
  h.skillLevels = { iron_will: 10 };
  m._inv._seed('shard_warlord', 50);

  const res = m.levelUpSkill('warlord', 'iron_will');
  assert.equal(res.success, false);
  assert.match(res.reason, /max|cap/i);
  assert.equal(m._inv.getQuantity('shard_warlord'), 50, 'shards were spent at cap');
});

test('deserialize sanitizes skillLevels — clamps, defaults and drops', () => {
  const m = makeHM();
  m.deserialize({
    owned: {
      warlord: {
        heroId: 'warlord', level: 20, xp: 0, xpToNext: 100, stars: 0,
        assignment: { type: 'none' },
        skillLevels: { iron_will: 999, last_stand: 99, bogus_id: 3 },
      },
    },
  });
  const sl = m._owned.get('warlord').skillLevels;
  assert.equal(sl.iron_will, 10, 'over-cap passive not clamped');
  assert.equal(sl.last_stand, 5, 'over-cap major not clamped');
  assert.equal(sl.bogus_id, undefined, 'unknown id survived load');
  assert.equal(sl.battle_cry, 1, 'missing passive did not default to 1');
});
