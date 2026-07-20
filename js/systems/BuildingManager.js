/**
 * BuildingManager.js
 * Manages placing, upgrading, and tracking all base buildings.
 *
 * Multi-instance model: each building type can have multiple independent
 * copies (instances), each with its own level. Instances are unlocked by
 * conditions defined in BUILDINGS_CONFIG.instanceSlots[].
 *
 * Queue design (ADR 0016):
 *  - `_buildQueue` is an ordered array of queue items; an item is ACTIVE while its
 *    `endsAt` is set. Up to `_getMaxBuildSlots()` items run concurrently, plus a
 *    waiting buffer; worker assignment lives in the pure `buildQueue` helpers.
 *  - Each item tracks its own timer (startedAt / endsAt) for serialization safety.
 *  - `_buildings` stores Map<id, [{instanceId, level}]> — only completed levels.
 *  - Resources are spent at queue time, refunded on cancel.
 */
import { eventBus }                                    from '../core/EventBus.js';
import {
  BUILDINGS_CONFIG, QUEUE_CONFIG, CATEGORY_ZONE, inBounds, rectHitsSkeleton,
} from '../entities/GAME_DATA.js';
import { buildingRules } from './building/buildingRules.js';
import { buildQueue } from './building/buildQueue.js';
import { buildingEconomy } from './building/buildingEconomy.js';
import { headquarters } from './building/headquarters.js';
import { CafeteriaService } from './building/CafeteriaService.js';
import { PlacementStore } from './building/placementStore.js';
import { SectorState } from './building/sectorState.js';
import { packAll, findPlacement, footprintOf, buildingIdOf, skeletonOffenderMoves } from './building/cityPacker.js';
import { computeAdjacency, trainTimeMultiplier, productionBonusTotal } from './building/adjacency.js';
import { SECTORS, SECTOR_BY_ID } from '../entities/data/citySectors.js';

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
      getAdjacencyBonus: (iid) => this.getAdjacency(iid).bonus,
    };

    /** Layout adjacency bonuses (ADR 0022 Phase C) — derived from placement, never serialized. */
    this._adjacency = new Map();

    /** Free-placement positions on the cell grid (ADR 0022) — instanceId → {cx,cy,w,h}. */
    this._placement = new PlacementStore();

    /** Rubble-sector expansion state (ADR 0022, Phase B). Core is always clear. */
    this._sectors = new SectorState();
    // Buildable = cleared ground AND clear of the fixed road skeleton (§4 amend).
    this._isRectCleared = (cx, cy, w, h) =>
      this._sectors.isRectCleared(cx, cy, w, h) && !rectHitsSkeleton(cx, cy, w, h);

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
    if (this._gameMode === 'sandbox') {
      for (const active of buildQueue.activeItems(this._buildQueue)) {
        active.endsAt -= dt * 99 * 1000;
      }
      for (const s of SECTORS) {
        if (this._sectors.isClearing(s.id)) this._sectors.startClear(s.id, this._sectors.clearingEndsAt(s.id) - dt * 99 * 1000);
      }
    }
    this._catchup(Date.now());
    this._completeSectorClears(Date.now());

    // ── Cafeteria feeding: auto-restock + drain → shortfall → population ──
    this._cafeteria.update(dt);
  }

  /** Complete any due rubble-sector clears and announce them. @private */
  _completeSectorClears(nowMs) {
    const done = this._sectors.update(nowMs);
    for (const id of done) eventBus.emit('city:sectorCleared', { id });
    if (done.length) eventBus.emit('city:sectorsChanged');
  }

  /**
   * Mathematical offline catchup — completes any queue items due within the
   * offline window and refills freed workers. O(queue_depth), not O(ticks).
   * @param {number} elapsedSec - offline duration, for the cafeteria drain sim
   * @param {number} nowMs - effective 'now' for the offline window
   */
  applyOffline(elapsedSec, nowMs) {
    this._catchup(nowMs);
    this._completeSectorClears(nowMs);

    // Cafeteria drain + population growth/shrinkage for the offline window.
    // Runs after queue completions so any cafeteria/house upgrades are already applied.
    this._cafeteria.applyOffline(elapsedSec);
  }

  /**
   * Complete every active item due by `nowMs`, refilling freed workers as each
   * finishes (cascaded items start retroactively at the completion time), then
   * fill any idle workers at `nowMs`. Emits one `building:queueUpdated` for the
   * whole batch so offline bursts don't spam saves.
   * @private
   */
  _catchup(nowMs) {
    const maxSlots = this._getMaxBuildSlots();
    let changed = false;

    let done;
    while ((done = buildQueue.earliestDue(this._buildQueue, nowMs))) {
      const idx = this._buildQueue.indexOf(done);
      this._buildQueue.splice(idx, 1);

      const { buildingId, instanceIndex, pendingLevel } = done;
      const instances = this._buildings.get(buildingId);
      if (instances) {
        if (!instances[instanceIndex]) {
          instances[instanceIndex] = { instanceId: `${buildingId}_${instanceIndex}`, level: 0 };
        }
        instances[instanceIndex].level = pendingLevel;
      }

      this._recalculateAllCaps();
      this._recalcAdjacency();
      eventBus.emit('building:completed', { id: buildingId, instanceIndex, building: { id: buildingId, level: pendingLevel } });
      buildQueue.fill(this._buildQueue, maxSlots, done.endsAt);
      changed = true;
    }

    const started = buildQueue.fill(this._buildQueue, maxSlots, nowMs);
    if (changed || started.length > 0) {
      eventBus.emit('building:queueUpdated', this.getBuildQueue());
    }
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
      return { ok: false, reason: `${cfg.name} ${instanceIndex + 1} is already at max level.` };
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
        return { ok: false, reason: `Upgrade ${cfg.name} ${instanceIndex} to Lv.${effectiveLevel + 1} first.` };
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
            const name = BUILDINGS_CONFIG[bId]?.shortName ?? BUILDINGS_CONFIG[bId]?.name ?? bId;
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
        missing.push(`${cfg.name} ${instanceIndex} must reach Lv.${effectiveLevel + 1} first`);
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
      return { success: false, reason: `${cfg.name} ${instanceIndex + 1} is already at max level.` };
    }

    const maxSlots = this._getMaxBuildSlots();
    const capacity = buildQueue.capacity(maxSlots);
    if (this._buildQueue.length >= capacity) {
      return {
        success: false,
        reason: `Build queue is full (${this._buildQueue.length}/${capacity}). Build a Construction Hall to unlock more worker slots.`,
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

    const instanceId    = instArr[instanceIndex].instanceId;
    const nowMs         = Date.now();
    const workerFree    = buildQueue.activeItems(this._buildQueue).length < maxSlots;
    const instanceClear = !this._buildQueue.some(q => q.instanceId === instanceId);

    if (buildTimeSec === 0 && workerFree && instanceClear) {
      instArr[instanceIndex].level = pendingLevel;
      this._recalculateAllCaps();
      eventBus.emit('building:completed', { id: buildingId, instanceIndex, building: { id: buildingId, level: pendingLevel } });
      this._recalcAdjacency();
      eventBus.emit('building:started', { id: buildingId, instanceIndex, cost, level: pendingLevel });
      return { success: true };
    }

    this._buildQueue.push({
      buildingId,
      instanceIndex,
      instanceId,
      pendingLevel,
      buildTimeSec,
      cost,
      startedAt: null,
      endsAt:    null,
    });
    buildQueue.fill(this._buildQueue, maxSlots, nowMs);

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
    buildQueue.fill(this._buildQueue, this._getMaxBuildSlots(), Date.now());

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
    const rows = this._buildQueue.map((item, idx) => ({
      ...item,
      queuePosition: idx,
      isActive:      item.endsAt != null,
      waitingPosition: null,
      cfg:           BUILDINGS_CONFIG[item.buildingId],
    }));
    rows.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      if (a.isActive) return a.endsAt - b.endsAt;
      return a.queuePosition - b.queuePosition;
    });
    let waiting = 0;
    for (const row of rows) if (!row.isActive) row.waitingPosition = waiting++;
    return rows;
  }

  /**
   * Returns all building types grouped with per-instance status data and locked slot info.
   * Primary data source for BuildingsUI.
   */
  getBuildingTypesWithInstances() {
    return Object.values(BUILDINGS_CONFIG).map(cfg => {
      const instances     = this._buildings.get(cfg.id) ?? [];
      const unlockedCount = this._getUnlockedInstanceCount(cfg);
      const multiInstance = (cfg.instanceSlots?.length ?? 1) > 1;

      const instanceData = [];
      for (let idx = 0; idx < unlockedCount; idx++) {
        const inst           = instances[idx] ?? { instanceId: `${cfg.id}_${idx}`, level: 0 };
        const completedLevel = inst.level ?? 0;
        const queuedForInst  = this._buildQueue.filter(
          q => q.buildingId === cfg.id && q.instanceIndex === idx
        );
        const queuedCount    = queuedForInst.length;
        const effectiveLevel = completedLevel + queuedCount;
        const activeForInst  = queuedForInst.find(q => q.endsAt != null) ?? null;
        const isActivelyBuilding = activeForInst != null;
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
          displayName:   multiInstance ? `${cfg.name} ${idx + 1}` : cfg.name,
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
    const result    = [];
    const activeIds = new Set(buildQueue.activeItems(this._buildQueue).map(q => q.buildingId));
    for (const [id, instances] of this._buildings) {
      for (const inst of instances) {
        if ((inst.level ?? 0) > 0 || activeIds.has(id)) result.push({ id, ...inst });
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
   * Reduce an active build timer by `seconds` seconds. Targets the item matching
   * `instanceId`, or the earliest-ending active build when omitted.
   * If seconds >= 999999, the build completes instantly.
   * @param {number} seconds
   * @param {string|null} [instanceId]
   * @returns {{ success: boolean, remaining?: number, reason?: string }}
   */
  reduceActiveTimer(seconds, instanceId = null) {
    const active = instanceId
      ? this._buildQueue.find(q => q.endsAt != null && q.instanceId === instanceId)
      : buildQueue.earliestActive(this._buildQueue);
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
  // Free-placement positions (cell grid — ADR 0022)
  // ─────────────────────────────────────────────

  /** District a building type clusters into (category → zone) — packer bias + UI grouping. */
  zoneOfBuilding(buildingId) {
    const cfg = BUILDINGS_CONFIG[buildingId];
    return CATEGORY_ZONE[cfg?.category] ?? 'civic';
  }

  /** Footprint [w,h] in cells for a building type. */
  getFootprint(buildingId) { return footprintOf(buildingId); }

  /** Every currently-unlocked instance id, in config order. @private */
  _unlockedInstanceIds() {
    const ids = [];
    for (const cfg of Object.values(BUILDINGS_CONFIG)) {
      const n = this._getUnlockedInstanceCount(cfg);
      for (let idx = 0; idx < n; idx++) ids.push(`${cfg.id}_${idx}`);
    }
    return ids;
  }

  /**
   * Guarantee every unlocked instance has a cell position. Lazy + idempotent:
   * a fully-unplaced set (new game / legacy save) gets the deterministic packer;
   * newly-unlocked slots on an existing layout are placed incrementally near
   * their district anchor without disturbing the player's arrangement.
   */
  _ensurePlacements(isAllowed = this._isRectCleared) {
    const ids = this._unlockedInstanceIds();
    const unplaced = ids.filter(id => !this._placement.has(id));
    if (unplaced.length === 0) return;

    if (this._placement.rects().length === 0) {
      for (const [id, { cx, cy }] of packAll(ids, isAllowed)) {
        const [w, h] = footprintOf(buildingIdOf(id));
        this._placement.place(id, cx, cy, w, h);
      }
      return;
    }
    for (const id of unplaced) {
      const [w, h] = footprintOf(buildingIdOf(id));
      const slot = findPlacement(this._placement.rects(), id, isAllowed);
      if (slot) this._placement.place(id, slot.cx, slot.cy, w, h);
      else console.error(`[BuildingManager] no free cell rect for ${id}`);
    }
  }

  /** Placement rects for every unlocked instance (renderer scene source). */
  getPlacementRects() {
    this._ensurePlacements();
    return this._placement.rects().map(r => ({
      instanceId:    r.instanceId,
      buildingId:    buildingIdOf(r.instanceId),
      instanceIndex: Number(r.instanceId.slice(r.instanceId.lastIndexOf('_') + 1)),
      cx: r.cx, cy: r.cy, w: r.w, h: r.h,
    }));
  }

  positionOf(instanceId) { return this._placement.positionOf(instanceId); }
  rectOf(instanceId)     { return this._placement.rectOf(instanceId); }

  /** Whether a footprint may sit at (cx,cy) — cleared ground, in bounds, clear of other buildings. */
  rectFree(cx, cy, w, h, exceptId = null) {
    return this._sectors.isRectCleared(cx, cy, w, h) &&
           !rectHitsSkeleton(cx, cy, w, h) &&
           this._placement.rectFree(cx, cy, w, h, exceptId);
  }

  // ── Layout adjacency (pure math in building/adjacency.js — ADR 0022, Phase C) ──

  /** Recompute from the current layout; only BUILT instances count. Emits on change. */
  _recalcAdjacency({ silent = false } = {}) {
    const built = this._placement.rects().filter(r => this.getInstanceLevelOf(r.instanceId) > 0);
    const before = productionBonusTotal(this._adjacency);
    this._adjacency = computeAdjacency(built);
    this._notifyRates();
    if (!silent) {
      eventBus.emit('building:adjacencyChanged', {
        gained: productionBonusTotal(this._adjacency) - before,
      });
    }
  }

  /** @returns {{bonus:number, cluster:number, sameCount:number, pairs:{withId:string,label:string,bonus:number}[]}} */
  getAdjacency(instanceId) {
    return this._adjacency.get(instanceId) ?? { bonus: 0, cluster: 0, sameCount: 0, pairs: [] };
  }

  /** Training-time multiplier granted by clustered military buildings (1 = none). */
  getTrainTimeMultiplier() { return trainTimeMultiplier(this._adjacency); }

  // ── Rubble-sector expansion (delegates to SectorState — ADR 0022, Phase B) ──
  getSectors() { return this._sectors.catalog(this.getHQLevel(), c => this._rm.canAfford(c)); }
  isCellCleared(cx, cy) { return this._sectors.isCellCleared(cx, cy); }

  /** Clear a rubble sector: validate HQ gate + affordability, spend, start the timer. */
  clearSector(id) {
    return this._sectors.requestClear(id, {
      hqLevel: this.getHQLevel(), rm: this._rm, sandbox: this._gameMode === 'sandbox',
    });
  }

  /** HQ is anchored; everything else placed may be moved. */
  isMovable(instanceId) {
    return this._placement.has(instanceId) && buildingIdOf(instanceId) !== 'townhall';
  }

  /**
   * Full "buildables inventory" catalog: every building type with placement
   * status, for the Buildables panel. The UI groups/sorts/filters this list.
   * @returns {Array<{ id, name, icon, category, zone, cost, effectLabel,
   *   builtCount, maxCount, unlocked, lockReason, canAfford, availableToBuild,
   *   hasFreePlot, maxed }>}
   */
  getBuildablesCatalog() {
    const out = [];
    for (const cfg of Object.values(BUILDINGS_CONFIG)) {
      const zone       = this.zoneOfBuilding(cfg.id);
      const instances  = this._buildings.get(cfg.id) ?? [];
      const maxCount    = cfg.instanceSlots?.length ?? cfg.maxInstances ?? 1;
      const builtCount  = instances.filter(i => (i.level ?? 0) > 0).length;
      const reqCheck    = buildingRules.checkRequirements(cfg.requires, this._rulesCtx);
      const unlocked    = reqCheck.met;
      const lockReason  = unlocked
        ? null
        : (reqCheck.reason
            || buildingRules.collectMissing(cfg.requires, this._rulesCtx).join(', ')
            || 'Locked');
      const availableIdx = this._findAvailableInstance(cfg.id);
      const cost         = buildingRules.scaleCost(cfg.baseCost, cfg.costMultiplier, 0);
      // Free placement always has room in the buildable rect; the packer seats it.
      const hasFreePlot  = true;
      out.push({
        id:   cfg.id,
        name: cfg.name,
        icon: cfg.icon,
        category: cfg.category,
        zone,
        cost,
        effectLabel: cfg.effectLabel ?? '',
        builtCount,
        maxCount,
        unlocked,
        lockReason,
        canAfford:        this._rm.canAfford(cost),
        availableToBuild: unlocked && availableIdx !== null,
        hasFreePlot,
        maxed:            builtCount >= maxCount,
      });
    }
    return out;
  }

  /**
   * Build the next available (unbuilt, unlocked, unqueued) instance of a type.
   * The instance already holds a packed cell position, so no plot is chosen.
   * @returns {{ success: boolean, reason?: string }}
   */
  buildNext(buildingId) {
    const cfg = BUILDINGS_CONFIG[buildingId];
    if (!cfg) return { success: false, reason: 'Unknown building.' };
    const idx = this._findAvailableInstance(buildingId);
    if (idx === null) {
      return { success: false, reason: `No ${cfg.name} available — all copies are built or locked.` };
    }
    return this.build(buildingId, idx);
  }

  /**
   * Move a placed building to a free footprint at cell (cx, cy). HQ is anchored;
   * a building under construction can't move; the target must be clear + in bounds.
   * @returns {{ success: boolean, reason?: string }}
   */
  moveBuilding(instanceId, cx, cy) {
    const buildingId = buildingIdOf(instanceId);
    const cfg = BUILDINGS_CONFIG[buildingId];
    if (!cfg) return { success: false, reason: 'Unknown building.' };
    if (!this.isMovable(instanceId)) {
      return { success: false, reason: `${cfg.name} is anchored and cannot be moved.` };
    }
    if (this._buildQueue.some(q => q.instanceId === instanceId)) {
      return { success: false, reason: 'Cannot move a building while it is under construction.' };
    }
    const [w, h] = footprintOf(buildingId);
    if (!this.rectFree(cx, cy, w, h, instanceId)) {
      return { success: false, reason: 'That spot is blocked or still under rubble.' };
    }
    this._placement.move(instanceId, cx, cy);
    this._recalcAdjacency();
    eventBus.emit('building:relocated', { instanceId, cx, cy });
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
      placements:           this._placement.serialize(),
      sectors:              this._sectors.serialize(),
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

    // Cell positions — legacy values (plot-id strings / unknown / out-of-bounds)
    // are dropped, then the packer re-places every unplaced instance (ADR 0022).
    this._placement = new PlacementStore();
    for (const [instanceId, pos] of Object.entries(data.placements ?? {})) {
      const buildingId = buildingIdOf(instanceId);
      if (!BUILDINGS_CONFIG[buildingId]) continue;
      if (!pos || typeof pos.cx !== 'number' || typeof pos.cy !== 'number') continue;
      const [w, h] = footprintOf(buildingId);
      if (!inBounds(pos.cx, pos.cy, w, h)) continue;
      this._placement.place(instanceId, pos.cx, pos.cy, w, h);
    }
    // Sectors before ensurePlacements: grandfather any sector holding a placed
    // instance to cleared so no existing base strands a building under rubble.
    // Legacy saves (no `sectors` key) migrate on the full grid, then every
    // occupied sector is force-cleared so the whole base survives (ADR 0022).
    this._sectors = new SectorState();
    if (data.sectors === undefined) {
      this._ensurePlacements((cx, cy, w, h) => inBounds(cx, cy, w, h) && !rectHitsSkeleton(cx, cy, w, h));
      this._sectors.reconcile(this._placement.rects());
    } else {
      this._sectors.deserialize(data.sectors, this._placement.rects());
      this._ensurePlacements();
    }
    // Legacy saves may sit a building on a now-fixed skeleton cell (§4 amend) —
    // relocate offenders to the nearest free cleared cell via the packer.
    for (const m of skeletonOffenderMoves(this._placement.rects(), this._isRectCleared))
      this._placement.move(m.instanceId, m.cx, m.cy);

    // Adjacency is derived, never saved. Migrated bases land pre-clustered (packer
    // category bias), so a legacy load wakes up already earning — announced once.
    this._recalcAdjacency({ silent: true });
    if (data.placements === undefined && productionBonusTotal(this._adjacency) > 0) {
      eventBus.emit('building:adjacencyDiscovered', {
        total: productionBonusTotal(this._adjacency),
      });
    }

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

    this._recalculateAllCaps();
    this._notifyRates();

    // Drain items that expired while closed and stamp timers on up to N workers
    // (migrates legacy saves that only timed the head item).
    this._catchup(Date.now());
    this._completeSectorClears(Date.now());
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
