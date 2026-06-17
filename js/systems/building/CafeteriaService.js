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
const REMINDER_INTERVAL  = 90;   // min seconds between cafeteria reminders (polite, non-spammy)
const POP_GROWTH_BASE    = 0.08; // residents/sec into empty housing; tapers to 0 as housing fills
const PER_CAPITA_BASE    = 0.02; // food & water /sec per resident in a Lv.1 house
const PER_CAPITA_PER_LVL = 0.008;// extra per-resident draw for each house level above 1 (→ ~0.1 by Lv.10)

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
    const roomFood  = Math.max(0, Math.min(foodAmount,  cap.food  - inst.stock.food));
    const roomWater = Math.max(0, Math.min(waterAmount, cap.water - inst.stock.water));
    // Partial restock: only ever pull what the global pool actually holds, so a poor
    // early player can top up with whatever they have instead of failing outright.
    const snap = this._rm.getSnapshot();
    const addFood  = Math.min(roomFood,  Math.floor(snap.food?.amount  ?? 0));
    const addWater = Math.min(roomWater, Math.floor(snap.water?.amount ?? 0));
    if (addFood === 0 && addWater === 0) {
      const reason = (roomFood === 0 && roomWater === 0)
        ? 'Cafeteria stock is already full.'
        : 'No food or water in storage to restock with.';
      return { success: false, reason };
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
      if (drainRatePerSec > 0) {
        // Treat a never-stocked cafeteria as empty (stock may be undefined) so an
        // unstocked cafeteria with consumers reads "0s to empty", not "stocked forever".
        const minStock = Math.min(inst.stock?.food ?? 0, inst.stock?.water ?? 0);
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

  /**
   * Mathematical offline catchup for the cafeteria/population loop.
   * 1. Determines how many seconds of the offline window were "fed" vs "starved"
   *    by comparing total cafeteria stock against total drain needed.
   * 2. Drains stock proportionally, then applies growth (fed period) and
   *    shrinkage (starvation period) to population.
   * 3. If auto-restock was enabled, runs one refill pass from the global pool
   *    (which already has its offline production credited).
   * @param {number} elapsedSec
   */
  applyOffline(elapsedSec) {
    const cafInstances   = this._getInstances('cafeteria').filter(c => (c.level ?? 0) > 0);
    const houseInstances = this._getInstances('house').filter(h => (h.level ?? 0) > 0);
    const population     = this._rm.getPopulation();
    const hasConsumers   = houseInstances.length > 0 && population.cap > 0;

    // ── Auto-restock pass (single sweep — resources are already credited) ─────
    if (this._automations.cafeteriaRestock) {
      const snap = this._rm.getSnapshot();
      const globalFood  = snap.food?.amount  ?? 0;
      const globalWater = snap.water?.amount ?? 0;
      for (const inst of cafInstances) {
        if (!inst.stock) inst.stock = { food: 0, water: 0 };
        const cap        = this._stockCap(inst.level);
        const foodNeeded  = Math.max(0, cap.food  - inst.stock.food);
        const waterNeeded = Math.max(0, cap.water - inst.stock.water);
        const foodAmt     = (foodNeeded  > 0 && globalFood  > POOL_RESERVE) ? Math.min(foodNeeded,  globalFood  - POOL_RESERVE) : 0;
        const waterAmt    = (waterNeeded > 0 && globalWater > POOL_RESERVE) ? Math.min(waterNeeded, globalWater - POOL_RESERVE) : 0;
        if (foodAmt > 0 || waterAmt > 0) this._applyRestock(inst, foodAmt, waterAmt);
      }
    }

    if (!hasConsumers || cafInstances.length === 0) {
      // No housing/cafeteria — no drain, no growth loop to apply
      return;
    }

    const drainPerSec = this._totalDrainPerSec();

    if (drainPerSec <= 0) {
      // Population exists but somehow zero drain — allow growth if stocked
      const cafStocked = cafInstances.some(c => (c.stock?.food ?? 0) > 0 && (c.stock?.water ?? 0) > 0);
      if (cafStocked && population.current < population.cap) {
        const headroom = 1 - (population.current / population.cap);
        this._rm.growPopulation(POP_GROWTH_BASE * headroom * elapsedSec);
      }
      return;
    }

    // Total stock available across all cafeterias
    const totalFood  = cafInstances.reduce((s, c) => s + (c.stock?.food  ?? 0), 0);
    const totalWater = cafInstances.reduce((s, c) => s + (c.stock?.water ?? 0), 0);

    // How many seconds of drain the stock could cover
    const fedSec     = Math.min(elapsedSec, Math.min(totalFood, totalWater) / drainPerSec);
    const starvedSec = elapsedSec - fedSec;

    // Drain stock proportionally across instances for the fed period
    if (fedSec > 0) {
      const drainFood  = Math.min(totalFood,  drainPerSec * fedSec);
      const drainWater = Math.min(totalWater, drainPerSec * fedSec);
      for (const caf of cafInstances) {
        if (!caf.stock) caf.stock = { food: 0, water: 0 };
        if (totalFood  > 0) caf.stock.food  = Math.max(0, caf.stock.food  - drainFood  * (caf.stock.food  / totalFood));
        if (totalWater > 0) caf.stock.water = Math.max(0, caf.stock.water - drainWater * (caf.stock.water / totalWater));
      }
    }

    // Population growth during fed period (logistic — tapers as housing fills)
    if (fedSec > 0 && population.current < population.cap) {
      const headroom = 1 - (population.current / population.cap);
      this._rm.growPopulation(POP_GROWTH_BASE * headroom * fedSec);
    }

    // Population shrinkage during starvation period
    if (starvedSec > 0) {
      this._rm.shrinkPopulation(0.02 * starvedSec);
    }
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

  /** Per-second food & water draw of a single resident in a house of the given level. */
  _perCapita(level) {
    return PER_CAPITA_BASE + PER_CAPITA_PER_LVL * Math.max(0, (level ?? 1) - 1);
  }

  /** Total per-second food/water draw from all populated houses. */
  _totalDrainPerSec() {
    const pop = this._rm.getPopulation();
    return (this._getInstances('house')).reduce((s, h) => {
      if ((h.level ?? 0) <= 0) return s;
      return s + Math.min(pop.current, h.level * 10) * this._perCapita(h.level);
    }, 0);
  }

  /** Emit a throttled, non-spammy cafeteria reminder (≤ 1 per REMINDER_INTERVAL). */
  _remind(severity, message) {
    if (this._shortfallCooldown > 0) return;
    this._shortfallCooldown = REMINDER_INTERVAL;
    eventBus.emit('building:cafeteria:shortfall', { severity, message });
  }

  _drainAndPopulation(dt) {
    this._shortfall = false;
    const houseInstances = this._getInstances('house').filter(h => (h.level ?? 0) > 0);
    const cafInstances   = this._getInstances('cafeteria').filter(c => (c.level ?? 0) > 0);
    const population     = this._rm.getPopulation();
    const hasConsumers   = houseInstances.length > 0 && population.cap > 0;

    // Drain food/water from cafeteria stock to feed each populated house.
    for (const houseInst of houseInstances) {
      const people     = Math.min(population.current, houseInst.level * 10);
      const perCapita  = this._perCapita(houseInst.level);
      let remainFood   = people * perCapita * dt;
      let remainWater  = people * perCapita * dt;
      for (const caf of cafInstances) {
        if (remainFood <= 0 && remainWater <= 0) break;
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

    // Growth is gated on a cafeteria that actually holds both food and water.
    const cafeteriaStocked = cafInstances.some(c => (c.stock?.food ?? 0) > 0 && (c.stock?.water ?? 0) > 0);

    if (this._shortfall) {
      // Active starvation — population shrinks and we nudge (gently, throttled).
      this._rm.shrinkPopulation(0.02 * dt);
      this._remind('warning', 'Your cafeteria has run dry — population is shrinking. Restock food & water to recover.');
    } else if (hasConsumers && !cafeteriaStocked) {
      // Housing exists but the cafeteria is empty: growth is paused until it's stocked.
      this._remind('info', 'Your cafeteria is empty — restock food & water so your population can grow.');
    } else if (hasConsumers && cafeteriaStocked && population.current < population.cap) {
      // Healthy: dynamic growth that tapers as housing fills (logistic).
      const headroom = 1 - (population.current / population.cap);
      this._rm.growPopulation(POP_GROWTH_BASE * headroom * dt);
    }
  }
}
