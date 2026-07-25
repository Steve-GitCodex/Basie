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
  const map = m.getBuildingProductionBonusMap();
  assert.ok(map.iron > 0);
});

test('non-gold production stats are now wired (e.g. food at farm)', () => {
  const m = makeManager();
  m._recruitHero('kaelenthorne'); // buildingBonus food_production/farm
  m.assignHeroToBuilding('kaelenthorne', 'farm_0');
  const map = m.getBuildingProductionBonusMap();
  assert.ok(map.food > 0);
  assert.equal(map.money ?? 0, 0);
});

test('production bonus scales with level per the §I formula', () => {
  const m = makeManager();
  m._recruitHero('shadowblade');
  m.assignHeroToBuilding('shadowblade', 'mine_0');
  const hero = m._owned.get('shadowblade');
  hero.level = 21;

  const map = m.getBuildingProductionBonusMap();
  const expected = PROD_BONUS_CONFIG.base.resourceOutput * (1 + PROD_BONUS_CONFIG.levelScalePerLevel * 20);
  assert.ok(Math.abs(map.iron - expected) < 1e-9);
});

test('production bonus scales with stars per the §I formula', () => {
  const m = makeManager();
  m._recruitHero('shadowblade');
  m.assignHeroToBuilding('shadowblade', 'mine_0');
  const hero = m._owned.get('shadowblade');
  hero.stars = 5;

  const map = m.getBuildingProductionBonusMap();
  const expected = PROD_BONUS_CONFIG.base.resourceOutput * (1 + PROD_BONUS_CONFIG.starBonusPerStar * 5);
  assert.ok(Math.abs(map.iron - expected) < 1e-9);
});

test('training_speed and research_speed dev heroes wire to their non-resource effect keys', () => {
  const m = makeManager();
  m._recruitHero('warlord');
  m._recruitHero('archsorceress');
  m.assignHeroToBuilding('warlord', 'barracks_0');
  m.assignHeroToBuilding('archsorceress', 'workshop_0');

  const map = m.getBuildingProductionBonusMap();
  assert.ok(map.trainingSpeed > 0);
  assert.ok(map.researchSpeed > 0);
});

test('a hero stationed off their configured building type contributes nothing', () => {
  const m = makeManager();
  m._recruitHero('kaelenthorne');
  m.assignHeroToBuilding('kaelenthorne', 'quarry_0');
  const map = m.getBuildingProductionBonusMap();
  assert.equal(map.food ?? 0, 0);
  assert.equal(map.stone ?? 0, 0);
});
