import test from 'node:test';
import assert from 'node:assert/strict';

import { HeroManager } from '../../js/systems/HeroManager.js';
import { INVENTORY_ITEMS } from '../../js/entities/GAME_DATA.js';

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
    addItem: (id, qty = 1) => {
      if (!INVENTORY_ITEMS[id]) return false;
      items.set(id, (items.get(id) ?? 0) + qty);
      return true;
    },
    getQuantity: (id) => items.get(id) ?? 0,
  };
}

function makeManager() {
  return new HeroManager(stubRM(), stubBM(), stubInv());
}

test('awakenHero is shard-only and consumes the per-star Hero-Shard cost', () => {
  const m = makeManager();
  m._recruitHero('shadowblade');
  m._inv.addItem('shard_shadowblade', 1);
  const r = m.awakenHero('shadowblade');
  assert.equal(r.success, true);
  assert.equal(r.stars, 1);
  assert.equal(m._inv.getQuantity('shard_shadowblade'), 0);
});

test('awakenHero rejects at max 10 stars', () => {
  const m = makeManager();
  m._recruitHero('shadowblade');
  m._inv.addItem('shard_shadowblade', 999);
  for (let i = 0; i < 10; i++) m.awakenHero('shadowblade');
  const r = m.awakenHero('shadowblade');
  assert.equal(r.success, false);
  assert.equal(m.getRosterWithState().find(x => x.id === 'shadowblade').stars, 10);
});

test('awakenHero fails when Hero Shards are insufficient', () => {
  const m = makeManager();
  m._recruitHero('shadowblade');
  const r = m.awakenHero('shadowblade');
  assert.equal(r.success, false);
  assert.equal(m._owned.get('shadowblade').stars, 0);
});

test('awakenHero rejects an unknown hero', () => {
  const m = makeManager();
  const r = m.awakenHero('not_a_real_hero');
  assert.equal(r.success, false);
});

test('a token roll never yields a base-resource outcome', () => {
  const m = makeManager();
  m._inv.addItem('token_legendary', 200);
  const outcomes = new Set();
  for (let i = 0; i < 200; i++) outcomes.add(m.rollToken('legendary').outcome);
  for (const o of outcomes) assert.ok(['hero', 'fragment', 'shard', 'xp'].includes(o), o);
});

test('rolling a hero already owned converts to that hero fragments or shard', () => {
  const m = makeManager();
  m._recruitHero('warlord');
  const r = m._resolveTokenHero('legendary', 'warlord');
  assert.equal(r.isDuplicate, true);
  assert.ok(['fragment', 'shard'].includes(r.outcome));
});

test('rolling an unowned forced hero grants the hero and is not a duplicate', () => {
  const m = makeManager();
  const r = m._resolveTokenHero('legendary', 'archsorceress');
  assert.equal(r.outcome, 'hero');
  assert.equal(r.isDuplicate, false);
  assert.ok(m._owned.has('archsorceress'));
});

test('rollToken consumes exactly one token of the rolled tier', () => {
  const m = makeManager();
  m._inv.addItem('token_normal', 1);
  m.rollToken('normal');
  assert.equal(m._inv.getQuantity('token_normal'), 0);
});

test('rollToken reports failure without a token in hand', () => {
  const m = makeManager();
  const r = m.rollToken('epic');
  assert.equal(r.outcome, null);
});

test('a consolation fragment/shard grant targets a hero of the rolled token tier', () => {
  const m = makeManager();
  m._inv.addItem('token_normal', 200);
  const normalHeroIds = ['shadowblade', 'kaelenthorne'];
  for (let i = 0; i < 200; i++) {
    const r = m.rollToken('normal');
    if (r.outcome === 'fragment' || r.outcome === 'shard') {
      assert.ok(normalHeroIds.includes(r.heroId), `unexpected heroId '${r.heroId}' for a normal-tier consolation grant`);
    }
    m._inv.addItem('token_normal', 1);
  }
});

// ── Task 7: two-stage pity ──

test('stage-1 pity guarantees an un-owned hero by pull 10', () => {
  const m = makeManager();
  m._inv.addItem('token_normal', 10);
  let got = null;
  for (let i = 0; i < 10; i++) { const r = m.rollToken('normal'); if (r.outcome === 'hero' && !r.isDuplicate) got = r.heroId; }
  assert.ok(got, 'a new hero within 10 pulls');
});

