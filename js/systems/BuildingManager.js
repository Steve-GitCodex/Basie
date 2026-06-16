/**
 * BuildingManager.js
 * Manages placing, upgrading, and tracking all base buildings.
 *
 * Multi-instance model: each building type can have multiple independent
 * copies (instances), each with its own level. Instances are unlocked by
 * conditions defined in BUILDINGS_CONFIG.instanceSlots[].
 *
 * Queue design:
 *  - `_buildQueue` is an ordered array of queue items; index 0 is always the active build.
 *  - Each item tracks its own timer (startedAt / endsAt) for serialization safety.
 *  - `_buildings` stores Map<id, [{instanceId, level}]> — only completed levels.
 *  - Resources are spent at queue time, refunded on cancel.
 */
import { eventBus }                                    from '../core/EventBus.js';
import {
  BUILDINGS_CONFIG, QUEUE_CONFIG,
  CATEGORY_ZONE, plotById, plotsInZone,
} from '../entities/GAME_DATA.js';
import { buildingRules } from './building/buildingRules.js';
import { buildingEconomy } from './building/buildingEconomy.js';
import { headquarters } from './building/headquarters.js';
import { CafeteriaService } from './building/CafeteriaService.js';

/**
 * @typedef {{ buildingId: string, instanceIndex: number, instanceId: string, pendingLevel: number, buildTimeSec: number, cost: Object, startedAt: number|null, endsAt: number|null }} BuildQueueItem
 * @typedef {{ instanceId: string, level: number }} BuildingInstance
 */

export class BuildingManager {
  /** @param {import('./ResourceManager.js').ResourceManager} resourceManager */
  constructor(resourceManager) {
    this.name = 'BuildingManager';
    this._rm  = resourceManager;

    /** @type {Map<string, BuildingInstance[]>} buildingId -> array of instances (completed levels only) */
    this._buildings = new Map();
    this._buildings.set('townhall', [{ instanceId: 'townhall_0', level: 1 }]);

    /** Context passed to the pure buildingRules helpers (stateful lookups). */
    this._rulesCtx = {
      getLevelOf:    (id) => this.getLevelOf(id),
      getPopulation: ()   => this._rm.getPopulation(),
    };

    /** Context passed to the pure buildingEconomy.computeActiveRates helper. */
    this._economyCtx = {
      getPopulation:   ()    => this._rm.getPopulation(),
      getBuildingHero: (iid) => this._hm?.getBuildingHero(iid) ?? null,
    };

    /**
     * Plot placements — purely positional layer over the instance model.
     * @type {Map<string, string>} instanceId -> plotId (see CITY_BLUEPRINT.plots)
     */
    this._placements = new Map();

    /** @type {BuildQueueItem[]} */
    this._buildQueue = [];
    this._premiumBuildSlots    = 0;
    this._shopBuildSlotBought  = false; // tracks one-time shop slot purchase
    this._vipBuildTimeReduction = 0;  // cumulative fractional reduction from VIP perks

    this._techBonuses = {};
    this._hm = null; // set after heroManager is constructed via setHeroManager()
    this._um = null; // set after unitManager is constructed via setUnitManager()

    /** Cafeteria feeding feature (stock/restock/auto-restock + population loop). */
    this._cafeteria = new CafeteriaService({
      rm:           this._rm,
      getInstances: (id) => this._buildings.get(id) ?? [],
    });

    eventBus.on('resources:bonusChanged', b => { this._techBonuses = b || {}; this._notifyRates(); });
    eventBus.on('population:updated',     () => this._notifyRates());
    // VIP perk: stacking build time reduction + extra build slot at VIP III
    eventBus.on('user:vipUpdate', ({ perks, deltaPerks, isInit }) => {
      this._vipBuildTimeReduction = Math.min(0.80, perks?.buildTimeReduction ?? 0);
      const slotsToAdd = isInit
        ? (perks?.extraBuildSlots ?? 0)
        : (deltaPerks?.extraBuildSlots ?? 0);
      for (let i = 0; i < slotsToAdd; i++) this.addPremiumBuildSlot();
    });
    // Sandbox mode: near-instant build times
    this._gameMode = 'campaign';
    eventBus.on('game:modeChanged', ({ mode }) => { this._gameMode = mode; });
    this._notifyRates();
    this._recalculateAllCaps();
  }

  /**
   * Wire the hero manager after construction (avoids circular dependency).
   * @param {object} heroManager
   */
  setHeroManager(heroManager) {
    this._hm = heroManager;
    eventBus.on('heroes:updated', () => this._notifyRates());
  }

  /**
   * Wire the unit manager after construction (avoids circular dependency).
   * Used to query training queue depths per building.
   * @param {object} unitManager
   */
  setUnitManager(unitManager) {
    this._um = unitManager;
  }

  // ─────────────────────────────────────────────
  // Engine tick
  // ─────────────────────────────────────────────

