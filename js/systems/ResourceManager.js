/**
 * ResourceManager.js
 * Manages all resource production, storage capacity, costs, and transactions.
 * Registered with the GameEngine and updated every tick.
 */
import { eventBus } from '../core/EventBus.js';
import { DIFFICULTY_MODIFIERS } from '../entities/GAME_DATA.js';
import { TUTORIAL_STEPS } from './TutorialManager.js';
import { BUILDINGS_CONFIG } from '../entities/data/buildings.js';
import { economicBonus } from './world/regionBuffs.js';

export class ResourceManager {
  constructor() {
    this.name = 'ResourceManager';
    
    const tutorialCosts = this._calculateTutorialRequirements();
    const startingCaps = this._calculateStartingCaps();
    
    // Base defaults with safety fallbacks — never go below these minimums
    const defaultResources = {
      wood:    { amount: Math.ceil(Math.max(tutorialCosts.wood, 500)),    perSec: 0, cap: startingCaps.wood    },
      stone:   { amount: Math.ceil(Math.max(tutorialCosts.stone, 300)),   perSec: 0, cap: startingCaps.stone   },
      iron:    { amount: Math.ceil(Math.max(tutorialCosts.iron, 50)),     perSec: 0, cap: startingCaps.iron    },
      food:    { amount: Math.ceil(Math.max(tutorialCosts.food, 50)),     perSec: 0, cap: startingCaps.food    },
      water:   { amount: Math.ceil(Math.max(tutorialCosts.water, 50)),    perSec: 0, cap: startingCaps.water   },
      diamond: { amount: 20,                                              perSec: 0, cap: Infinity             },
      money:   { amount: Math.ceil(Math.max(tutorialCosts.money, 500)),   perSec: 0, cap: startingCaps.money   },
    };
    
    this._resources = JSON.parse(JSON.stringify(defaultResources));
    this._uiDirty = true;
    this._techBonuses = {};
    this._heroManager = null;
    this._buildingManager = null;
    this._worldMapManager = null;
    this._lastActiveBuildings = [];
    /** Population is a pseudo-resource — not spent/earned like others. */
    this._population = { current: 0, cap: 0 };
    /** Cafeteria food-stock capacity (sum of all cafeteria instances). Updated by BuildingManager. */
    this._foodCapacity = 0;
    /** Cafeteria water-stock capacity (sum of all cafeteria instances). Updated by BuildingManager. */
    this._waterCapacity = 0;
    // VIP perk: stacking all-production bonus
    this._vipProductionBonus = 0;
    // Difficulty production rate multiplier (from DIFFICULTY_MODIFIERS.resourceRate)
    this._difficultyProductionMult = 1.0;
    // Current game mode — needed for sandbox 10× add()
    this._gameMode = 'campaign';
    // Stacked temporary modifiers keyed by "<id>:<resourceType>"
    // e.g. EventManager calls addModifier('iron', 2.0, 'double_iron_weekend')
    this._modifiers = new Map();
    eventBus.on('resources:bonusChanged', b => { this._techBonuses = b || {}; });
    eventBus.on('user:vipUpdate', ({ perks }) => {
      this._vipProductionBonus = perks?.productionBonus ?? 0;
      this._reapplyRates();
    });
    eventBus.on('settings:changed', s => {
      if (s.difficulty) {
        const mod = DIFFICULTY_MODIFIERS[s.difficulty] ?? DIFFICULTY_MODIFIERS.normal;
        this._difficultyProductionMult = mod.resourceRate;
        this._reapplyRates();
      }
    });
    eventBus.on('game:modeChanged', ({ mode }) => { this._gameMode = mode; });
  }

  /**
   * Wire BuildingManager after construction (for HQ-level benefits).
   * @param {import('../systems/BuildingManager.js').BuildingManager} bm
   */
  setBuildingManager(bm) {
    this._buildingManager = bm;
  }

  /**
   * Wire WorldMapManager after construction (for economic region buffs).
   * Captured "economic" regions/outposts/timed buffs raise base production of
   * their resource; re-run rates whenever the active buff set changes.
   * @param {import('./world/WorldMapManager.js').WorldMapManager} wm
   */
  setWorldMapManager(wm) {
    this._worldMapManager = wm;
    eventBus.on('world:buffsChanged',   () => this._reapplyRates());
    eventBus.on('world:regionCaptured', () => this._reapplyRates());
  }

  /**
   * Wire HeroManager after construction (avoids circular dependency).
   * @param {import('../systems/HeroManager.js').HeroManager} hm
   */
  setHeroManager(hm) {
    this._heroManager = hm;
    eventBus.on('buffs:changed',                () => this._reapplyRates());
    eventBus.on('hero:productionBonusChanged',   () => this._reapplyRates());
  }

