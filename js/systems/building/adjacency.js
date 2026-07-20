/**
 * adjacency.js
 * Layout-as-gameplay (ADR 0022, Phase C): buildings that sit near each other grant
 * small percentage bonuses. Pure over the placement rects — no state, no events.
 *
 * Two sources: clustering (same category near each other) and curated pairs
 * (thematic neighbours). Production instances turn their bonus into extra output;
 * military instances pool theirs into a training-speed cut.
 */
import { BUILDINGS_CONFIG } from '../../entities/GAME_DATA.js';

/** Cells of slack between two footprints that still counts as adjacent — one tile, so a connector road may pass between. */
const PAD_CELLS = 2;

const CLUSTER_PER_NEIGHBOUR = 0.05;
const CLUSTER_CAP = 0.20;
const PAIR_CAP = 0.15;
const TOTAL_CAP = 0.30;

/** Categories whose members reinforce each other by clustering. */
const CLUSTERING_CATEGORIES = new Set(['production', 'military', 'population']);

/** Curated thematic neighbours; symmetric, both sides receive `bonus`. */
export const ADJACENCY_PAIRS = [
  { a: 'house',      b: 'cafeteria',  bonus: 0.08, label: 'Fed Quarters' },
  { a: 'farm',       b: 'well',       bonus: 0.06, label: 'Irrigation' },
  { a: 'lumbermill', b: 'workshop',   bonus: 0.06, label: 'Timber Yard' },
  { a: 'mine',       b: 'storehouse', bonus: 0.06, label: 'Ore Depot' },
  { a: 'barracks',   b: 'rallypoint', bonus: 0.06, label: 'Muster Ground' },
];

const MILITARY_TRAIN_CAP = 0.25;

export function buildingIdOfInstance(instanceId) {
  return instanceId.replace(/_\d+$/, '');
}

function categoryOf(buildingId) {
  return BUILDINGS_CONFIG[buildingId]?.category ?? 'core';
}

function pairBonusFor(idA, idB) {
  return ADJACENCY_PAIRS.find(p => (p.a === idA && p.b === idB) || (p.a === idB && p.b === idA)) ?? null;
}

/** Rect gap on each axis; adjacent when both gaps fit inside PAD_CELLS. */
export function areNeighbours(r1, r2, pad = PAD_CELLS) {
  const gapX = Math.max(r1.cx - (r2.cx + r2.w), r2.cx - (r1.cx + r1.w));
  const gapY = Math.max(r1.cy - (r2.cy + r2.h), r2.cy - (r1.cy + r1.h));
  return gapX <= pad && gapY <= pad;
}

/**
 * @param {Array<{instanceId:string, cx:number, cy:number, w:number, h:number}>} rects placed, built instances only
 * @returns {Map<string, {bonus:number, cluster:number, sameCount:number, pairs:{withId:string, label:string, bonus:number}[]}>}
 */
export function computeAdjacency(rects) {
  const result = new Map();
  for (const r of rects) {
    result.set(r.instanceId, { bonus: 0, cluster: 0, sameCount: 0, pairs: [] });
  }

  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (!areNeighbours(a, b)) continue;

      const idA = buildingIdOfInstance(a.instanceId);
      const idB = buildingIdOfInstance(b.instanceId);
      const catA = categoryOf(idA), catB = categoryOf(idB);

      if (catA === catB && CLUSTERING_CATEGORIES.has(catA)) {
        result.get(a.instanceId).sameCount++;
        result.get(b.instanceId).sameCount++;
      }

      const pair = pairBonusFor(idA, idB);
      if (pair) {
        result.get(a.instanceId).pairs.push({ withId: idB, label: pair.label, bonus: pair.bonus });
        result.get(b.instanceId).pairs.push({ withId: idA, label: pair.label, bonus: pair.bonus });
      }
    }
  }

  for (const entry of result.values()) {
    entry.cluster = Math.min(CLUSTER_CAP, entry.sameCount * CLUSTER_PER_NEIGHBOUR);
    const pairTotal = Math.min(PAIR_CAP, entry.pairs.reduce((s, p) => s + p.bonus, 0));
    entry.bonus = Math.min(TOTAL_CAP, entry.cluster + pairTotal);
  }
  return result;
}

/** Mean bonus across military instances → training-time multiplier (1 = no cut). */
export function trainTimeMultiplier(adjacency) {
  let total = 0, count = 0;
  for (const [instanceId, entry] of adjacency) {
    if (categoryOf(buildingIdOfInstance(instanceId)) !== 'military') continue;
    total += entry.bonus;
    count++;
  }
  if (count === 0) return 1;
  return 1 - Math.min(MILITARY_TRAIN_CAP, total / count);
}

/** Sum of production-instance bonuses — drives the migration "bonus discovered" toast. */
export function productionBonusTotal(adjacency) {
  let total = 0;
  for (const [instanceId, entry] of adjacency) {
    if (categoryOf(buildingIdOfInstance(instanceId)) !== 'production') continue;
    total += entry.bonus;
  }
  return total;
}
