/**
 * CafeteriaService.js
 * The cafeteria "feeding" feature, extracted from BuildingManager. Cafeterias
 * are buildings; *stocking and feeding from them* is a separate concern that
 * owns:
 *   • manual restock + a single shared refill primitive
 *   • auto-restock (a scheduler layered on the same primitive — surplus only)
 *   • the per-tick drain → shortfall → population growth/decay loop
 *
 * Building instance records (with their `stock`) stay owned by BuildingManager;
 * this service operates on them via the injected `getInstances` accessor and
 * reads/writes population through the ResourceManager.
 */
import { eventBus }         from '../../core/EventBus.js';
import { BUILDINGS_CONFIG } from '../../entities/GAME_DATA.js';

const RESTOCK_INTERVAL   = 30;   // seconds between auto-restock passes
const POOL_RESERVE       = 50;   // keep this much food/water in the global pool on auto-restock
const SHORTFALL_COOLDOWN = 120;  // seconds between shortfall notifications

export class CafeteriaService {
  /** @param {{ rm, getInstances:(buildingId:string)=>Array }} deps */
  constructor({ rm, getInstances }) {
    this._rm           = rm;
    this._getInstances = getInstances; // (buildingId) => instance[]
    this._shortfall          = false;
    this._shortfallCooldown  = 0;
    this._autoRestockTimer   = 0;
    this._automations = { cafeteriaRestock: false };
  }

  // ── Capacity ──────────────────────────────────────────────────────

  /** Food/water stock cap for a cafeteria at the given level. */
  _stockCap(level) {
    const cfg = BUILDINGS_CONFIG['cafeteria'];
    const fp = cfg?.foodCapacityPerLevel  ?? 200;
    const wp = cfg?.waterCapacityPerLevel ?? 200;
    return {
      food:  Array.isArray(fp) ? (fp[level] ?? 0) : fp * level,
      water: Array.isArray(wp) ? (wp[level] ?? 0) : wp * level,
    };
  }

  // ── Shared refill primitive (manual + auto both funnel through here) ─

  /**
   * Add up to (foodAmount, waterAmount) to an instance's stock, clamped to cap,
   * paid from the global resource pool.
   * @returns {{ success: boolean, reason?: string }}
   */
  _applyRestock(inst, foodAmount, waterAmount) {
    if (!inst.stock) inst.stock = { food: 0, water: 0 };
    const cap = this._stockCap(inst.level);
    const addFood  = Math.max(0, Math.min(foodAmount,  cap.food  - inst.stock.food));
    const addWater = Math.max(0, Math.min(waterAmount, cap.water - inst.stock.water));
    if (addFood === 0 && addWater === 0) {
      return { success: false, reason: 'Cafeteria stock is already full.' };
    }
    const cost = {};
    if (addFood  > 0) cost.food  = addFood;
    if (addWater > 0) cost.water = addWater;
    if (!this._rm.spend(cost)) return { success: false, reason: 'Not enough resources.' };
    inst.stock.food  += addFood;
    inst.stock.water += addWater;
    eventBus.emit('building:cafeteria:restocked', { instanceId: inst.instanceId, stock: { ...inst.stock } });
    return { success: true };
  }

  // ── Public API (BuildingManager delegates these) ──────────────────

  /** Manually restock a cafeteria instance from the global pool. */
  restock(instanceId, foodAmount, waterAmount) {
    const inst = this._getInstances('cafeteria').find(i => i.instanceId === instanceId);
    if (!inst || (inst.level ?? 0) <= 0) {
      return { success: false, reason: 'Cafeteria instance not found.' };
    }
    return this._applyRestock(inst, foodAmount, waterAmount);
  }

  enableAutomation(type) {
    if (type in this._automations) {
      this._automations[type] = true;
      // Trigger immediately — jump timer so next tick fires a restock right away
      if (type === 'cafeteriaRestock') this._autoRestockTimer = RESTOCK_INTERVAL;
      eventBus.emit('building:automationEnabled', { type });
    }
  }

  getAutomations() { return { ...this._automations }; }

  restoreAutomations(obj) {
    if (!obj) return;
    for (const [k, v] of Object.entries(obj)) {
      if (k in this._automations) this._automations[k] = v;
    }
  }

  /** All cafeteria instances with current stock + stock cap. */
  getStock() {
    return this._getInstances('cafeteria')
      .filter(inst => (inst.level ?? 0) > 0)
      .map(inst => ({
        instanceId: inst.instanceId,
        level:      inst.level,
        stock:      inst.stock ?? { food: 0, water: 0 },
        stockCap:   this._stockCap(inst.level),
      }));
  }

