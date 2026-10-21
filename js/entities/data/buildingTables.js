import { ERA_HQ, ERA_MONEY_CAP, POST_ERA_MONEY_GROWTH, HQ_MAX, eraNumber } from './buildingCurve.js';
import { UNITS_CONFIG, UNIT_TIER_REQUIREMENTS } from './units.js';

export const STORAGE_GROWTH_BANDS = [[20, 1.40], [30, 1.25]];

export const BARRACKS_SLOT_CAPACITY = [
  200, 500, 650, 800, 1000, 1200, 1350, 1550, 1700, 1900,
  2100, 2300, 2550, 2750, 3000, 3350, 3650, 4000, 4250, 4500,
  4750, 5000, 5400, 5750, 6150, 6500, 6900, 7250, 7650, 8000,
];

const RALLY_MARCH_SLOTS = [2, 2, 3, 3, 3, 4, 4, 4, 4, 5];
const RALLY_SPEED_STEP = 0.05;

export const RALLY_STATS = RALLY_MARCH_SLOTS.map((marchSlots, i) => ({
  marchSlots,
  speedBonus: Math.round(i * RALLY_SPEED_STEP * 100) / 100,
}));

const TRAINING_BREAKPOINTS = [
  { fromLevel: 1, concurrentSlots: 1, trainTimeMultiplier: 1.0 },
  { fromLevel: 4, concurrentSlots: 2, trainTimeMultiplier: 0.9 },
  { fromLevel: 12, concurrentSlots: 3, trainTimeMultiplier: 0.8 },
  { fromLevel: 22, concurrentSlots: 4, trainTimeMultiplier: 0.7 },
];

const BATCH_SIZE_PER_LEVEL = 25;

export function growTable(baseRow, toLevel, bands) {
  const row = baseRow.slice();
  let exact = row[row.length - 1];
  for (let level = row.length; level <= toLevel; level++) {
    const [, rate] = bands.find(([upTo]) => level <= upTo) ?? bands[bands.length - 1];
    exact *= rate;
    row.push(Math.round(exact));
  }
  return row;
}

function maxTierAtLevel(unitId, level) {
  const tiers = UNIT_TIER_REQUIREMENTS[unitId] ?? {};
  const open = Object.entries(tiers).filter(([, req]) => req.minBuildingLevel <= level).map(([tier]) => Number(tier));
  return Math.max(1, ...open);
}

export function TRAINING_SLOTS(maxLevel, hallId) {
  const unit = Object.values(UNITS_CONFIG).find(u => u.buildingId === hallId);
  return Array.from({ length: maxLevel }, (_, i) => {
    const level = i + 1;
    const step = TRAINING_BREAKPOINTS.filter(b => b.fromLevel <= level).pop();
    return {
      concurrentSlots: step.concurrentSlots,
      trainTimeMultiplier: step.trainTimeMultiplier,
      maxTrainableTier: maxTierAtLevel(unit.id, level),
      maxBatchSize: BATCH_SIZE_PER_LEVEL * level,
    };
  });
}

export function eraMoneyTable(toLevel) {
  const table = [0];
  for (let level = 1; level <= toLevel; level++) {
    const era = eraNumber(level) - 1;
    const last = ERA_HQ.length - 1;
    if (era >= last) {
      table.push(Math.round(ERA_MONEY_CAP[last] * POST_ERA_MONEY_GROWTH ** (level - ERA_HQ[last])));
      continue;
    }
    const span = ERA_HQ[era + 1] - ERA_HQ[era];
    const ratio = ERA_MONEY_CAP[era + 1] / ERA_MONEY_CAP[era];
    table.push(Math.round(ERA_MONEY_CAP[era] * ratio ** ((level - ERA_HQ[era]) / span)));
  }
  return table;
}

export function scaleTable(table, factor) {
  return table.map(v => Math.round(v * factor));
}

const LEGACY_CAFETERIA_FOR_HOUSE_BY_ERA = [1, 1, 2, 2, 3, 3, 5, 5, 7, 7];
const CAFETERIA_FOR_HOUSE_BY_ERA = LEGACY_CAFETERIA_FOR_HOUSE_BY_ERA.map(k => ERA_HQ[k - 1]);