test('pity counter resets to 0 immediately after a genuinely new hero is granted', () => {
  const m = makeManager();
  m._inv.addItem('token_normal', 10);
  let resetSeen = false;
  for (let i = 0; i < 10; i++) {
    const r = m.rollToken('normal');
    if (r.outcome === 'hero' && !r.isDuplicate) {
      assert.equal(m._pity.normal, 0);
      resetSeen = true;
      break;
    }
  }
  assert.ok(resetSeen, 'expected a genuine new-hero grant within 10 pulls');
});

test('pity counter increments per pull below hard pity', () => {
  const m = makeManager();
  m._recruitHero('warlord');
  m._recruitHero('archsorceress'); // both legendary heroes owned: no new-hero grant is possible
  m._inv.addItem('token_legendary', 1);
  m.rollToken('legendary');
  assert.equal(m._pity.legendary, 1);
});

test('stage-2 shard floor guarantees a Hero Shard every N pulls once the roster is complete', () => {
  const m = makeManager();
  for (const id of Object.keys(m.getRosterWithState().reduce((acc, h) => { acc[h.id] = true; return acc; }, {}))) {
    m._recruitHero(id);
  }
  assert.ok(m.rosterComplete('normal'));

  m._inv.addItem('token_normal', 10);
  let sawGuaranteedShard = false;
  for (let i = 0; i < 10; i++) {
    const r = m.rollToken('normal');
    if (i === 9) {
      assert.equal(r.outcome, 'shard');
      sawGuaranteedShard = true;
    }
  }
  assert.ok(sawGuaranteedShard);
});

test('stage-2 shard floor triggers per-tier: a completed normal tier gets shard-floor pulls even with epic tier incomplete', () => {
  const m = makeManager();
  m._recruitHero('kaelenthorne');
  m._recruitHero('shadowblade');
  assert.ok(m.rosterComplete('normal'));
  assert.equal(m.rosterComplete('epic'), false);

  m._inv.addItem('token_normal', 10);
  let sawGuaranteedShard = false;
  for (let i = 0; i < 10; i++) {
    const r = m.rollToken('normal');
    if (i === 9) {
      assert.equal(r.outcome, 'shard');
      sawGuaranteedShard = true;
    }
  }
  assert.ok(sawGuaranteedShard, 'expected the completed normal tier to use stage-2 shard-floor logic despite epic tier being incomplete');
});

// ── Task 8: fragments→shard unlock, tier-shard exchange, maxed overflow ──

test('N fragments convert to one hero shard by tier', () => {
  const m = makeManager();
  m._inv.addItem('fragment_shadowblade', 8);
  const r = m.convertFragments('shadowblade');
  assert.equal(r.success, true);
  assert.equal(m._inv.getQuantity('shard_shadowblade'), 1);
  assert.equal(m._inv.getQuantity('fragment_shadowblade'), 0);
});

test('convertFragments fails without enough fragments for the hero tier', () => {
  const m = makeManager();
  m._inv.addItem('fragment_shadowblade', 7);
  const r = m.convertFragments('shadowblade');
  assert.equal(r.success, false);
  assert.equal(m._inv.getQuantity('fragment_shadowblade'), 7);
});

test('unlock consumes SHARDS_TO_UNLOCK and adds the hero to the roster', () => {
  const m = makeManager();
  m._inv.addItem('shard_shadowblade', 4);
  const r = m.unlockFromShards('shadowblade');
  assert.equal(r.success, true);
  assert.equal(m.isOwned('shadowblade'), true);
  assert.equal(m._inv.getQuantity('shard_shadowblade'), 0);
});

test('unlockFromShards fails if the hero is already owned', () => {
  const m = makeManager();
  m._recruitHero('shadowblade');
  m._inv.addItem('shard_shadowblade', 4);
  const r = m.unlockFromShards('shadowblade');
  assert.equal(r.success, false);
});

test('unlockFromShards fails without enough shards for the hero tier', () => {
  const m = makeManager();
  m._inv.addItem('shard_shadowblade', 3);
  const r = m.unlockFromShards('shadowblade');
  assert.equal(r.success, false);
});