  update(dt) {
    // ── Build queue tick ────────────────────────────────────────────
    const active = this._buildQueue[0];
    // Sandbox mode: advance the timer 100× faster by subtracting 99/100 of the
    // elapsed time from endsAt each tick (real dt still passes, so total = 100×).
    if (active?.endsAt && this._gameMode === 'sandbox') {
      active.endsAt -= dt * 99 * 1000;
    }
    if (active?.endsAt && Date.now() >= active.endsAt) {
      const { buildingId, instanceIndex, pendingLevel } = active;

      // Remove from queue FIRST so that any event handler calling getBuildQueue()
      // sees the correct post-completion state (avoids stuck-at-0s display).
      this._buildQueue.shift();
      if (this._buildQueue.length > 0) {
        const next  = this._buildQueue[0];
        const nowMs = Date.now();
        next.startedAt = nowMs;
        next.endsAt    = nowMs + next.buildTimeSec * 1000;
      }

      // Apply the completed level
      const instances = this._buildings.get(buildingId);
      if (instances) {
        if (!instances[instanceIndex]) {
          instances[instanceIndex] = { instanceId: `${buildingId}_${instanceIndex}`, level: 0 };
        }
        instances[instanceIndex].level = pendingLevel;
      }

      this._recalculateAllCaps();
      this._notifyRates();

      // Emit after queue is already updated so listeners see correct state
      eventBus.emit('building:completed', { id: buildingId, instanceIndex, building: { id: buildingId, level: pendingLevel } });
      eventBus.emit('building:queueUpdated', this.getBuildQueue());
    }

    // ── Cafeteria feeding: auto-restock + drain → shortfall → population ──
    this._cafeteria.update(dt);
  }

  // ─────────────────────────────────────────────
  // Pure query helpers (no side-effects)
  // ─────────────────────────────────────────────

  /**
   * Check whether a building slot can be started (slot unlocked + base requires met).
   * Pure query — no side-effects, no resource changes.
   * @param {string} buildingId
   * @param {number} [instanceIndex=0]
   * @returns {{ ok: boolean, reason?: string }}
   */
  canBuild(buildingId, instanceIndex = 0) {
    const cfg = BUILDINGS_CONFIG[buildingId];
    if (!cfg) return { ok: false, reason: 'Unknown building.' };

    const unlockedCount = this._getUnlockedInstanceCount(cfg);
    if (instanceIndex >= unlockedCount) {
      const slot = cfg.instanceSlots?.[instanceIndex];
      const cond = slot?.condition;
      if (cond) {
        const parts = Object.entries(cond).map(([bId, minLv]) => {
          const name = BUILDINGS_CONFIG[bId]?.name ?? bId;
          return `${name} Lv.${minLv}`;
        });
        return { ok: false, reason: `Slot locked — requires: ${parts.join(', ')}` };
      }
      return { ok: false, reason: 'This building slot is not yet unlocked.' };
    }

    const reqCheck = buildingRules.checkRequirements(cfg.requires, this._rulesCtx);
    if (!reqCheck.met) return { ok: false, reason: reqCheck.reason };

    return { ok: true };
  }

  /**
   * Check whether a building instance can be upgraded to the next level (per-level requires met).
   * Pure query — no side-effects, no resource changes.
   * @param {string} buildingId
   * @param {number} [instanceIndex=0]
   * @returns {{ ok: boolean, reason?: string }}
   */
  canUpgrade(buildingId, instanceIndex = 0) {
    const cfg = BUILDINGS_CONFIG[buildingId];
    if (!cfg) return { ok: false, reason: 'Unknown building.' };

    const instances      = this._buildings.get(buildingId) ?? [];
    const completedLevel = instances[instanceIndex]?.level ?? 0;
    const queuedCount    = this._buildQueue.filter(
      q => q.buildingId === buildingId && q.instanceIndex === instanceIndex
    ).length;
    const effectiveLevel = completedLevel + queuedCount;

    if (effectiveLevel >= cfg.maxLevel) {
      return { ok: false, reason: `${cfg.name} #${instanceIndex + 1} is already at max level.` };
    }

    // Instance ordering: slot N cannot exceed the level of slot N-1
    if (instanceIndex > 0) {
      const prevInst      = instances[instanceIndex - 1];
      const prevCompleted = prevInst?.level ?? 0;
      const prevQueued    = this._buildQueue.filter(
        q => q.buildingId === buildingId && q.instanceIndex === instanceIndex - 1
      ).length;
      const prevEffective = prevCompleted + prevQueued;
      if (effectiveLevel + 1 > prevEffective) {
        return { ok: false, reason: `Upgrade ${cfg.name} #${instanceIndex} to Lv.${effectiveLevel + 1} first.` };
      }
    }

    const pendingLevel = effectiveLevel + 1;
    const lvlReqCheck  = buildingRules.checkRequirements(cfg.levelRequirements?.[pendingLevel], this._rulesCtx);
    if (!lvlReqCheck.met) return { ok: false, reason: lvlReqCheck.reason };

    return { ok: true };
  }