export function houseCafeteriaLadder(maxLevel) {
  const ladder = {};
  for (let level = 1; level <= maxLevel; level++) {
    const needed = CAFETERIA_FOR_HOUSE_BY_ERA[Math.min(eraNumber(level), CAFETERIA_FOR_HOUSE_BY_ERA.length) - 1];
    if (needed > 1) ladder[level] = { cafeteria: needed };
  }
  return ladder;
}

const BANK_POPULATION_BASE = [0, 0, 10, 20, 50, 100, 180, 260, 300, 340, 380];
const BANK_POPULATION_AT_MAX = 1000;

export function bankPopulationLadder(maxLevel) {
  const rate = (BANK_POPULATION_AT_MAX / BANK_POPULATION_BASE[BANK_POPULATION_BASE.length - 1]) ** (1 / (maxLevel - BANK_POPULATION_BASE.length + 1));
  const column = growTable(BANK_POPULATION_BASE, maxLevel, [[maxLevel, rate]]);
  const ladder = {};
  for (let level = 2; level <= maxLevel; level++) {
    ladder[level] = { population: level < BANK_POPULATION_BASE.length ? column[level] : Math.round(column[level] / 10) * 10 };
  }
  return ladder;
}

export const CAFETERIA_FOOD_BASE = [0, 10800, 21600, 32400, 39000, 43200, 51600, 54000, 62000];
const CAFETERIA_RESERVE_AT_MAX = 186000;

export function cafeteriaCapacity(maxLevel) {
  const rate = (CAFETERIA_RESERVE_AT_MAX / CAFETERIA_FOOD_BASE[CAFETERIA_FOOD_BASE.length - 1]) ** (1 / (maxLevel - CAFETERIA_FOOD_BASE.length + 1));
  return growTable(CAFETERIA_FOOD_BASE, maxLevel, [[maxLevel, rate]]);
}

const BENEFIT_PRECISION = 1e4;
const roundBenefit = v => Math.round(v * BENEFIT_PRECISION) / BENEFIT_PRECISION;
const mapRow = (row, fn) => Object.fromEntries(Object.entries(row).map(([key, v]) => [key, fn(v, key)]));

function benefitAnchors(benefitsByEra, capstoneRatio) {
  if (benefitsByEra.length !== ERA_HQ.length) {
    throw new Error(`HQ benefits: ${benefitsByEra.length} era rows for ${ERA_HQ.length} ERA_HQ entries`);
  }
  const anchors = ERA_HQ.map((hq, i) => [hq, benefitsByEra[i]]);
  const [lastHq, lastRow] = anchors[anchors.length - 1];
  if (HQ_MAX > lastHq) anchors.push([HQ_MAX, mapRow(lastRow, v => v * capstoneRatio)]);
  return anchors;
}

function cumulativeBenefitsAt(anchors, level) {
  const upper = anchors.findIndex(([hq]) => hq >= level);
  const [hqB, rowB] = anchors[upper];
  if (hqB === level || upper === 0) return mapRow(rowB, roundBenefit);
  const [hqA, rowA] = anchors[upper - 1];
  const t = (level - hqA) / (hqB - hqA);
  return mapRow(rowB, (b, key) => roundBenefit(rowA[key] + (b - rowA[key]) * t));
}

export function hqUnlockTable(unlocksByLevel, benefitsByEra, capstoneRatio) {
  const anchors = benefitAnchors(benefitsByEra, capstoneRatio);
  const table = {};
  for (let level = 2; level <= HQ_MAX; level++) {
    const now = cumulativeBenefitsAt(anchors, level);
    const before = cumulativeBenefitsAt(anchors, level - 1);
    table[level] = {
      buildings: [], units: [], techs: [],
      ...unlocksByLevel[level],
      benefits: mapRow(now, (v, key) => roundBenefit(v - before[key])),
    };
  }
  return table;
}