  /** Re-run recalculateRates with the cached building list. */
  _reapplyRates() {
    if (this._lastActiveBuildings.length > 0) {
      this.recalculateRates(this._lastActiveBuildings);
    }
  }

  // =============================================
  // ENGINE SYSTEM INTERFACE
  // =============================================
  /**
   * Add a gain to a resource without ever reducing its current amount. A cap
   * drop (e.g. tech bonus lost mid-session) leaves an over-cap stockpile
   * intact and spendable — production just halts until it's spent back down.
   * @private
   */
  _addCapped(res, gained) {
    if (res.cap === Infinity) { res.amount += gained; return; }
    if (res.amount >= res.cap) return;
    res.amount = Math.min(res.amount + gained, res.cap);
  }

  /** Called every tick by GameEngine */
  update(dt) {
    let changed = false;
    for (const [key, res] of Object.entries(this._resources)) {
      if (res.perSec === 0) continue;
      const before = res.amount;
      this._addCapped(res, res.perSec * dt);
      if (res.amount !== before) changed = true;
    }
    if (changed) {
      this._uiDirty = true;
      eventBus.emit('resources:tick', this.getSnapshot());
    }
  }

  /** Mathematical offline catchup — accumulates production for the full elapsed period in O(resources). */
  applyOffline(elapsedSec) {
    for (const [, res] of Object.entries(this._resources)) {
      if (res.perSec === 0) continue;
      this._addCapped(res, res.perSec * elapsedSec);
    }
    this._uiDirty = true;
  }

  // =============================================
  // PRODUCTION RATE MANAGEMENT
  // =============================================
  /**
   * Recalculates total production rates from all buildings.
   * Called by BuildingManager whenever a building is added/upgraded.
   * @param {Array<{effects: object, level: number}>} activeBuildings
   */
  recalculateRates(activeBuildings) {
    this._lastActiveBuildings = activeBuildings ?? this._lastActiveBuildings;
    // Reset rates
    for (const key of Object.keys(this._resources)) {
      this._resources[key].perSec = 0;
    }
    for (const b of this._lastActiveBuildings) {
      if (!b.effects) continue;
      for (const [res, ratePerLevel] of Object.entries(b.effects)) {
        if (this._resources[res] !== undefined) {
          this._resources[res].perSec += ratePerLevel * b.level;
        }
      }
    }

    // Apply tech multipliers
    if (this._techBonuses.ironBonus)  this._resources.iron.perSec  *= (1 + this._techBonuses.ironBonus);
    if (this._techBonuses.woodBonus)  this._resources.wood.perSec  *= (1 + this._techBonuses.woodBonus);
    if (this._techBonuses.stoneBonus) this._resources.stone.perSec *= (1 + this._techBonuses.stoneBonus);
    if (this._techBonuses.waterBonus) this._resources.water.perSec *= (1 + this._techBonuses.waterBonus);

    // Apply economic region buffs (captured territory raises base production of its resource)
    if (this._worldMapManager) {
      const buffs = this._worldMapManager.activeBuffs();
      for (const key of Object.keys(this._resources)) {
        const bonus = economicBonus(buffs, key);
        if (bonus > 0) this._resources[key].perSec *= (1 + bonus);
      }
    }

    // Apply HQ-level production bonus (all resources)
    if (this._buildingManager) {
      const hqBonus = this._buildingManager.getHQBenefits().productionBonus;
      if (hqBonus > 0) {
        for (const key of Object.keys(this._resources)) {
          this._resources[key].perSec *= (1 + hqBonus);
        }
      }
    }

    // Stationed-hero production bonuses are applied per-instance in
    // buildingEconomy.computeActiveRates; re-applying them here would double-count.
    if (this._heroManager) {
      // Apply active production buff multiplier to ALL resource rates
      const buffMult = this._heroManager.getActiveProductionMultiplier();
      if (buffMult > 0) {
        for (const key of Object.keys(this._resources)) {
          this._resources[key].perSec *= (1 + buffMult);
        }
      }
    }

    // Apply VIP production bonus (tier 5: +5% all resources)
    if (this._vipProductionBonus > 0) {
      for (const key of Object.keys(this._resources)) {
        this._resources[key].perSec *= (1 + this._vipProductionBonus);
      }
    }

    // Apply difficulty production rate modifier (last — scales everything above)
    if (this._difficultyProductionMult !== 1.0) {
      for (const key of Object.keys(this._resources)) {
        this._resources[key].perSec *= this._difficultyProductionMult;
      }
    }

    // Apply stacked temporary modifiers (e.g. from EventManager)
    if (this._modifiers.size > 0) {
      for (const { resourceType, multiplier } of this._modifiers.values()) {
        if (this._resources[resourceType] !== undefined) {
          this._resources[resourceType].perSec *= multiplier;
        }
      }
    }

    eventBus.emit('resources:ratesChanged', this.getSnapshot());
  }