  /**
   * Return all unmet build/upgrade conditions for a building instance as human-readable strings.
   * Returns an empty array when every requirement is satisfied.
   * @param {string} buildingId
   * @param {number} [instanceIndex=0]
   * @returns {string[]}
   */
  getMissingRequirements(buildingId, instanceIndex = 0) {
    const cfg = BUILDINGS_CONFIG[buildingId];
    if (!cfg) return ['Unknown building.'];

    const missing = [];

    // Slot condition check
    const unlockedCount = this._getUnlockedInstanceCount(cfg);
    if (instanceIndex >= unlockedCount) {
      const slot = cfg.instanceSlots?.[instanceIndex];
      const cond = slot?.condition;
      if (cond) {
        for (const [bId, minLv] of Object.entries(cond)) {
          if (this.getLevelOf(bId) < minLv) {
            const name = BUILDINGS_CONFIG[bId]?.name ?? bId;
            missing.push(`Requires ${name} Lv.${minLv}`);
          }
        }
      }
      return missing;
    }

    // Base requires
    missing.push(...buildingRules.collectMissing(cfg.requires, this._rulesCtx));

    // Per-level requires
    const instances      = this._buildings.get(buildingId) ?? [];
    const completedLevel = instances[instanceIndex]?.level ?? 0;
    const queuedCount    = this._buildQueue.filter(
      q => q.buildingId === buildingId && q.instanceIndex === instanceIndex
    ).length;
    const effectiveLevel = completedLevel + queuedCount;
    const pendingLevel   = effectiveLevel + 1;
    missing.push(...buildingRules.collectMissing(cfg.levelRequirements?.[pendingLevel], this._rulesCtx));

    // Instance ordering: slot N cannot exceed the level of slot N-1
    if (instanceIndex > 0) {
      const prevInst      = instances[instanceIndex - 1];
      const prevCompleted = prevInst?.level ?? 0;
      const prevQueued    = this._buildQueue.filter(
        q => q.buildingId === buildingId && q.instanceIndex === instanceIndex - 1
      ).length;
      const prevEffective = prevCompleted + prevQueued;
      if (effectiveLevel + 1 > prevEffective) {
        missing.push(`${cfg.name} #${instanceIndex} must reach Lv.${effectiveLevel + 1} first`);
      }
    }

    return missing;
  }

  // ─────────────────────────────────────────────
  // Public actions
  // ─────────────────────────────────────────────

  /**
   * Queue a building instance build/upgrade.
   * @param {string} buildingId
   * @param {number} [instanceIndex=0]
   * @returns {{ success: boolean, reason?: string }}
   */
  build(buildingId, instanceIndex = 0) {
    const cfg = BUILDINGS_CONFIG[buildingId];
    if (!cfg) return { success: false, reason: 'Unknown building.' };

    // Slot unlock + base requires
    const buildCheck = this.canBuild(buildingId, instanceIndex);
    if (!buildCheck.ok) return { success: false, reason: buildCheck.reason };

    const instances      = this._buildings.get(buildingId) ?? [];
    const completedLevel = instances[instanceIndex]?.level ?? 0;
    const queuedCount    = this._buildQueue.filter(
      q => q.buildingId === buildingId && q.instanceIndex === instanceIndex
    ).length;
    const effectiveLevel = completedLevel + queuedCount;

    if (effectiveLevel >= cfg.maxLevel) {
      return { success: false, reason: `${cfg.name} #${instanceIndex + 1} is already at max level.` };
    }

    const maxSlots = this._getMaxBuildSlots();
    if (this._buildQueue.length >= maxSlots) {
      return {
        success: false,
        reason: `Build queue is full (${this._buildQueue.length}/${maxSlots}). Build a Construction Hall to unlock more slots.`,
      };
    }

    // Per-level requirements (e.g. House Lv.3 needs Cafeteria Lv.2; Bank Lv.3 needs Population ≥ 20)
    const upgradeCheck = this.canUpgrade(buildingId, instanceIndex);
    if (!upgradeCheck.ok) return { success: false, reason: upgradeCheck.reason };

    const pendingLevel = effectiveLevel + 1;

    const cost = buildingRules.scaleCost(cfg.baseCost, cfg.costMultiplier, effectiveLevel);
    if (!this._rm.canAfford(cost)) return { success: false, reason: 'Insufficient resources.' };

    this._rm.spend(cost);

    let buildTimeSec = cfg.buildTime * (effectiveLevel === 0 ? 1 : pendingLevel);
    if (this._techBonuses.buildTimeReduction) {
      const reduction = Math.min(0.80, this._techBonuses.buildTimeReduction);
      buildTimeSec = Math.max(1, Math.floor(buildTimeSec * (1 - reduction)));
    }
    if (this._vipBuildTimeReduction > 0) {
      buildTimeSec = Math.max(1, Math.floor(buildTimeSec * (1 - this._vipBuildTimeReduction)));
    }

    if (!this._buildings.has(buildingId)) this._buildings.set(buildingId, []);
    const instArr = this._buildings.get(buildingId);
    if (!instArr[instanceIndex]) {
      instArr[instanceIndex] = { instanceId: `${buildingId}_${instanceIndex}`, level: 0 };
    }

    const isFirst = this._buildQueue.length === 0;
    const nowMs   = Date.now();

    if (isFirst && buildTimeSec === 0) {
      instArr[instanceIndex].level = pendingLevel;
      this._recalculateAllCaps();
      eventBus.emit('building:completed', { id: buildingId, instanceIndex, building: { id: buildingId, level: pendingLevel } });
      this._notifyRates();
      eventBus.emit('building:started', { id: buildingId, instanceIndex, cost, level: pendingLevel });
      return { success: true };
    }

    const queueItem = {
      buildingId,
      instanceIndex,
      instanceId:   instArr[instanceIndex].instanceId,
      pendingLevel,
      buildTimeSec,
      cost,
      startedAt: isFirst ? nowMs : null,
      endsAt:    isFirst ? nowMs + buildTimeSec * 1000 : null,
    };

    this._buildQueue.push(queueItem);
    eventBus.emit('building:started',      { id: buildingId, instanceIndex, cost, level: pendingLevel });
    eventBus.emit('building:queueUpdated', this.getBuildQueue());
    return { success: true };
  }

