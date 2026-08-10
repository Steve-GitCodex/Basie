import test from 'node:test';
import assert from 'node:assert/strict';

import { HeroManager } from '../../js/systems/HeroManager.js';
import { PROD_BONUS_CONFIG } from '../../js/entities/GAME_DATA.js';

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

function makeManager() {
  return new HeroManager(stubRM(), stubBM(), stubInv());
}

test('a dev hero stationed at their building boosts the matching resource', () => {
  const m = makeManager();
  m._recruitHero('shadowblade'); // buildingBonus iron_production/mine
  m.assignHeroToBuilding('shadowblade', 'mine_0');
  assert.ok(m.getHeroInstanceBonus('mine_0') > 0);
});

test('non-gold production stats are now wired (e.g. food at farm)', () => {
  const m = makeManager();
  m._recruitHero('kaelenthorne'); // buildingBonus food_production/farm
  m.assignHeroToBuilding('kaelenthorne', 'farm_0');
  assert.ok(m.getHeroInstanceBonus('farm_0') > 0);
  assert.equal(m.getHeroInstanceBonus('mine_0'), 0, 'an instance with no stationed hero gets nothing');
});

test('production bonus scales with level per the §I formula', () => {
  const m = makeManager();
  m._recruitHero('shadowblade');
  m.assignHeroToBuilding('shadowblade', 'mine_0');
  const hero = m._owned.get('shadowblade');
  hero.level = 21;

  const expected = PROD_BONUS_CONFIG.base.resourceOutput * (1 + PROD_BONUS_CONFIG.levelScalePerLevel * 20);
  assert.ok(Math.abs(m.getHeroInstanceBonus('mine_0') - expected) < 1e-9);
});

test('production bonus scales with stars per the §I formula', () => {
  const m = makeManager();
  m._recruitHero('shadowblade');
  m.assignHeroToBuilding('shadowblade', 'mine_0');
  const hero = m._owned.get('shadowblade');
  hero.stars = 5;

  const expected = PROD_BONUS_CONFIG.base.resourceOutput * (1 + PROD_BONUS_CONFIG.starBonusPerStar * 5);
  assert.ok(Math.abs(m.getHeroInstanceBonus('mine_0') - expected) < 1e-9);
});

test('training_speed and research_speed dev heroes wire to their non-resource effect keys', () => {
  const m = makeManager();
  m._recruitHero('warlord');
  m._recruitHero('archsorceress');
  m.assignHeroToBuilding('warlord', 'barracks_0');
  m.assignHeroToBuilding('archsorceress', 'workshop_0');

  const map = m.getHeroGlobalEffects();
  assert.ok(map.trainingSpeed > 0);
  assert.ok(map.researchSpeed > 0);
});

test('a hero stationed off their configured building type contributes no station bonus', () => {
  const m = makeManager();
  m._recruitHero('kaelenthorne');
  m.assignHeroToBuilding('kaelenthorne', 'quarry_0');
  assert.equal(m.getHeroInstanceBonus('quarry_0'), 0.10,
    'station term absent off-type; the 0.10 is scavenge, which pays wherever the hero is posted');
});

test('a hero with no production skills stationed off-type contributes nothing at all', () => {
  const m = makeManager();
  m._recruitHero('shadowblade');
  m.assignHeroToBuilding('shadowblade', 'quarry_0');
  assert.equal(m.getHeroInstanceBonus('quarry_0'), 0);
});

test('getInstanceBonus returns the per-instance resource bonus for the stationed hero', () => {
  const m = makeManager();
  m._recruitHero('kaelenthorne');
  m.assignHeroToBuilding('kaelenthorne', 'farm_0');
  assert.equal(m.getHeroInstanceBonus('farm_0'), 0.15 + 0.10);
  assert.equal(m.getHeroInstanceBonus('farm_1'), 0, 'a different instance gets nothing');
});

test('getInstanceBonus returns 0 when no hero is stationed at the instance', () => {
  const m = makeManager();
  assert.equal(m.getHeroInstanceBonus('farm_0'), 0);
});

test('getHeroGlobalEffects exposes only the non-resource speed effects', () => {
  const m = makeManager();
  m._recruitHero('warlord');
  m._recruitHero('kaelenthorne');
  m.assignHeroToBuilding('warlord', 'barracks_0');
  m.assignHeroToBuilding('kaelenthorne', 'farm_0');

  const map = m.getHeroGlobalEffects();
  assert.ok(Math.abs(map.trainingSpeed - 0.12) < 1e-9);
  assert.equal(map.food, undefined, 'resource effects never appear in the global map');
});

test('getBuildingProductionBonusMap is gone', () => {
  const m = makeManager();
  assert.equal(typeof m.getBuildingProductionBonusMap, 'undefined');
});