  // =============================================
  // TRANSACTIONS
  // =============================================
  /**
   * Check if the player can afford a cost map.
   * @param {object} cost e.g. { gold: 100, wood: 50 }
   * @returns {boolean}
   */
  canAfford(cost) {
    if (this._gameMode === 'sandbox') return true;
    for (const [key, amount] of Object.entries(cost)) {
      if ((this._resources[key]?.amount ?? 0) < amount) return false;
    }
    return true;
  }

  /**
   * Returns how many times a given cost map can be afforded with current resources.
   * @param {object} costMap e.g. { gold: 100, wood: 50 }
   * @returns {number}
   */
  maxAffordable(costMap) {
    let max = Infinity;
    for (const [res, amt] of Object.entries(costMap)) {
      const has = this._resources[res]?.amount ?? 0;
      max = Math.min(max, Math.floor(has / amt));
    }
    return max === Infinity ? 0 : max;
  }

  /**
   * Deduct resources if affordable. Returns success boolean.
   * @param {object} cost
   * @returns {boolean}
   */
  spend(cost) {
    if (this._gameMode === 'sandbox') {
      eventBus.emit('resources:spent', cost);
      this._uiDirty = true;
      return true;
    }
    if (!this.canAfford(cost)) return false;
    for (const [key, amount] of Object.entries(cost)) {
      this._resources[key].amount -= amount;
    }
    eventBus.emit('resources:spent', cost);
    this._uiDirty = true;
    return true;
  }

  /**
   * Add resources to the player's stockpile.
   * In Sandbox mode, every add() call yields 10× the requested amount.
   * @param {object} rewards e.g. { gold: 500, xp: 100 }
   */
  add(rewards) {
    const mult = this._gameMode === 'sandbox' ? 10 : 1;
    for (const [key, amount] of Object.entries(rewards)) {
      if (this._resources[key] !== undefined) {
        this._addCapped(this._resources[key], amount * mult);
      }
    }
    eventBus.emit('resources:added', rewards);
    this._uiDirty = true;
  }

  /**
   * Increase resource storage cap (triggered by buildings).
   * @param {string} resource
   * @param {number} newCap
   */
  setCap(resource, newCap) {
    if (this._resources[resource]) {
      this._resources[resource].cap = newCap;
    }
  }

  // =============================================
  // TEMPORARY MODIFIERS (events, buffs, etc.)
  // =============================================
  /**
   * Register a temporary production multiplier for a single resource type.
   * Key stored as "<id>:<resourceType>" to allow one event with multiple
   * resource effects and proper removal by event id prefix.
   * @param {string} resourceType  e.g. 'iron'
   * @param {number} multiplier    e.g. 2.0 for double
   * @param {string} id            unique source id, e.g. 'double_iron_weekend'
   */
  addModifier(resourceType, multiplier, id) {
    this._modifiers.set(ResourceManager.modifierKey(id, resourceType), { resourceType, multiplier });
    this._reapplyRates();
  }

  /**
   * Remove a temporary modifier previously added via addModifier.
   * @param {string} id            the same source id passed to addModifier
   * @param {string} resourceType  the same resource type passed to addModifier
   */
  removeModifier(id, resourceType) {
    const key = ResourceManager.modifierKey(id, resourceType);
    if (this._modifiers.has(key)) {
      this._modifiers.delete(key);
      this._reapplyRates();
    }
  }

  /** Shared key construction so addModifier/removeModifier callers cannot drift. */
  static modifierKey(id, resourceType) {
    return `${id}:${resourceType}`;
  }

  // =============================================
  // POPULATION
  // =============================================
  getPopulation() { return { ...this._population }; }

  setPopulationCap(cap) {
    const clamped = Math.max(0, Math.min(cap, 1000));
    if (this._population.cap === clamped) return;
    this._population.cap = clamped;
    // Shrink current pop if cap dropped below it
    if (this._population.current > clamped) {
      this._population.current = clamped;
    }
    eventBus.emit('population:updated', this.getPopulation());
  }

  // =============================================
  // CAFETERIA STOCK CAPACITY
  // =============================================

  /** Total food-stock capacity across all cafeteria instances. */
  getFoodCapacity()  { return this._foodCapacity; }

  /** Total water-stock capacity across all cafeteria instances. */
  getWaterCapacity() { return this._waterCapacity; }

  /** Called by BuildingManager._recalculateAllCaps() whenever cafeteria level changes. */
  setFoodCapacity(cap) {
    this._foodCapacity = Math.max(0, cap);
  }