  /** Cancel a build queue item by index and refund its cost. */
  cancelBuild(queueIndex) {
    const item = this._buildQueue[queueIndex];
    if (!item) return { success: false, reason: 'Invalid queue index.' };

    this._rm.add(item.cost);
    this._buildQueue.splice(queueIndex, 1);

    if (queueIndex === 0 && this._buildQueue.length > 0) {
      const next  = this._buildQueue[0];
      const nowMs = Date.now();
      next.startedAt = nowMs;
      next.endsAt    = nowMs + next.buildTimeSec * 1000;
    }

    eventBus.emit('building:queueUpdated', this.getBuildQueue());
    return { success: true };
  }

  /** Add a premium build slot (called on premium purchase). */
  addPremiumBuildSlot() {
    this._premiumBuildSlots++;
    eventBus.emit('building:queueUpdated', this.getBuildQueue());
  }

  /** Whether the player has bought the shop build-queue expansion (slot 3). */
  isShopBuildSlotBought() { return this._shopBuildSlotBought; }

  /** One-time shop slot grant — sets the flag, increments premium counter, fires event. */
  grantShopBuildSlot() {
    if (this._shopBuildSlotBought) return;
    this._shopBuildSlotBought = true;
    this._premiumBuildSlots++;
    eventBus.emit('building:queueUpdated', this.getBuildQueue());
  }

  // ─────────────────────────────────────────────
  // Cafeteria & automation — delegated to CafeteriaService
  // ─────────────────────────────────────────────

  getCafeteriaStock()                                  { return this._cafeteria.getStock(); }
  restockCafeteria(instanceId, foodAmount, waterAmount){ return this._cafeteria.restock(instanceId, foodAmount, waterAmount); }
  enableAutomation(type)                               { this._cafeteria.enableAutomation(type); }
  getAutomations()                                     { return this._cafeteria.getAutomations(); }

  // ─────────────────────────────────────────────
  // Queries — used by UI
  // ─────────────────────────────────────────────

  getMaxBuildSlots() { return this._getMaxBuildSlots(); }

  /**
   * Returns the number of training queue items (across all tiers) for a given
   * training building. Delegates to UnitManager which owns the training queues.
   * @param {string} buildingId
   * @returns {number}
   */
  getBuildingQueueDepth(buildingId) {
    return this._um?.getTrainingQueueDepthForBuilding(buildingId) ?? 0;
  }

  getBuildSlotInfo() {
    const maxSlots = this._getMaxBuildSlots();
    return QUEUE_CONFIG.building.map(entry => ({ ...entry, unlocked: entry.slots <= maxSlots }));
  }

  getBuildQueue() {
    return this._buildQueue.map((item, idx) => ({
      ...item,
      queuePosition: idx,
      isActive:      idx === 0,
      cfg:           BUILDINGS_CONFIG[item.buildingId],
    }));
  }