test('tier-shard exchange is 3:1 and cannot be laundered net-positive', () => {
  const m = makeManager();
  m._inv.addItem('tier_shard_normal', 3);
  const r = m.exchangeTierShards('normal', 'shadowblade', 1);
  assert.equal(r.success, true);
  assert.equal(m._inv.getQuantity('shard_shadowblade'), 1);
  assert.equal(m._inv.getQuantity('tier_shard_normal'), 0);
  // overflow refund is only 2 → round-trip is lossy
});

test('exchangeTierShards fails without enough tier shards for the requested count', () => {
  const m = makeManager();
  m._inv.addItem('tier_shard_normal', 2);
  const r = m.exchangeTierShards('normal', 'shadowblade', 1);
  assert.equal(r.success, false);
  assert.equal(m._inv.getQuantity('tier_shard_normal'), 2);
});

test('exchangeTierShards scales linearly for count > 1', () => {
  const m = makeManager();
  m._inv.addItem('tier_shard_normal', 6);
  const r = m.exchangeTierShards('normal', 'shadowblade', 2);
  assert.equal(r.success, true);
  assert.equal(m._inv.getQuantity('shard_shadowblade'), 2);
  assert.equal(m._inv.getQuantity('tier_shard_normal'), 0);
});

test('a shard destined for a fully-maxed (10-star) hero overflows to 2 tier shards instead', () => {
  const m = makeManager();
  m._recruitHero('kaelenthorne');
  const hero = m._owned.get('kaelenthorne');
  hero.stars = 10;
  const r = m._grantHeroCurrency('shard', 'kaelenthorne', 'normal', true);
  assert.equal(r.outcome, 'overflow');
  assert.equal(m._inv.getQuantity('shard_kaelenthorne'), 0);
  assert.equal(m._inv.getQuantity('tier_shard_normal'), 2);
});

test('the stage-2 shard floor grant routes to tier-shard overflow for a maxed target', () => {
  const m = makeManager();
  const heroIds = Object.keys(m.getRosterWithState().reduce((acc, h) => { acc[h.id] = true; return acc; }, {}));
  for (const id of heroIds) m._recruitHero(id);
  for (const id of heroIds) {
    const cfg = m._owned.get(id);
    if (cfg) cfg.stars = 10;
  }
  assert.ok(m.rosterComplete('normal'));

  m._inv.addItem('token_normal', 10);
  let sawOverflow = false;
  for (let i = 0; i < 10; i++) {
    const r = m.rollToken('normal');
    if (i === 9) {
      assert.equal(r.outcome, 'overflow');
      sawOverflow = true;
    }
  }
  assert.ok(sawOverflow);
});

test('convertFragments on a maxed hero (10 stars) overflows to tier shards instead of granting a dead shard', () => {
  const m = makeManager();
  m._recruitHero('shadowblade');
  const hero = m._owned.get('shadowblade');
  hero.stars = 10;
  m._inv.addItem('fragment_shadowblade', 8);
  const r = m.convertFragments('shadowblade');
  assert.equal(r.success, true);
  assert.equal(r.outcome, 'overflow');
  assert.equal(m._inv.getQuantity('shard_shadowblade'), 0);
  assert.equal(m._inv.getQuantity('fragment_shadowblade'), 0);
  assert.equal(m._inv.getQuantity('tier_shard_normal'), 2);
});

test('exchangeTierShards on a maxed hero (10 stars) refunds overflow instead of granting a dead shard', () => {
  const m = makeManager();
  m._recruitHero('kaelenthorne');
  const hero = m._owned.get('kaelenthorne');
  hero.stars = 10;
  m._inv.addItem('tier_shard_normal', 3);
  const r = m.exchangeTierShards('normal', 'kaelenthorne', 1);
  assert.equal(r.success, true);
  assert.equal(r.outcome, 'overflow');
  assert.equal(m._inv.getQuantity('shard_kaelenthorne'), 0);
  assert.equal(m._inv.getQuantity('tier_shard_normal'), 2);
});

// ── Review finding 1: the old fragmentsToSummon bypass must be gone ──

test('summonFromFragments no longer exists as a live shortcut around the shard economy', () => {
  const m = makeManager();
  assert.equal(typeof m.summonFromFragments, 'undefined');
  assert.equal(typeof m._recruitment.summonFromFragments, 'undefined');
});