  /** Per-second drain + seconds-to-empty for an instance (status display). */
  depletionOf(inst) {
    let drainRatePerSec = 0;
    let depletionSec    = Infinity;
    if ((inst.level ?? 0) > 0) {
      drainRatePerSec = this._totalDrainPerSec();
      if (drainRatePerSec > 0 && inst.stock) {
        const minStock = Math.min(inst.stock.food ?? 0, inst.stock.water ?? 0);
        depletionSec   = minStock / drainRatePerSec;
      }
    }
    return { drainRatePerSec, depletionSec };
  }

  // ── Per-tick: auto-restock, then drain → shortfall → population ────

  update(dt) {
    if (this._shortfallCooldown > 0) this._shortfallCooldown -= dt;
    this._autoRestock(dt);
    this._drainAndPopulation(dt);
  }

  _autoRestock(dt) {
    if (!this._automations.cafeteriaRestock) return;
    this._autoRestockTimer += dt;

    const cafs = this._getInstances('cafeteria');
    // Emergency path: if any cafeteria instance is completely empty, skip the timer
    const isAnyEmpty = cafs.some(inst =>
      (inst.level ?? 0) > 0 && ((inst.stock?.food ?? 0) <= 0 || (inst.stock?.water ?? 0) <= 0)
    );
    if (isAnyEmpty) this._autoRestockTimer = RESTOCK_INTERVAL;
    if (this._autoRestockTimer < RESTOCK_INTERVAL) return;

    this._autoRestockTimer = 0;
    const snap = this._rm.getSnapshot();
    const globalFood  = snap.food?.amount  ?? 0;
    const globalWater = snap.water?.amount ?? 0;

    for (const inst of cafs) {
      if ((inst.level ?? 0) <= 0) continue;
      if (!inst.stock) inst.stock = { food: 0, water: 0 };
      const cap = this._stockCap(inst.level);
      const foodNeeded  = Math.max(0, cap.food  - inst.stock.food);
      const waterNeeded = Math.max(0, cap.water - inst.stock.water);
      // Only spend the surplus above the pool reserve
      const foodAmt  = (foodNeeded  > 0 && globalFood  > POOL_RESERVE) ? Math.min(foodNeeded,  globalFood  - POOL_RESERVE) : 0;
      const waterAmt = (waterNeeded > 0 && globalWater > POOL_RESERVE) ? Math.min(waterNeeded, globalWater - POOL_RESERVE) : 0;
      if (foodAmt > 0 || waterAmt > 0) this._applyRestock(inst, foodAmt, waterAmt);
    }
  }

  /** Total per-second food/water draw from all populated houses. */
  _totalDrainPerSec() {
    const pop = this._rm.getPopulation();
    return (this._getInstances('house')).reduce((s, h) => {
      if ((h.level ?? 0) <= 0) return s;
      return s + Math.min(pop.current, h.level * 10) * 0.1;
    }, 0);
  }

  _drainAndPopulation(dt) {
    this._shortfall = false;
    const houseInstances = this._getInstances('house');
    const cafInstances   = this._getInstances('cafeteria');
    const population     = this._rm.getPopulation();

    for (const houseInst of houseInstances) {
      if ((houseInst.level ?? 0) <= 0) continue;
      const people      = Math.min(population.current, houseInst.level * 10);
      const foodDrain   = people * 0.1 * dt;
      const waterDrain  = people * 0.1 * dt;
      let remainFood    = foodDrain;
      let remainWater   = waterDrain;
      // Drain from cafeteria instances (round-robin)
      for (const caf of cafInstances) {
        if (remainFood <= 0 && remainWater <= 0) break;
        if ((caf.level ?? 0) <= 0) continue;
        if (!caf.stock) caf.stock = { food: 0, water: 0 };
        const takenFood  = Math.min(remainFood,  caf.stock.food);
        const takenWater = Math.min(remainWater, caf.stock.water);
        caf.stock.food  -= takenFood;
        caf.stock.water -= takenWater;
        remainFood  -= takenFood;
        remainWater -= takenWater;
      }
      if (remainFood > 0 || remainWater > 0) this._shortfall = true;
    }

    if (!this._shortfall) {
      if (population.current < population.cap) {
        this._rm.growPopulation(0.05 * dt);
      }
      // Cafeteria is healthy — reset cooldown so the next genuine shortfall fires immediately
      this._shortfallCooldown = 0;
    } else {
      this._rm.shrinkPopulation(0.02 * dt);
      // Emit shortfall event at most once per cooldown period
      if (this._shortfallCooldown <= 0) {
        this._shortfallCooldown = SHORTFALL_COOLDOWN;
        eventBus.emit('building:cafeteria:shortfall', { message: 'Cafeteria is out of food or water — population is shrinking!' });
      }
    }
  }
}
