/**
 * buildingEconomy.js
 * Pure economy math derived from the building roster — storage/population caps
 * and per-instance production rates. No side effects: callers feed in the
 * `buildings` map and apply the returned values to the ResourceManager.
 *
 * Extracted from BuildingManager to keep the economy formulas testable and
 * portable to an authoritative server.
 */
import { BUILDINGS_CONFIG } from '../../entities/GAME_DATA.js';

/**
 * Sum storage/population/cafeteria-stock caps across every built instance and
 * apply the research storage bonus.
 * @param {Map<string, {instanceId:string, level:number}[]>} buildings
 * @param {{ storageCapacityBonus?: number }} [techBonuses]
 * @returns {{ caps: Object, popCap: number, foodStoreCap: number, waterStoreCap: number }}
 */
function computeStorageCaps(buildings, techBonuses = {}) {
  // Base is zero — storageCap arrays on each building provide the full cap at their level
  const caps = { wood: 0, stone: 0, iron: 0, food: 0, water: 0, diamond: Infinity, money: 0 };
  let popCap       = 0;
  let foodStoreCap = 0;  // total cafeteria food-stock capacity
  let waterStoreCap = 0; // total cafeteria water-stock capacity

  for (const [id, instances] of buildings) {
    const cfg = BUILDINGS_CONFIG[id];
    if (cfg?.storageCap) {
      for (const inst of instances) {
        if ((inst.level ?? 0) <= 0) continue;
        for (const [res, perLevel] of Object.entries(cfg.storageCap)) {
          const contrib = Array.isArray(perLevel)
            ? (perLevel[inst.level] ?? 0)
            : perLevel * inst.level;
          caps[res] = (caps[res] ?? 0) + contrib;
        }
      }
    }

    // Population cap from houses — use config-driven value, hard ceiling 1000
    if (id === 'house') {
      const popPerLevel = cfg.populationCapacityPerLevel ?? 10;
      for (const inst of instances) {
        popCap += (inst.level ?? 0) * popPerLevel;
      }
    }

    // Cafeteria food/water stock capacity — use config-driven values
    if (id === 'cafeteria') {
      const fpArr = cfg.foodCapacityPerLevel  ?? 200;
      const wpArr = cfg.waterCapacityPerLevel ?? 200;
      for (const inst of instances) {
        const lv = inst.level ?? 0;
        foodStoreCap  += Array.isArray(fpArr) ? (fpArr[lv] ?? 0) : lv * fpArr;
        waterStoreCap += Array.isArray(wpArr) ? (wpArr[lv] ?? 0) : lv * wpArr;
      }
    }
  }

  // Apply storageCapacityBonus from tech research (e.g. infrastructure tech)
  const bonus = techBonuses.storageCapacityBonus;
  const finalCaps = {};
  for (const [res, cap] of Object.entries(caps)) {
    finalCaps[res] = (isFinite(cap) && bonus) ? Math.floor(cap * (1 + bonus)) : cap;
  }

  return {
    caps: finalCaps,
    popCap: Math.min(popCap, 1000),
    foodStoreCap,
    waterStoreCap,
  };
}

/**
 * Build the list of active production effects (with bank pop-scaling and
 * stationed-hero bonuses) consumed by ResourceManager.recalculateRates().
 * @param {Map<string, {instanceId:string, level:number}[]>} buildings
 * @param {{ getPopulation():{current:number,cap:number}, getHeroInstanceBonus?:(instanceId:string)=>number, getAdjacencyBonus?:(instanceId:string)=>number }} ctx
 * @returns {{ effects: Object, level: number }[]}
 */
function computeActiveRates(buildings, ctx) {
  const active = [];
  const pop = ctx.getPopulation();
  const bankEfficiency = pop.cap > 0 ? Math.min(pop.current / pop.cap, 1) : 0;

  for (const [id, instances] of buildings) {
    const cfg = BUILDINGS_CONFIG[id];
    if (!cfg?.effects) continue;
    for (const inst of instances) {
      if ((inst.level ?? 0) <= 0) continue;

      let scaledEffects = cfg.effects;

      if (id === 'bank') {
        scaledEffects = {};
        for (const [res, val] of Object.entries(cfg.effects)) {
          scaledEffects[res] = val * bankEfficiency;
        }
      }

      const heroBonus = ctx.getHeroInstanceBonus?.(inst.instanceId) ?? 0;
      if (heroBonus > 0) {
        const boosted = {};
        for (const [res, val] of Object.entries(scaledEffects)) boosted[res] = val * (1 + heroBonus);
        scaledEffects = boosted;
      }

      const adjacency = ctx.getAdjacencyBonus?.(inst.instanceId) ?? 0;
      if (adjacency > 0) {
        const boosted = {};
        for (const [res, val] of Object.entries(scaledEffects)) boosted[res] = val * (1 + adjacency);
        scaledEffects = boosted;
      }

      active.push({ effects: scaledEffects, level: inst.level });
    }
  }
  return active;
}

export const buildingEconomy = { computeStorageCaps, computeActiveRates };
