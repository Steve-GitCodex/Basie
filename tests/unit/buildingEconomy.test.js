import test from 'node:test';
import assert from 'node:assert/strict';

import { buildingEconomy } from '../../js/systems/building/buildingEconomy.js';
import { BUILDINGS_CONFIG } from '../../js/entities/GAME_DATA.js';

test('computeStorageCaps applies storageCapacityBonus to finite caps', () => {
  const buildings = new Map([
    ['townhall', [{ instanceId: 'townhall_0', level: 1 }]],
  ]);
  const noBonus   = buildingEconomy.computeStorageCaps(buildings, {});
  const withBonus = buildingEconomy.computeStorageCaps(buildings, { storageCapacityBonus: 0.2 });
  assert.ok(withBonus.caps.wood > noBonus.caps.wood);
});

test('a stationed hero production bonus scales only its own instance, once', () => {
  const buildings = new Map([
    ['mine', [
      { instanceId: 'mine_0', level: 1 },
      { instanceId: 'mine_1', level: 1 },
    ]],
  ]);
  const ctx = {
    getPopulation:   () => ({ current: 0, cap: 0 }),
    getHeroInstanceBonus: (iid) => iid === 'mine_0' ? 0.15 : 0,
  };
  const [withHero, withoutHero] = buildingEconomy.computeActiveRates(buildings, ctx);

  assert.equal(withoutHero.effects.iron, 0.5);
  assert.equal(withHero.effects.iron, 0.5 * 1.15);
});

test('a stationed hero multiplies that instance output by the §I bonus', () => {
  const buildings = new Map([['farm', [{ instanceId: 'farm_0', level: 1 }]]]);
  const ctx = {
    getPopulation: () => ({ current: 10, cap: 10 }),
    getHeroInstanceBonus: (iid) => (iid === 'farm_0' ? 0.15 : 0),
  };
  const [entry] = buildingEconomy.computeActiveRates(buildings, ctx);
  const baseFood = BUILDINGS_CONFIG.farm.effects.food;
  assert.ok(Math.abs(entry.effects.food - baseFood * 1.15) < 1e-9);
});

test('a hero stationed at a bank gets the bonus AND pop-scaling (regression)', () => {
  const buildings = new Map([['bank', [{ instanceId: 'bank_0', level: 1 }]]]);
  const ctx = {
    getPopulation: () => ({ current: 5, cap: 10 }),
    getHeroInstanceBonus: () => 0.15,
  };
  const [entry] = buildingEconomy.computeActiveRates(buildings, ctx);
  const baseMoney = BUILDINGS_CONFIG.bank.effects.money;
  assert.ok(Math.abs(entry.effects.money - baseMoney * 0.5 * 1.15) < 1e-9,
    'bank pop-scaling and the hero bonus compose; they are no longer an else-if');
});

test('a bank with a stationed kaelenthorne composes pop-scaling and his gold_production aura bonus', () => {
  const buildings = new Map([['bank', [{ instanceId: 'bank_0', level: 1 }]]]);
  const popOnlyCtx = { getPopulation: () => ({ current: 5, cap: 10 }) };
  const heroOnlyCtx = {
    getPopulation: () => ({ current: 0, cap: 0 }),
    getHeroInstanceBonus: (iid) => (iid === 'bank_0' ? 0.15 : 0),
  };
  const combinedCtx = {
    getPopulation: () => ({ current: 5, cap: 10 }),
    getHeroInstanceBonus: (iid) => (iid === 'bank_0' ? 0.15 : 0),
  };

  const [popOnly]   = buildingEconomy.computeActiveRates(buildings, popOnlyCtx);
  const [heroOnly]  = buildingEconomy.computeActiveRates(buildings, heroOnlyCtx);
  const [combined]  = buildingEconomy.computeActiveRates(buildings, combinedCtx);

  assert.ok(combined.effects.money > popOnly.effects.money,
    'combined rate must exceed pop-scaling alone');
  assert.ok(combined.effects.money > heroOnly.effects.money,
    'combined rate must exceed the hero bonus alone');
});

test('computeActiveRates works when getHeroInstanceBonus is absent', () => {
  const buildings = new Map([['farm', [{ instanceId: 'farm_0', level: 1 }]]]);
  const ctx = { getPopulation: () => ({ current: 10, cap: 10 }) };
  const [entry] = buildingEconomy.computeActiveRates(buildings, ctx);
  assert.equal(entry.effects.food, BUILDINGS_CONFIG.farm.effects.food);
});

test('heroStorageBonus 0.2 raises finite caps by 20% and leaves diamond Infinity', () => {
  const buildings = new Map([
    ['townhall', [{ instanceId: 'townhall_0', level: 1 }]],
  ]);
  const base = buildingEconomy.computeStorageCaps(buildings, {});
  const boosted = buildingEconomy.computeStorageCaps(buildings, {}, 0.2);
  assert.ok(base.caps.wood > 0);
  assert.equal(boosted.caps.wood, Math.floor(base.caps.wood * 1.2));
  assert.equal(boosted.caps.diamond, Infinity);
});

test('a storehouse past the end of its storageCap arrays throws instead of contributing 0', () => {
  const pastEnd = BUILDINGS_CONFIG.storehouse.storageCap.wood.length;
  const buildings = new Map([['storehouse', [{ instanceId: 'storehouse_0', level: pastEnd }]]]);
  assert.throws(
    () => buildingEconomy.computeStorageCaps(buildings, {}),
    new RegExp(`storehouse\.storageCap\.wood: no entry for level ${pastEnd}`),
  );
});
