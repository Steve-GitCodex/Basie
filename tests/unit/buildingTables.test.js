import test from 'node:test';
import assert from 'node:assert/strict';

import {
  growTable, STORAGE_GROWTH_BANDS, BARRACKS_SLOT_CAPACITY, RALLY_STATS, TRAINING_SLOTS,
  eraMoneyTable, houseCafeteriaLadder, bankPopulationLadder, cafeteriaCapacity,
} from '../../js/entities/data/buildingTables.js';
import { ERA_HQ, ERA_MONEY_CAP } from '../../js/entities/data/buildingCurve.js';
import { UNIT_TIER_REQUIREMENTS } from '../../js/entities/data/units.js';
import { BUILDINGS_CONFIG, POPULATION_MAX, HQ_MAX } from '../../js/entities/GAME_DATA.js';

test('growTable extends an index 0..10 row geometrically by band', () => {
  const row = growTable([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 30, STORAGE_GROWTH_BANDS);
  assert.equal(row.length, 31);
  assert.ok(Math.abs(row[20] - 10 * 1.4 ** 10) <= 1);
  assert.ok(Math.abs(row[30] - 10 * 1.4 ** 10 * 1.25 ** 10) <= 2);
  assert.deepEqual(row.slice(0, 11), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('BARRACKS_SLOT_CAPACITY has 30 ascending values ending at 8000', () => {
  assert.equal(BARRACKS_SLOT_CAPACITY.length, BUILDINGS_CONFIG.barracks.maxLevel);
  assert.equal(BARRACKS_SLOT_CAPACITY[0], 200);
  assert.equal(BARRACKS_SLOT_CAPACITY[29], 8000);
  for (let i = 1; i < BARRACKS_SLOT_CAPACITY.length; i++) assert.ok(BARRACKS_SLOT_CAPACITY[i] > BARRACKS_SLOT_CAPACITY[i - 1], `L${i + 1}`);
});

test('RALLY_STATS: 10 rows, marches 2/3/4/5 at Lv 1/3/6/10, speed 0 to +45%', () => {
  assert.equal(RALLY_STATS.length, 10);
  assert.deepEqual(RALLY_STATS.map(r => r.marchSlots), [2, 2, 3, 3, 3, 4, 4, 4, 4, 5]);
  assert.equal(RALLY_STATS[0].speedBonus, 0);
  assert.equal(RALLY_STATS[9].speedBonus, 0.45);
  assert.equal(RALLY_STATS[5].speedBonus, 0.25);
});

const HALL_MAX = BUILDINGS_CONFIG.infantryhall.maxLevel;
const { house: HOUSE, bank: BANK, cafeteria: CAF } = BUILDINGS_CONFIG;

test('TRAINING_SLOTS: concurrency 1/2/3/4 at hall Lv 1/4/12/22, batch 25 x L, time 1.0 to 0.7', () => {
  const slots = TRAINING_SLOTS(HALL_MAX, 'infantryhall');
  assert.equal(slots.length, HALL_MAX);
  const at = (lv) => slots[lv - 1];
  assert.deepEqual([1, 3, 4, 11, 12, 21, 22, HALL_MAX].map(lv => at(lv).concurrentSlots), [1, 1, 2, 2, 3, 3, 4, 4]);
  assert.deepEqual([1, 3, 4, 11, 12, 21, 22, HALL_MAX].map(lv => at(lv).trainTimeMultiplier), [1, 1, 0.9, 0.9, 0.8, 0.8, 0.7, 0.7]);
  slots.forEach((s, i) => assert.equal(s.maxBatchSize, 25 * (i + 1)));
});

test('TRAINING_SLOTS maxTrainableTier reads UNIT_TIER_REQUIREMENTS', () => {
  const slots = TRAINING_SLOTS(BUILDINGS_CONFIG.archeryrange.maxLevel, 'archeryrange');
  const tiers = UNIT_TIER_REQUIREMENTS.ranged;
  slots.forEach((s, i) => {
    const level = i + 1;
    const expected = Math.max(1, ...Object.entries(tiers).filter(([, r]) => r.minBuildingLevel <= level).map(([t]) => Number(t)));
    assert.equal(s.maxTrainableTier, expected, `L${level}`);
  });
});

test('eraMoneyTable pins ERA_MONEY_CAP at each ERA_HQ and ends at 8.8M at HQ 30', () => {
  const table = eraMoneyTable(HQ_MAX);
  assert.equal(table.length, HQ_MAX + 1);
  assert.equal(table[0], 0);
  ERA_HQ.forEach((hq, i) => assert.equal(table[hq], ERA_MONEY_CAP[i], `era ${i + 1}`));
  assert.ok(Math.abs(table[HQ_MAX] - 8.8e6) < 0.05e6);
  for (let i = 2; i <= HQ_MAX; i++) assert.ok(table[i] > table[i - 1]);
});

test('house cafeteria ladder is non-decreasing and bank population ladder reaches the cap', () => {
  const house = houseCafeteriaLadder(HOUSE.maxLevel);
  let prev = 0;
  for (let lv = 1; lv <= HOUSE.maxLevel; lv++) {
    const need = house[lv]?.cafeteria ?? 1;
    assert.ok(need >= prev, `house L${lv}`);
    prev = need;
  }
  const bank = bankPopulationLadder(BANK.maxLevel);
  assert.equal(Object.keys(bank).length, BANK.maxLevel - 1);
  assert.equal(bank[8].population, 300);
  assert.ok(bank[BANK.maxLevel].population <= POPULATION_MAX);
  for (let lv = 3; lv <= BANK.maxLevel; lv++) assert.ok(bank[lv].population > bank[lv - 1].population);
});

test('house cafeteria ladder maps old cafeteria levels 2/3/5/7 through ERA_HQ', () => {
  const ladder = houseCafeteriaLadder(HOUSE.maxLevel);
  const needs = [...new Set(Object.values(ladder).map(r => r.cafeteria))];
  const mapped = [2, 3, 5, 7].map(k => ERA_HQ[k - 1]);
  assert.deepEqual(mapped, [2, 4, 9, 15]);
  assert.deepEqual(needs, mapped.filter(v => needs.includes(v)));
  assert.deepEqual(needs, [2, 4, 9]);
});

test('cafeteria capacity covers every level up to maxLevel and keeps the old rows', () => {
  const cap = cafeteriaCapacity(CAF.maxLevel);
  assert.equal(cap.length, CAF.maxLevel + 1);
  assert.equal(cap[8], 62000);
  assert.deepEqual(cap, BUILDINGS_CONFIG.cafeteria.foodCapacityPerLevel);
});

test('POPULATION_MAX is six houses at max level', () => {
  const h = BUILDINGS_CONFIG.house;
  assert.equal(POPULATION_MAX, 6 * h.maxLevel * h.populationCapacityPerLevel);
});

test('hqUnlockTable refuses HQ benefit rows that do not match ERA_HQ', async () => {
  const { hqUnlockTable } = await import('../../js/entities/data/buildingTables.js');
  const { HQ_BENEFITS_BY_ERA } = await import('../../js/entities/data/buildings.js');
  assert.throws(() => hqUnlockTable({}, HQ_BENEFITS_BY_ERA.slice(0, -1), 1), /era rows for/);
  assert.throws(() => hqUnlockTable({}, [...HQ_BENEFITS_BY_ERA, HQ_BENEFITS_BY_ERA.at(-1)], 1), /era rows for/);
  assert.equal(HQ_BENEFITS_BY_ERA.length, ERA_HQ.length);
});

test('every ERA_HQ-indexed table matches ERA_HQ in length, and a missing money cap throws', async () => {
  const { assertEraMoneyCap } = await import('../../js/entities/data/buildingCurve.js');
  assert.equal(ERA_MONEY_CAP.length, ERA_HQ.length);
  assert.doesNotThrow(() => assertEraMoneyCap(ERA_HQ, ERA_MONEY_CAP));
  assert.throws(() => assertEraMoneyCap([...ERA_HQ, HQ_MAX], ERA_MONEY_CAP), /ERA_MONEY_CAP: \d+ values for \d+ ERA_HQ entries/);
  assert.ok(eraMoneyTable(HQ_MAX).every(Number.isFinite));
});