  /**
   * Returns all building types grouped with per-instance status data and locked slot info.
   * Primary data source for BuildingsUI.
   */
  getBuildingTypesWithInstances() {
    const activeItem = this._buildQueue[0] ?? null;

    return Object.values(BUILDINGS_CONFIG).map(cfg => {
      const instances     = this._buildings.get(cfg.id) ?? [];
      const unlockedCount = this._getUnlockedInstanceCount(cfg);

      const instanceData = [];
      for (let idx = 0; idx < unlockedCount; idx++) {
        const inst           = instances[idx] ?? { instanceId: `${cfg.id}_${idx}`, level: 0 };
        const completedLevel = inst.level ?? 0;
        const queuedForInst  = this._buildQueue.filter(
          q => q.buildingId === cfg.id && q.instanceIndex === idx
        );
        const queuedCount    = queuedForInst.length;
        const effectiveLevel = completedLevel + queuedCount;
        const isActivelyBuilding = (
          activeItem?.buildingId === cfg.id && activeItem?.instanceIndex === idx
        );
        const activeForInst = isActivelyBuilding ? activeItem : null;
        const nextCost    = buildingRules.scaleCost(cfg.baseCost, cfg.costMultiplier, effectiveLevel);
        const reqCheck    = buildingRules.checkRequirements(cfg.requires, this._rulesCtx);
        const lvlReqCheck = buildingRules.checkRequirements(cfg.levelRequirements?.[effectiveLevel + 1], this._rulesCtx);
        const finalReqMet    = reqCheck.met && lvlReqCheck.met;
        const finalReqReason = !reqCheck.met ? (reqCheck.reason ?? null) : (lvlReqCheck.reason ?? null);
        // Collect all unmet requirements for detailed UI display
        const missingRequirements = [
          ...buildingRules.collectMissing(cfg.requires, this._rulesCtx),
          ...buildingRules.collectMissing(cfg.levelRequirements?.[effectiveLevel + 1], this._rulesCtx),
        ];

        // Next level build time (raw, before tech reductions) — for UI display
        const rawNextBuildTime = effectiveLevel < cfg.maxLevel
          ? cfg.buildTime * (effectiveLevel === 0 ? 1 : effectiveLevel + 1)
          : null;
        let nextLevelBuildTime = rawNextBuildTime;
        if (rawNextBuildTime !== null && this._techBonuses.buildTimeReduction) {
          const reduction = Math.min(0.80, this._techBonuses.buildTimeReduction);
          nextLevelBuildTime = Math.max(1, Math.floor(rawNextBuildTime * (1 - reduction)));
        }

        // Cafeteria depletion timer
        const { drainRatePerSec, depletionSec } = cfg.id === 'cafeteria'
          ? this._cafeteria.depletionOf(inst)
          : { drainRatePerSec: 0, depletionSec: Infinity };

        instanceData.push({
          ...cfg,
          instanceId:    inst.instanceId ?? `${cfg.id}_${idx}`,
          instanceIndex: idx,
          level:         completedLevel,
          effectiveLevel,
          cost:               nextCost,
          canAfford:          this._rm.canAfford(nextCost),
          requirementsMet:    finalReqMet,
          requirementsReason: finalReqReason,
          missingRequirements,
          isBuilding:         isActivelyBuilding,
          isActivelyBuilding,
          isQueued:           queuedCount > 0 && !isActivelyBuilding,
          queuedCount,
          isMaxLevel:         effectiveLevel >= cfg.maxLevel,
          nextLevelBuildTime,
          constructionEndsAt: activeForInst?.endsAt    ?? null,
          startedAt:          activeForInst?.startedAt ?? null,
          stock:              inst.stock ?? null,
          drainRatePerSec,
          depletionSec,
        });
      }

      const totalSlots  = cfg.instanceSlots?.length ?? 1;
      const lockedSlots = [];
      for (let idx = unlockedCount; idx < totalSlots; idx++) {
        lockedSlots.push({
          instanceIndex: idx,
          condition:     cfg.instanceSlots[idx]?.condition ?? null,
        });
      }

      // HQ (townhall) lock info for this building type
      const hqRequiredLevel = this.getRequiredHQLevel('buildings', cfg.id);
      const isHQLocked = hqRequiredLevel !== null && this.getHQLevel() < hqRequiredLevel;

      return { ...cfg, instances: instanceData, lockedSlots, unlockedInstanceCount: unlockedCount, totalSlots, isHQLocked, hqRequiredLevel };
    });
  }

  /** Backward-compat flat list — one entry per unlocked instance. */
  getAllBuildingsWithStatus() {
    return this.getBuildingTypesWithInstances().flatMap(t => t.instances);
  }

  getActiveBuildings() {
    const result   = [];
    const activeId = this._buildQueue[0]?.buildingId;
    for (const [id, instances] of this._buildings) {
      for (const inst of instances) {
        if ((inst.level ?? 0) > 0 || id === activeId) result.push({ id, ...inst });
      }
    }
    return result;
  }

  /**
   * Maximum completed level across all instances of a building type.
   * Used for requirement checks ("do I have a Barracks at Lv2 anywhere?").
   */
  getLevelOf(buildingId) {
    const instances = this._buildings.get(buildingId);
    if (!instances || instances.length === 0) return 0;
    return Math.max(0, ...instances.map(i => i.level ?? 0));
  }

  /**
   * Level of a specific building instance (e.g. 'barracks_1').
   * Returns 0 if the instance doesn't exist or hasn't been built.
   */
  getInstanceLevelOf(instanceId) {
    const last      = instanceId.lastIndexOf('_');
    const buildingId = instanceId.substring(0, last);
    const idx       = parseInt(instanceId.substring(last + 1), 10);
    return this._buildings.get(buildingId)?.[idx]?.level ?? 0;
  }

  /** Current HQ (townhall) level. */
  getHQLevel() {
    return this.getLevelOf('townhall');
  }

  /**
   * Returns a Set of IDs unlocked at or below the current HQ level for a given category.
   * @param {'buildings'|'units'|'techs'} category
   * @returns {Set<string>}
   */
  getHQUnlockedIds(category) {
    return headquarters.unlockedIds(this.getHQLevel(), category);
  }