  /** Called by BuildingManager._recalculateAllCaps() whenever cafeteria level changes. */
  setWaterCapacity(cap) {
    this._waterCapacity = Math.max(0, cap);
  }

  growPopulation(amount) {
    if (this._population.current >= this._population.cap) return;
    this._population.current = Math.min(
      this._population.current + amount,
      this._population.cap
    );
    eventBus.emit('population:updated', this.getPopulation());
  }

  shrinkPopulation(amount) {
    if (this._population.current <= 0) return;
    this._population.current = Math.max(0, this._population.current - amount);
    eventBus.emit('population:updated', this.getPopulation());
  }

  // =============================================
  // SERIALIZATION
  // =============================================
  getSnapshot() {
    const snap = {};
    for (const [key, res] of Object.entries(this._resources)) {
      snap[key] = { ...res };
    }
    return snap;
  }

  serialize() {
    return { resources: this.getSnapshot(), population: { ...this._population } };
  }

  deserialize(data) {
    if (!data) return;
    // Support both old flat format (direct resource keys) and new format ({ resources, population })
    const resourceData = data.resources ?? data;
    for (const [key, res] of Object.entries(resourceData)) {
      if (this._resources[key]) {
        this._resources[key].amount = res.amount ?? 0;
        this._resources[key].cap    = res.cap    ?? this._resources[key].cap ?? 0;
      }
    }
    if (data.population) {
      this._population.current = data.population.current ?? 0;
      this._population.cap     = data.population.cap     ?? 0;
    }
  }

  /**
   * Calculate total resource requirements for completing the tutorial chain.
   * Reads TUTORIAL_STEPS and BUILDINGS_CONFIG to dynamically determine what's needed.
   * This ensures that if tutorial or building costs change, starting resources auto-adjust.
   * Includes a 1.1x safety buffer to account for timing variations.
   * @private
   * @returns {object} e.g., { wood: 750, stone: 450, iron: 20, ... }
   */
  _calculateTutorialRequirements() {
    const costs = { wood: 0, stone: 0, iron: 0, food: 0, water: 0, diamond: 0, money: 0 };

    // Iterate through each tutorial step
    for (const step of TUTORIAL_STEPS) {
      // Only process steps that build/upgrade a specific building
      if (!step.filterBuildingId) continue;

      const building = BUILDINGS_CONFIG[step.filterBuildingId];
      if (!building || !building.baseCost) continue;

      // Determine target level: special case for HQ upgrade to level 2
      let targetLevel = 1;
      if (step.filterBuildingId === 'townhall' && step.id === 'townhall') {
        targetLevel = 2;
      }

      // Calculate cost at target level using cost multiplier
      const multiplier = building.costMultiplier ?? 1.0;
      const levelMultiplier = Math.pow(multiplier, targetLevel - 1);

      // Add this building's cost to the running total
      for (const [resource, baseCost] of Object.entries(building.baseCost)) {
        const actualCost = baseCost * levelMultiplier;
        costs[resource] += actualCost;
      }
    }

    // Apply 1.1x safety buffer for production delays and rounding
    const SAFETY_BUFFER = 1.1;
    for (const resource of Object.keys(costs)) {
      costs[resource] = costs[resource] * SAFETY_BUFFER;
    }

    return costs;
  }

  /**
   * Calculate starting resource storage caps from Townhall (HQ) Lv1 storageCap.
   * This ensures starting caps always match building definitions and never get out of sync.
   * Replaces hard-coded cap values with data-driven approach.
   * @private
   * @returns {object} e.g., { wood: 3000, stone: 2500, iron: 800, ... }
   */
  _calculateStartingCaps() {
    const hqConfig = BUILDINGS_CONFIG.townhall;
    if (!hqConfig?.storageCap) {
      // Fallback to safe defaults if townhall config missing (shouldn't happen)
      return {
        wood: 3000, stone: 2500, iron: 800, food: 800,
        water: 1000, diamond: Infinity, money: 5000
      };
    }

    // Read Lv1 cap from each resource array (index 1, since index 0 is unused)
    const caps = {};
    for (const [res, perLevelArray] of Object.entries(hqConfig.storageCap)) {
      if (Array.isArray(perLevelArray)) {
        caps[res] = perLevelArray[1] ?? 0;  // Level 1 cap
      } else {
        caps[res] = 0;  // Fallback
      }
    }

    // Ensure all required resources have a cap
    return {
      wood:    caps.wood    ?? 3000,
      stone:   caps.stone   ?? 2500,
      iron:    caps.iron    ?? 800,
      food:    caps.food    ?? 800,
      water:   caps.water   ?? 1000,
      diamond: Infinity,  // Always infinite
      money:   caps.money  ?? 5000,
    };
  }
}