  /**
   * Returns the minimum HQ level required to unlock a given id in the specified category,
   * or null if not found in the table (always available from HQ 1).
   * @param {'buildings'|'units'|'techs'} category
   * @param {string} id
   * @returns {number|null}
   */
  getRequiredHQLevel(category, id) {
    return headquarters.requiredLevel(category, id);
  }

  /**
   * Returns the cumulative HQ benefits at the current HQ level.
   * @returns {{ productionBonus: number, attackBonus: number, defenseBonus: number, storageBonus: number }}
   */
  getHQBenefits() {
    return headquarters.benefits(this.getHQLevel());
  }

  /**
   * Number of fully built (level >= 1) instances of a building type.
   * @param {string} buildingId
   * @returns {number}
   */
  getBuiltInstanceCount(buildingId) {
    const instances = this._buildings.get(buildingId) ?? [];
    return instances.filter(i => (i.level ?? 0) >= 1).length;
  }

  /**
   * Reduce the active build timer by `seconds` seconds.
   * If seconds >= 999999, the build completes instantly.
   * @param {number} seconds
   * @returns {{ success: boolean, remaining?: number, reason?: string }}
   */
  reduceActiveTimer(seconds) {
    const active = this._buildQueue[0];
    if (!active?.endsAt) return { success: false, reason: 'No active build in progress.' };
    const now    = Date.now();
    if (active.endsAt <= now) return { success: false, reason: 'Build already complete.' };
    const skipMs = seconds >= 999999 ? active.endsAt - now + 1000 : seconds * 1000;
    active.endsAt = Math.max(now, active.endsAt - skipMs);
    eventBus.emit('building:queueUpdated', this.getBuildQueue());
    const remaining = Math.max(0, active.endsAt - now);
    return { success: true, remaining, completed: remaining <= 0 };
  }

  // ─────────────────────────────────────────────
  // Plot placements (city blueprint positional layer)
  // ─────────────────────────────────────────────

  /** Plot zone for a building type (category → zone). */
  zoneOfBuilding(buildingId) {
    const cfg = BUILDINGS_CONFIG[buildingId];
    return CATEGORY_ZONE[cfg?.category] ?? 'civic';
  }

  /**
   * Guarantee every unlocked instance has a plot. Lazy + idempotent:
   * new games, old saves, and newly-unlocked instance slots all flow
   * through here. Fixed plots (HQ) are honored first.
   */
  _ensurePlacements() {
    const used = new Set(this._placements.values());

    const assign = (instanceId, buildingId) => {
      const zone = this.zoneOfBuilding(buildingId);
      // A plot pinned to this building type takes priority (HQ → civic_hq)
      const pinned = plotsInZone(zone).find(p => p.fixed === buildingId && !used.has(p.id));
      const free   = pinned
        ?? plotsInZone(zone).find(p => !p.fixed && !used.has(p.id))
        ?? null;
      if (!free) {
        console.error(`[BuildingManager] no free ${zone} plot for ${instanceId}`);
        return;
      }
      this._placements.set(instanceId, free.id);
      used.add(free.id);
    };

    for (const cfg of Object.values(BUILDINGS_CONFIG)) {
      const unlockedCount = this._getUnlockedInstanceCount(cfg);
      for (let idx = 0; idx < unlockedCount; idx++) {
        const instanceId = `${cfg.id}_${idx}`;
        if (!this._placements.has(instanceId)) assign(instanceId, cfg.id);
      }
    }
  }

  /** @returns {Map<string, string>} instanceId -> plotId (live placements, gap-filled) */
  getPlacements() {
    this._ensurePlacements();
    return this._placements;
  }

  getPlotOf(instanceId) {
    return this.getPlacements().get(instanceId) ?? null;
  }

  /** @returns {string|null} instanceId occupying the plot, or null if free */
  getInstanceAt(plotId) {
    for (const [instanceId, pid] of this.getPlacements()) {
      if (pid === plotId) return instanceId;
    }
    return null;
  }

  /**
   * Building types the player could start on this plot right now:
   * zone-matching types that still have an unbuilt, unlocked instance.
   * @returns {{ id, name, icon, cost, canAfford, ok, reason }[]}
   */
  getBuildableOnPlot(plotId) {
    const plot = plotById(plotId);
    if (!plot) return [];

    const out = [];
    for (const cfg of Object.values(BUILDINGS_CONFIG)) {
      if (this.zoneOfBuilding(cfg.id) !== plot.zone) continue;
      if (plot.fixed && plot.fixed !== cfg.id) continue;

      const idx = this._findAvailableInstance(cfg.id);
      if (idx === null) continue; // every instance built, queued, or locked

      // Don't offer a build that would teleport: if this instance already holds
      // a reserved plot elsewhere, it's built via its own tile, not from here.
      const homePlot = this._placements.get(`${cfg.id}_${idx}`) ?? null;
      if (homePlot && homePlot !== plotId) continue;

      const cost     = buildingRules.scaleCost(cfg.baseCost, cfg.costMultiplier, 0);
      const reqCheck = buildingRules.checkRequirements(cfg.requires, this._rulesCtx);
      out.push({
        id:        cfg.id,
        name:      cfg.name,
        icon:      cfg.icon,
        effectLabel: cfg.effectLabel ?? '',
        cost,
        canAfford: this._rm.canAfford(cost),
        ok:        reqCheck.met,
        reason:    reqCheck.met ? null : reqCheck.reason,
      });
    }
    return out;
  }

  /**
   * Start a build on a specific empty plot: assigns the plot to an available
   * unbuilt instance, then delegates to build(). Refuses to relocate an instance
   * that already holds a reserved plot — those are built via their own tile — so
   * an empty-plot build can never teleport an existing building. Placement is
   * reverted if the build is rejected.
   * @returns {{ success: boolean, reason?: string }}
   */
  buildOnPlot(buildingId, plotId) {
    const cfg  = BUILDINGS_CONFIG[buildingId];
    const plot = plotById(plotId);
    if (!cfg || !plot) return { success: false, reason: 'Unknown building or plot.' };
    if (this.zoneOfBuilding(buildingId) !== plot.zone) {
      return { success: false, reason: `${cfg.name} can only be built in the ${this.zoneOfBuilding(buildingId)} district.` };
    }
    if (plot.fixed && plot.fixed !== buildingId) {
      return { success: false, reason: 'This plot is reserved.' };
    }

    const occupant = this.getInstanceAt(plotId);
    const idx = this._findAvailableInstance(buildingId);
    if (idx === null) {
      return { success: false, reason: `No ${cfg.name} available — all copies are built or locked.` };
    }
    const instanceId = `${buildingId}_${idx}`;
    if (occupant && occupant !== instanceId) {
      return { success: false, reason: 'This plot is already occupied.' };
    }

    const prevPlot = this._placements.get(instanceId) ?? null;
    if (prevPlot && prevPlot !== plotId) {
      // Already reserved elsewhere — build it from its own tile, don't teleport it here.
      return { success: false, reason: `${cfg.name} already has a spot — tap its tile to build it.` };
    }
    this._placements.set(instanceId, plotId);

    const r = this.build(buildingId, idx);
    if (!r.success) {
      if (prevPlot) this._placements.set(instanceId, prevPlot);
      else this._placements.delete(instanceId);
      return r;
    }
    eventBus.emit('building:relocated', { instanceId, plotId });
    return r;
  }

  /**
   * Move a placed instance to a free plot of the same zone.
   * @returns {{ success: boolean, reason?: string }}
   */
  relocate(instanceId, plotId) {
    const last       = instanceId.lastIndexOf('_');
    const buildingId = instanceId.substring(0, last);
    const cfg  = BUILDINGS_CONFIG[buildingId];
    const plot = plotById(plotId);
    if (!cfg || !plot) return { success: false, reason: 'Unknown building or plot.' };

    const currentPlot = plotById(this.getPlotOf(instanceId) ?? '');
    if (currentPlot?.fixed === buildingId) {
      return { success: false, reason: `${cfg.name} is anchored and cannot be moved.` };
    }
    if (plot.fixed && plot.fixed !== buildingId) {
      return { success: false, reason: 'That plot is reserved.' };
    }
    if (this.zoneOfBuilding(buildingId) !== plot.zone) {
      return { success: false, reason: `${cfg.name} belongs in the ${this.zoneOfBuilding(buildingId)} district.` };
    }
    if (this.getInstanceAt(plotId)) {
      return { success: false, reason: 'That plot is already occupied.' };
    }
    if (this._buildQueue.some(q => q.instanceId === instanceId)) {
      return { success: false, reason: 'Cannot move a building while it is under construction.' };
    }

    this._placements.set(instanceId, plotId);
    eventBus.emit('building:relocated', { instanceId, plotId });
    return { success: true };
  }

  /** First unbuilt (level 0), unqueued, unlocked instance index of a type — or null. */
  _findAvailableInstance(buildingId) {
    const cfg = BUILDINGS_CONFIG[buildingId];
    if (!cfg) return null;
    const unlockedCount = this._getUnlockedInstanceCount(cfg);
    const instances = this._buildings.get(buildingId) ?? [];
    for (let idx = 0; idx < unlockedCount; idx++) {
      const level  = instances[idx]?.level ?? 0;
      const queued = this._buildQueue.some(q => q.buildingId === buildingId && q.instanceIndex === idx);
      if (level === 0 && !queued) return idx;
    }
    return null;
  }

  // ─────────────────────────────────────────────
  // Serialization
  // ─────────────────────────────────────────────

  serialize() {
    const buildings = {};
    for (const [id, instances] of this._buildings) {
      buildings[id] = instances.map(inst => {
        const out = { instanceId: inst.instanceId, level: inst.level };
        if (inst.stock !== undefined) out.stock = { ...inst.stock };
        return out;
      });
    }
    this._ensurePlacements();
    return {
      buildings,
      placements:           Object.fromEntries(this._placements),
      buildQueue:           [...this._buildQueue],
      premiumBuildSlots:    this._premiumBuildSlots,
      shopBuildSlotBought:  this._shopBuildSlotBought,
      automations:          this._cafeteria.getAutomations(),
    };
  }

  deserialize(data) {
    if (!data) return;
    const buildingsData = data.buildings ?? data;

    for (const [id, saved] of Object.entries(buildingsData)) {
      if (!BUILDINGS_CONFIG[id]) continue;
      if (Array.isArray(saved)) {
        // New multi-instance format
        this._buildings.set(id, saved.map((s, idx) => {
          const inst = {
            instanceId: s.instanceId ?? `${id}_${idx}`,
            level:      s.level ?? 0,
          };
          if (s.stock !== undefined) inst.stock = { food: s.stock.food ?? 0, water: s.stock.water ?? 0 };
          return inst;
        }));
      } else {
        // Old single-instance format — auto-migrate to array
        this._buildings.set(id, [{ instanceId: `${id}_0`, level: saved.level ?? 0 }]);
      }
    }

    // Plot placements — migrate old saves (absent) via _ensurePlacements()
    this._placements = new Map(Object.entries(data.placements ?? {}));
    // Drop placements pointing at plots that no longer exist in the blueprint
    for (const [instanceId, pid] of this._placements) {
      if (!plotById(pid)) this._placements.delete(instanceId);
    }
    this._ensurePlacements();

    this._buildQueue = (data.buildQueue ?? []).map(item => ({
      instanceIndex: 0,
      instanceId:    `${item.buildingId}_0`,
      ...item,
    }));
    this._premiumBuildSlots = data.premiumBuildSlots ?? 0;
    this._shopBuildSlotBought = data.shopBuildSlotBought ?? false;
    this._cafeteria.restoreAutomations(data.automations);

    // Backward-compat: old format stored constructionEndsAt on the building object
    for (const [id, saved] of Object.entries(buildingsData)) {
      if (!Array.isArray(saved) && saved.constructionEndsAt &&
          !this._buildQueue.some(q => q.buildingId === id)) {
        this._buildQueue.push({
          buildingId:    id,
          instanceIndex: 0,
          instanceId:    `${id}_0`,
          pendingLevel:  saved._pendingLevel ?? ((saved.level ?? 0) + 1),
          buildTimeSec:  saved._buildTimeSec ?? 60,
          cost:          {},
          startedAt:     saved.startedAt ?? null,
          endsAt:        saved.constructionEndsAt,
        });
      }
    }

    // Immediately apply any queue items whose timer already expired while the
    // game was closed (catches completions that happened < 5s before the page
    // was last saved, which the offline-progress sim would otherwise skip).
    const nowMs = Date.now();
    while (this._buildQueue.length > 0) {
      const head = this._buildQueue[0];
      if (!head.endsAt || head.endsAt > nowMs) break;

      this._buildQueue.shift();
      const { buildingId, instanceIndex, pendingLevel } = head;
      const instances = this._buildings.get(buildingId);
      if (instances) {
        if (!instances[instanceIndex]) {
          instances[instanceIndex] = { instanceId: `${buildingId}_${instanceIndex}`, level: 0 };
        }
        instances[instanceIndex].level = pendingLevel;
      }
      // Assign timer to the next item if it doesn't have one yet
      if (this._buildQueue.length > 0 && !this._buildQueue[0].endsAt) {
        const next = this._buildQueue[0];
        next.startedAt = nowMs;
        next.endsAt    = nowMs + next.buildTimeSec * 1000;
      }
    }

    this._recalculateAllCaps();
    this._notifyRates();
  }

  // ─────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────

  /** @private */
  _getMaxBuildSlots() {
    let slots = 1;
    for (const entry of QUEUE_CONFIG.building) {
      if (entry.slots <= 1) continue;
      if (entry.premium && this._premiumBuildSlots < entry.slots - 2) continue;
      if (entry.requires) {
        const allMet = Object.entries(entry.requires).every(
          ([bId, minLv]) => this.getLevelOf(bId) >= minLv
        );
        if (!allMet) continue;
      }
      slots = entry.slots;
    }
    return slots;
  }

  /** @private */
  _getUnlockedInstanceCount(cfg) {
    const slots = cfg.instanceSlots;
    if (!slots || slots.length === 0) return 1;
    let count = 0;
    for (const slot of slots) {
      if (buildingRules.checkCondition(slot.condition, this._rulesCtx)) count++;
      else break;
    }
    return Math.max(1, count);
  }

  /**
   * Recalculate ALL storage caps by summing contributions from every instance.
   * @private
   */
  _recalculateAllCaps() {
    const { caps, popCap, foodStoreCap, waterStoreCap } =
      buildingEconomy.computeStorageCaps(this._buildings, this._techBonuses);

    for (const [res, cap] of Object.entries(caps)) this._rm.setCap(res, cap);
    this._rm.setPopulationCap(popCap);
    this._rm.setFoodCapacity(foodStoreCap);
    this._rm.setWaterCapacity(waterStoreCap);
  }

  /** @private */
  _notifyRates() {
    const active = buildingEconomy.computeActiveRates(this._buildings, this._economyCtx);
    this._rm.recalculateRates(active);
  }

}
