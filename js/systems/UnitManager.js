/**
 * UnitManager.js
 * Handles unit training, queue management, and army tracking.
 * Units use a tier system: each base unit type (infantry/ranged/cavalry/siege)
 * has 10 tiers. Reserve and queue keys use the format "infantry_t1", "ranged_t3", etc.
 */
import { eventBus } from '../core/EventBus.js';
import { UNITS_CONFIG, BUILDINGS_CONFIG, UNIT_TIER_REQUIREMENTS } from '../entities/GAME_DATA.js';

export class UnitManager {
  /**
   * @param {import('./ResourceManager.js').ResourceManager} rm
   * @param {import('./BuildingManager.js').BuildingManager} bm
   */
  constructor(rm, bm) {
    this.name = 'UnitManager';
    this._rm = rm;
    this._bm = bm;
    this._tm = null; // set via setTechnologyManager() after TechnologyManager is created
    this._hm = null; // set via setHeroManager()
    /** @type {Map<string, number>} tierKey (e.g. 'infantry_t1') -> count */
    this._reserve = new Map();
    /** @type {Map<string, {id: string, name: string, units: Map<string, number>, slotUnitLinks: Map<number, string>}>} squadId -> squad */
    this._squads = new Map();
    this._squadCounter = 1;
    /** @type {Set<string>} squadIds currently away on a world-map march (runtime-only; MarchManager re-asserts on load) */
    this._deployedSquads = new Set();
    /** @type {Map<string, Array<{count, endsAt, name, icon, tier, tierKey, type?, fromTierKey?, cost}>>} buildingId -> linear queue (max 3, item[0] is active) */
    this._queues = new Map();
    // VIP perk: stacking train time reduction
    this._vipTrainMultiplier = 1.0;
    eventBus.on('user:vipUpdate', ({ perks }) => {
      this._vipTrainMultiplier = 1 - Math.min(0.80, perks?.trainReduction ?? 0);
    });
    // Sandbox mode: near-instant train times
    this._gameMode = 'campaign';
    eventBus.on('game:modeChanged', ({ mode }) => { this._gameMode = mode; });
  }

  setHeroManager(hm) { this._hm = hm; }

  // ── Tier key helpers ───────────────────────────────────────────────────────
  /** @private Returns the tier key for reserve/queue maps. */
  _tierKey(unitId, tier) { return `${unitId}_t${tier}`; }

  /** @private Parses a tier key back to { unitId, tier }. */
  _parseTierKey(key) {
    const lastT = key.lastIndexOf('_t');
    if (lastT === -1) return { unitId: key, tier: 1 }; // legacy key
    return { unitId: key.substring(0, lastT), tier: parseInt(key.substring(lastT + 2)) || 1 };
  }

  /** @param {import('../systems/TechnologyManager.js').TechnologyManager} tm */
  setTechnologyManager(tm) {
    this._tm = tm;
  }

  update(dt) {
    const now = Date.now();
    let queueChanged = false;

    // _queues is keyed by buildingId — one linear queue per building, item[0] is always active
    for (const [buildingId, queueArray] of this._queues.entries()) {
      if (queueArray.length === 0) continue;

      const current = queueArray[0];
      // Sandbox mode: advance each active timer 100× faster
      if (current.endsAt && this._gameMode === 'sandbox') {
        current.endsAt -= dt * 99 * 1000;
      }
      if (now >= current.endsAt) {
        queueArray.shift();

        if (current.type === 'upgrade') {
          // Tier upgrade complete: tierKey and fromTierKey are stored on the item
          const fromCount = this._reserve.get(current.fromTierKey) ?? 0;
          this._reserve.set(current.fromTierKey, Math.max(0, fromCount - current.count));
          const toCount = this._reserve.get(current.tierKey) ?? 0;
          this._reserve.set(current.tierKey, toCount + current.count);
        } else {
          // Regular training: tierKey stored on item
          const existing = this._reserve.get(current.tierKey) ?? 0;
          this._reserve.set(current.tierKey, existing + current.count);
        }

        // Start next item in the building queue
        if (queueArray.length > 0) {
          const next = queueArray[0];
          const { unitId: nxtBaseId, tier: nxtTier } = this._parseTierKey(next.tierKey);
          const nxtCfg     = UNITS_CONFIG[nxtBaseId];
          const nxtTierCfg = nxtCfg?.tiers?.[nxtTier - 1] ?? nxtCfg;
          // B1: apply building-level speed bonus; B2: use upgradeTime for upgrade jobs
          const nxtBldgLevel = this._bm.getLevelOf(buildingId);
          const nxtBldgCfg   = BUILDINGS_CONFIG[buildingId];
          const nxtSlotIdx   = nxtBldgCfg?.trainingSlots ? Math.min(nxtBldgLevel - 1, nxtBldgCfg.trainingSlots.length - 1) : -1;
          const nxtSlotEntry = nxtSlotIdx >= 0 ? nxtBldgCfg.trainingSlots[nxtSlotIdx] : null;
          const nxtTimeMultiplier = nxtSlotEntry?.trainTimeMultiplier ?? 1;
          const durSec = next.type === 'upgrade'
            ? (nxtTierCfg?.upgradeTime ?? Math.ceil((nxtTierCfg?.trainTime ?? 10) * 0.35))
            : (nxtTierCfg?.trainTime ?? 10);
          const trainMs = durSec * 1000 * next.count * this._trainMultiplier() * nxtTimeMultiplier;
          next.startedAt = now;
          next.endsAt = now + trainMs;
        }

        eventBus.emit('unit:trained', { tierKey: current.tierKey, count: current.count });
        eventBus.emit('army:updated');
        queueChanged = true;
      }
    }

    if (queueChanged) {
      eventBus.emit('unit:queueUpdated', this.getAllQueues());
    }
  }

  /** @private VIP + military-cluster adjacency cuts folded with the stationed-hero training bonus. */
  _trainMultiplier() {
    const heroBonus = this._hm?.getHeroGlobalEffects?.().trainingSpeed ?? 0;
    return this._vipTrainMultiplier
      * (this._bm.getTrainTimeMultiplier?.() ?? 1)
      / (1 + heroBonus);
  }

  /**
   * Computes the training duration in ms for a queue item.
   * Mirrors the cascade logic in update() so both paths stay in sync.
   * @private
   */
  _computeTrainMs(item, buildingId) {
    const { unitId, tier } = this._parseTierKey(item.tierKey);
    const cfg      = UNITS_CONFIG[unitId];
    const tierCfg  = cfg?.tiers?.[tier - 1] ?? cfg;
    const bldgLevel  = this._bm.getLevelOf(buildingId);
    const bldgCfg    = BUILDINGS_CONFIG[buildingId];
    const slotIdx    = bldgCfg?.trainingSlots ? Math.min(bldgLevel - 1, bldgCfg.trainingSlots.length - 1) : -1;
    const slotEntry  = slotIdx >= 0 ? bldgCfg.trainingSlots[slotIdx] : null;
    const timeMult   = slotEntry?.trainTimeMultiplier ?? 1;
    const durSec     = item.type === 'upgrade'
      ? (tierCfg?.upgradeTime ?? Math.ceil((tierCfg?.trainTime ?? 10) * 0.35))
      : (tierCfg?.trainTime ?? 10);
    return durSec * 1000 * item.count * this._trainMultiplier() * timeMult;
  }

  /**
   * Mathematical offline catchup — completes any training queue items whose `endsAt`
   * falls within the offline window, cascading each completion to the next item.
   * O(total queue depth across all buildings), not O(ticks).
   * @param {number} _elapsedSec - unused (timestamps are absolute)
   * @param {number} nowMs - effective 'now' for the offline window
   */
  applyOffline(_elapsedSec, nowMs) {
    let anyChanged = false;

    for (const [buildingId, queueArray] of this._queues.entries()) {
      while (queueArray.length > 0 && (queueArray[0].endsAt ?? Infinity) <= nowMs) {
        const item = queueArray.shift();

        if (item.type === 'upgrade') {
          const fromCount = this._reserve.get(item.fromTierKey) ?? 0;
          this._reserve.set(item.fromTierKey, Math.max(0, fromCount - item.count));
          const toCount = this._reserve.get(item.tierKey) ?? 0;
          this._reserve.set(item.tierKey, toCount + item.count);
        } else {
          const existing = this._reserve.get(item.tierKey) ?? 0;
          this._reserve.set(item.tierKey, existing + item.count);
        }

        // Cascade: start the next item from this item's completion time
        if (queueArray.length > 0) {
          const next     = queueArray[0];
          const trainMs  = this._computeTrainMs(next, buildingId);
          next.startedAt = item.endsAt;
          next.endsAt    = item.endsAt + trainMs;
        }

        eventBus.emit('unit:trained', { tierKey: item.tierKey, count: item.count });
        eventBus.emit('army:updated');
        anyChanged = true;
      }
    }

    if (anyChanged) eventBus.emit('unit:queueUpdated', this.getAllQueues());
  }

  /**
   * Reduce the active training timer by `seconds` seconds.
   * Applies to the first active training queue item across all unit types.
   * @param {number} seconds
   * @returns {{ success: boolean, remaining?: number, reason?: string }}
   */
  reduceActiveTrainTimer(seconds) {
    const now = Date.now();
    for (const [, queueArray] of this._queues.entries()) {
      if (queueArray.length === 0) continue;
      const current = queueArray[0];
      if (current.endsAt && current.endsAt > now) {
        const skipMs = (seconds >= 999999 ? current.endsAt - now + 1000 : seconds * 1000);
        current.endsAt = Math.max(now, current.endsAt - skipMs);
        eventBus.emit('unit:queueUpdated', this.getAllQueues());
        const remaining = Math.max(0, current.endsAt - now);
        return { success: true, remaining, completed: remaining <= 0 };
      }
    }
    return { success: false, reason: 'No units are currently training.' };
  }

  /**
   * Queue a unit tier for training.
   * @param {string} unitId  Base unit type: 'infantry', 'ranged', 'cavalry', 'siege'
   * @param {number} count
   * @param {number} [tier=1]  Tier 1–10
   * @returns {{ success: boolean, reason?: string }}
   */
  train(unitId, count = 1, tier = 1) {
    const cfg = UNITS_CONFIG[unitId];
    if (!cfg) return { success: false, reason: 'Unknown unit type.' };
    if (tier < 1 || tier > (cfg.tiers?.length ?? 1)) {
      return { success: false, reason: `Invalid tier ${tier} for ${cfg.name}.` };
    }

    // HQ unlock gate — base unit type must be unlocked by current HQ level
    if (!this._bm.getHQUnlockedIds('units').has(unitId)) {
      const reqLv = this._bm.getRequiredHQLevel('units', unitId);
      return { success: false, reason: reqLv ? `Requires HQ Lv.${reqLv}` : 'Not yet unlockable.' };
    }

    const tierCfg = cfg.tiers?.[tier - 1] ?? cfg;

    // Tech gate for tier 4+
    if (tier >= 4 && tierCfg.techRequired) {
      const tierReq   = UNIT_TIER_REQUIREMENTS?.[unitId]?.[tier];
      const techLevel = this._tm?.getLevelOf(tierCfg.techRequired) ?? 0;
      const neededLevel = tierReq?.minTechLevel ?? (tier - 3);
      if (techLevel < neededLevel) {
        const techName = tierCfg.techRequired.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return { success: false, reason: `Requires ${techName} Lv.${neededLevel} to train Tier ${tier}.` };
      }
    }

    // Building-level gate per tier (from UNIT_TIER_REQUIREMENTS)
    const tierReq = UNIT_TIER_REQUIREMENTS?.[unitId]?.[tier];
    if (tierReq?.minBuildingLevel > 1) {
      const bldgLevel = this._bm.getLevelOf(cfg.buildingId);
      if (bldgLevel < tierReq.minBuildingLevel) {
        const bldgName = BUILDINGS_CONFIG[cfg.buildingId]?.name ?? cfg.buildingId;
        return { success: false, reason: `Requires ${bldgName} Lv.${tierReq.minBuildingLevel} to train Tier ${tier} ${cfg.name}.` };
      }
    }

    const tierKey  = this._tierKey(unitId, tier);

    // Building requirement (unit's buildingId must be built)
    const requiredBldg = cfg.buildingId;
    if (requiredBldg && this._bm.getLevelOf(requiredBldg) < 1) {
      const bldgName = BUILDINGS_CONFIG[requiredBldg]?.name ?? requiredBldg;
      return { success: false, reason: `Requires ${bldgName} to be built.` };
    }

    // Building tier gate + batch size cap (from trainingSlots table)
    const bldgLevel   = this._bm.getLevelOf(requiredBldg ?? '');
    const bldgCfg     = BUILDINGS_CONFIG[requiredBldg];
    const slotEntry   = bldgCfg?.trainingSlots?.[Math.min(bldgLevel - 1, (bldgCfg.trainingSlots?.length ?? 1) - 1)];
    if (slotEntry) {
      const maxTier = slotEntry.maxTrainableTier ?? 99;
      if (tier > maxTier) {
        // Find the level that first allows this tier
        const neededLv = (bldgCfg.trainingSlots ?? []).findIndex(s => (s.maxTrainableTier ?? 0) >= tier);
        const bldgName = bldgCfg?.name ?? requiredBldg;
        return { success: false, reason: `${bldgName} Lv.${neededLv + 1} required to train Tier ${tier} units.` };
      }
      const maxBatch = slotEntry.maxBatchSize ?? Infinity;
      if (count > maxBatch) {
        return { success: false, reason: `Max ${maxBatch} units per batch at this building level.` };
      }
    }

    // Building queue cap — one linear queue per building, max 3 items
    const buildingQueue = this._queues.get(requiredBldg) || [];
    if (buildingQueue.length >= 3) {
      const bldgName = BUILDINGS_CONFIG[requiredBldg]?.name ?? requiredBldg;
      return { success: false, reason: `${bldgName} training queue is full (max 3 jobs). Wait for a job to complete.` };
    }

    // Scale cost by count
    const totalCost = {};
    for (const [res, amt] of Object.entries(tierCfg.cost)) {
      totalCost[res] = amt * count;
    }

    if (!this._rm.canAfford(totalCost)) return { success: false, reason: 'Insufficient resources.' };
    this._rm.spend(totalCost);

    // B1: apply building-level speed bonus
    const timeMultiplier = slotEntry?.trainTimeMultiplier ?? 1;
    const trainMs   = (tierCfg.trainTime ?? 10) * 1000 * count * this._trainMultiplier() * timeMultiplier;
    const isFirst   = buildingQueue.length === 0;
    const now       = Date.now();

    buildingQueue.push({
      count, tier, tierKey,
      cost: totalCost,
      endsAt:    isFirst ? now + trainMs : 0,
      startedAt: isFirst ? now : 0,
      name: tierCfg.name,
      icon: cfg.icon,
    });
    this._queues.set(requiredBldg, buildingQueue);

    eventBus.emit('unit:queueUpdated', this.getAllQueues());
    return { success: true };
  }

  /**
   * Upgrade units in reserve from one tier to the next.
   * @param {string} unitId
   * @param {number} fromTier
   * @param {number} count
   * @returns {{ success: boolean, reason?: string }}
   */
  upgradeTier(unitId, fromTier, count) {
    const cfg = UNITS_CONFIG[unitId];
    if (!cfg) return { success: false, reason: 'Unknown unit type.' };
    const toTier = fromTier + 1;
    if (toTier > (cfg.tiers?.length ?? 1)) {
      return { success: false, reason: 'Already at maximum tier.' };
    }

    const fromTierCfg = cfg.tiers?.[fromTier - 1];
    const destTierCfg = cfg.tiers?.[toTier - 1];
    if (!destTierCfg?.upgradeCost) {
      return { success: false, reason: 'This tier cannot be upgraded.' };
    }

    // Check tech requirement for destination tier
    if (destTierCfg?.techRequired) {
      const tierReq     = UNIT_TIER_REQUIREMENTS?.[unitId]?.[toTier];
      const neededLevel = tierReq?.minTechLevel ?? (toTier - 3);
      if ((this._tm?.getLevelOf(destTierCfg.techRequired) ?? 0) < neededLevel) {
        const techName = destTierCfg.techRequired.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return { success: false, reason: `Requires ${techName} Lv.${neededLevel}.` };
      }
    }

    // Building-level gate for destination tier
    const destTierReq = UNIT_TIER_REQUIREMENTS?.[unitId]?.[toTier];
    if (destTierReq?.minBuildingLevel > 1) {
      const bldgLevel = this._bm.getLevelOf(cfg.buildingId);
      if (bldgLevel < destTierReq.minBuildingLevel) {
        const bldgName = BUILDINGS_CONFIG[cfg.buildingId]?.name ?? cfg.buildingId;
        return { success: false, reason: `Requires ${bldgName} Lv.${destTierReq.minBuildingLevel} to upgrade to Tier ${toTier}.` };
      }
    }

    const fromKey = this._tierKey(unitId, fromTier);
    const available = this._reserve.get(fromKey) ?? 0;
    if (available < count) {
      return { success: false, reason: `Not enough T${fromTier} ${cfg.name} in reserve (have ${available}, need ${count}).` };
    }

    // Building queue cap — one linear queue per building, max 3 items
    const upgBuildingQueue = this._queues.get(cfg.buildingId) || [];
    if (cfg.buildingId && upgBuildingQueue.length >= 3) {
      const bldgName = BUILDINGS_CONFIG[cfg.buildingId]?.name ?? cfg.buildingId;
      return { success: false, reason: `${bldgName} training queue is full (max 3 jobs). Wait for a job to complete.` };
    }

    // Cost: use the destination tier's defined upgradeCost (cheaper than training from scratch)
    const totalCost = {};
    for (const [res, amt] of Object.entries(destTierCfg.upgradeCost)) {
      totalCost[res] = amt * count;
    }
    if (!this._rm.canAfford(totalCost)) return { success: false, reason: 'Insufficient resources for upgrade.' };
    this._rm.spend(totalCost);

    // Remove from fromTier reserve immediately (held in queue until completion)
    this._reserve.set(fromKey, available - count);

    // Queue the upgrade job in the building's linear queue
    const toKey      = this._tierKey(unitId, toTier);
    const upgradeTimeSec = destTierCfg.upgradeTime ?? Math.ceil((destTierCfg.trainTime ?? 10) * 0.35);
    // B1: apply building-level speed bonus for upgrades
    const upgBldgLevel  = this._bm.getLevelOf(cfg.buildingId ?? '');
    const upgBldgCfg    = BUILDINGS_CONFIG[cfg.buildingId];
    const upgSlotIdx    = upgBldgCfg?.trainingSlots ? Math.min(upgBldgLevel - 1, upgBldgCfg.trainingSlots.length - 1) : -1;
    const upgSlotEntry  = upgSlotIdx >= 0 ? upgBldgCfg.trainingSlots[upgSlotIdx] : null;
    const upgTimeMultiplier = upgSlotEntry?.trainTimeMultiplier ?? 1;
    const trainMs  = upgradeTimeSec * 1000 * count * this._trainMultiplier() * upgTimeMultiplier;
    const isFirst  = upgBuildingQueue.length === 0;
    const now      = Date.now();

    upgBuildingQueue.push({
      count, tier: toTier, tierKey: toKey,
      type: 'upgrade',
      fromTierKey: fromKey,
      cost: totalCost,
      endsAt:    isFirst ? now + trainMs : 0,
      startedAt: isFirst ? now : 0,
      name: `Upgrade → ${destTierCfg?.name ?? `T${toTier}`}`,
      icon: cfg.icon,
    });
    this._queues.set(cfg.buildingId, upgBuildingQueue);

    eventBus.emit('unit:queueUpdated', this.getAllQueues());
    return { success: true };
  }

  cancelTrain(buildingId, index) {
    const queue = this._queues.get(buildingId);
    if (!queue || index < 0 || index >= queue.length) return { success: false };

    const item = queue[index];

    // Refund resources — all items store cost directly
    const refund = {};
    for (const [res, amt] of Object.entries(item.cost ?? {})) {
      refund[res] = amt;
    }
    this._rm.add(refund);

    // If cancelling an upgrade job, restore the fromTier units to reserve
    if (item.type === 'upgrade' && item.fromTierKey) {
      const fromCount = this._reserve.get(item.fromTierKey) ?? 0;
      this._reserve.set(item.fromTierKey, fromCount + item.count);
    }

    // Remove from queue
    queue.splice(index, 1);

    // If we removed the active item, start the next one
    if (index === 0 && queue.length > 0) {
      const next = queue[0];
      const { unitId: nxtUnitId, tier: nxtTier } = this._parseTierKey(next.tierKey);
      const nxtCfg     = UNITS_CONFIG[nxtUnitId];
      const nxtTierCfg = nxtCfg?.tiers?.[nxtTier - 1] ?? nxtCfg;
      // B1: apply building-level speed bonus; B2: use upgradeTime for upgrade jobs
      const cxlBldgLevel = this._bm.getLevelOf(buildingId);
      const cxlBldgCfg   = BUILDINGS_CONFIG[buildingId];
      const cxlSlotIdx   = cxlBldgCfg?.trainingSlots ? Math.min(cxlBldgLevel - 1, cxlBldgCfg.trainingSlots.length - 1) : -1;
      const cxlSlotEntry = cxlSlotIdx >= 0 ? cxlBldgCfg.trainingSlots[cxlSlotIdx] : null;
      const cxlTimeMultiplier = cxlSlotEntry?.trainTimeMultiplier ?? 1;
      const cxlDurSec = next.type === 'upgrade'
        ? (nxtTierCfg?.upgradeTime ?? Math.ceil((nxtTierCfg?.trainTime ?? 10) * 0.35))
        : (nxtTierCfg?.trainTime ?? 10);
      next.startedAt = Date.now();
      next.endsAt = next.startedAt + (cxlDurSec * 1000 * next.count * this._trainMultiplier() * cxlTimeMultiplier);
    }

    if (queue.length === 0) {
      this._queues.delete(buildingId);
    }

    eventBus.emit('unit:queueUpdated', this.getAllQueues());
    eventBus.emit('army:updated');
    return { success: true };
  }

  // Gets a flat array of all queue items for UI rendering
  getAllQueues() {
    const all = [];
    for (const [buildingId, queueArray] of this._queues.entries()) {
      queueArray.forEach((item, index) => {
        const { unitId, tier } = this._parseTierKey(item.tierKey);
        all.push({ ...item, unitId, tier, buildingId, queueIndex: index });
      });
    }
    return all;
  }

  getReserve() {
    const result = [];
    for (const [tierKey, count] of this._reserve) {
      if (count <= 0) continue;
      const { unitId, tier } = this._parseTierKey(tierKey);
      const cfg     = UNITS_CONFIG[unitId];
      const tierCfg = cfg?.tiers?.[tier - 1];
      if (!cfg || !tierCfg) continue;
      result.push({
        unitId, tier, tierKey, count,
        name: tierCfg.name,
        icon: cfg.icon,
        category: cfg.category,
        buildingId: cfg.buildingId,
        stats: tierCfg.stats,
        cost: tierCfg.cost,
        upgradeCost: tierCfg.upgradeCost ?? null,
        techRequired: tierCfg.techRequired ?? null,
      });
    }
    return result;
  }

  getSquads() {
    return Array.from(this._squads.values()).map(s => {
      const units = [];
      for (const [tierKey, count] of s.units) {
        if (count <= 0) continue;
        const { unitId, tier } = this._parseTierKey(tierKey);
        const cfg     = UNITS_CONFIG[unitId];
        const tierCfg = cfg?.tiers?.[tier - 1];
        if (!cfg || !tierCfg) continue;
        units.push({ unitId, tier, tierKey, count, name: tierCfg.name, icon: cfg.icon, category: cfg.category, stats: tierCfg.stats, buildingId: cfg.buildingId });
      }
      return { ...s, units, deployed: this._deployedSquads.has(s.id), slotUnitLinks: s.slotUnitLinks ?? new Map(), slotUnits: s.slotUnits ?? new Map() };
    });
  }

  /** Mark/unmark a squad as away on a world-map march (runtime-only). */
  setSquadDeployed(squadId, deployed) {
    if (deployed) this._deployedSquads.add(squadId);
    else this._deployedSquads.delete(squadId);
  }

  isSquadDeployed(squadId) {
    return this._deployedSquads.has(squadId);
  }

  getSquad(squadId) {
    const squad = this._squads.get(squadId);
    if (!squad) return null;
    const units = [];
    for (const [tierKey, count] of squad.units) {
      if (count <= 0) continue;
      const { unitId, tier } = this._parseTierKey(tierKey);
      const cfg     = UNITS_CONFIG[unitId];
      const tierCfg = cfg?.tiers?.[tier - 1];
      if (!cfg || !tierCfg) continue;
      units.push({ unitId, tier, tierKey, count, name: tierCfg.name, icon: cfg.icon, category: cfg.category, stats: tierCfg.stats, buildingId: cfg.buildingId });
    }
    return { ...squad, units, deployed: this._deployedSquads.has(squad.id), slotUnitLinks: squad.slotUnitLinks ?? new Map(), slotUnits: squad.slotUnits ?? new Map() };
  }

  /**
   * Get per-slot unit info (one type+tier per slot).
   * @param {string} squadId
   * @param {number} slotIndex
   * @returns {{ tierKey: string, unitId: string, tier: number, count: number, name: string, icon: string } | null}
   */
  getSlotUnit(squadId, slotIndex) {
    const squad = this._squads.get(squadId);
    if (!squad) return null;
    const entry = (squad.slotUnits ?? new Map()).get(slotIndex);
    if (!entry || entry.count <= 0) return null;
    const { unitId, tier } = this._parseTierKey(entry.tierKey);
    const cfg = UNITS_CONFIG[unitId];
    const tierCfg = cfg?.tiers?.[tier - 1];
    return { tierKey: entry.tierKey, unitId, tier, count: entry.count, name: tierCfg?.name ?? unitId, icon: cfg?.icon ?? '⚔️' };
  }

  /**
   * Remove all units owned by a slot, return them to reserve, and clear the slot link.
   * @param {string} squadId
   * @param {number} slotIndex
   */
  clearSlotUnits(squadId, slotIndex) {
    const squad = this._squads.get(squadId);
    if (!squad) return { success: false, reason: 'Squad not found' };
    if (!squad.slotUnits) squad.slotUnits = new Map();
    const entry = squad.slotUnits.get(slotIndex);
    if (entry && entry.count > 0) {
      const squadCount = squad.units.get(entry.tierKey) ?? 0;
      squad.units.set(entry.tierKey, Math.max(0, squadCount - entry.count));
      const reserveCount = this._reserve.get(entry.tierKey) ?? 0;
      this._reserve.set(entry.tierKey, reserveCount + entry.count);
    }
    squad.slotUnits.delete(slotIndex);
    squad.slotUnitLinks?.delete(slotIndex);
    eventBus.emit('army:updated');
    return { success: true };
  }

  createSquad(name, barracksInstanceId = null) {
    const maxSquads = this.getMaxSquads();
    if (this._squads.size >= maxSquads) {
      return { success: false, reason: `Squad limit reached (${maxSquads}). Build another Barracks to unlock a new squad slot.` };
    }
    const id = 'squad_' + this._squadCounter++;
    this._squads.set(id, { id, name, barracksInstanceId, units: new Map(), slotUnitLinks: new Map(), slotUnits: new Map() });
    eventBus.emit('army:updated');
    return { success: true, squadId: id };
  }

  /**
   * Returns how many squads can be created — one per built Barracks instance.
   * Each Barracks instance is unlocked by HQ level (see BUILDINGS_CONFIG.barracks.instanceSlots).
   * @returns {number}
   */
  getMaxSquads() {
    return this._bm.getBuiltInstanceCount('barracks');
  }

  /**
   * Count how many training (and upgrade) queue items are queued for a given building.
   * Used by the UI to display queue depth and enforce concurrent-slot limits.
   * @param {string} buildingId
   * @returns {number}
   */
  getTrainingQueueDepthForBuilding(buildingId) {
    return this._queues.get(buildingId)?.length ?? 0;
  }

  /**
   * Returns the maximum concurrent training slots for a building at its current level.
   * Reads from BUILDINGS_CONFIG[buildingId].trainingSlots if defined.
   * @private
   * @param {string} buildingId
   * @returns {number}
   */
  _getBuildingSlots(buildingId) {
    const level = this._bm.getLevelOf(buildingId);
    const cfg   = BUILDINGS_CONFIG[buildingId];
    if (!cfg?.trainingSlots || level <= 0) return 1;
    const idx = Math.min(level - 1, cfg.trainingSlots.length - 1);
    return cfg.trainingSlots[idx]?.concurrentSlots ?? 1;
  }

  renameSquad(squadId, newName) {
    const squad = this._squads.get(squadId);
    if (!squad) return { success: false, reason: 'Squad not found' };
    squad.name = newName;
    eventBus.emit('army:updated');
    return { success: true };
  }

  deleteSquad(squadId) {
    const squad = this._squads.get(squadId);
    if (!squad) return { success: false, reason: 'Squad not found' };
    if (this._deployedSquads.has(squadId)) {
      return { success: false, reason: 'Squad is deployed on a march and cannot be deleted.' };
    }

    for (const [unitId, count] of squad.units) {
      const reserveTargetCount = this._reserve.get(unitId) ?? 0;
      this._reserve.set(unitId, reserveTargetCount + count);
    }
    
    this._squads.delete(squadId);
    eventBus.emit('army:updated');
    return { success: true };
  }

  /**
   * Link a slot index to a unit type for strategic effectiveness bonus.
   * @param {string} squadId
   * @param {number} slotIndex  0-based slot index
   * @param {string} unitType   'infantry' | 'ranged' | 'cavalry' | 'siege'
   */
  linkSlotUnit(squadId, slotIndex, unitType) {
    const squad = this._squads.get(squadId);
    if (!squad) return { success: false, reason: 'Squad not found' };
    if (!squad.slotUnitLinks) squad.slotUnitLinks = new Map();
    squad.slotUnitLinks.set(slotIndex, unitType);
    eventBus.emit('army:updated');
    return { success: true };
  }

  /**
   * Remove the slot-unit link for a given slot.
   * @param {string} squadId
   * @param {number} slotIndex
   */
  unlinkSlotUnit(squadId, slotIndex) {
    return this.clearSlotUnits(squadId, slotIndex);
  }

  /**
   * @param {string} squadId
   * @param {string} unitId
   * @param {number} count
   * @param {number} [tier=1]
   * @param {number|null} [slotIndex=null]  When provided, tracks per-slot ownership.
   */
  assignToSquad(squadId, unitId, count, tier = 1, slotIndex = null) {
    if (count <= 0) return { success: false, reason: 'Invalid count' };
    const squad = this._squads.get(squadId);
    if (!squad) return { success: false, reason: 'Squad not found' };
    const tierKey = this._tierKey(unitId, tier);
    const reserveCount = this._reserve.get(tierKey) ?? 0;
    if (reserveCount < count) return { success: false, reason: 'Not enough in reserve' };

    // Per-slot unit capacity gated by that barracks instance's level
    if (slotIndex !== null) {
      const bldgCfg  = BUILDINGS_CONFIG['barracks'];
      const levelStats = bldgCfg?.levelStats;
      if (levelStats) {
        const instId   = squad.barracksInstanceId;
        const bldgLevel = instId
          ? (this._bm.getInstanceLevelOf?.(instId) ?? this._bm.getLevelOf('barracks'))
          : this._bm.getLevelOf('barracks');
        if (bldgLevel > 0) {
          const stats   = levelStats[Math.min(bldgLevel - 1, levelStats.length - 1)];
          const cap     = stats?.slotCapacity ?? Infinity;
          const existing = squad.slotUnits?.get(slotIndex);
          const existingCount = (existing?.tierKey === tierKey ? existing.count : 0);
          if (existingCount + count > cap) {
            const nextLvlIdx = levelStats.findIndex((s, i) => i > bldgLevel - 1 && (s.slotCapacity ?? 0) >= existingCount + count);
            const hint = nextLvlIdx >= 0 ? ` Upgrade Barracks to Lv.${nextLvlIdx + 1} for more.` : '';
            return { success: false, reason: `Slot capacity full (${cap.toLocaleString()} units max).${hint}` };
          }
        }
      }
    }

    // If adding to a slot and the slot already has a different tier, clear the old one first
    if (slotIndex !== null) {
      if (!squad.slotUnits) squad.slotUnits = new Map();
      const existing = squad.slotUnits.get(slotIndex);
      if (existing && existing.tierKey !== tierKey) {
        // Return old tier's units to reserve
        const oldCount = squad.units.get(existing.tierKey) ?? 0;
        squad.units.set(existing.tierKey, Math.max(0, oldCount - existing.count));
        this._reserve.set(existing.tierKey, (this._reserve.get(existing.tierKey) ?? 0) + existing.count);
        squad.slotUnits.delete(slotIndex);
      }
    }

    this._reserve.set(tierKey, reserveCount - count);
    squad.units.set(tierKey, (squad.units.get(tierKey) ?? 0) + count);

    if (slotIndex !== null) {
      if (!squad.slotUnits) squad.slotUnits = new Map();
      const prev = squad.slotUnits.get(slotIndex);
      squad.slotUnits.set(slotIndex, { tierKey, count: (prev?.tierKey === tierKey ? prev.count : 0) + count });
    }

    eventBus.emit('army:updated');
    return { success: true };
  }

  removeFromSquad(squadId, unitId, count, tier = 1) {
    if (count <= 0) return { success: false, reason: 'Invalid count' };
    const squad = this._squads.get(squadId);
    if (!squad) return { success: false, reason: 'Squad not found' };
    const tierKey = this._tierKey(unitId, tier);
    const squadCount = squad.units.get(tierKey) ?? 0;
    if (squadCount < count) return { success: false, reason: 'Not enough in squad' };

    this._removeSquadUnits(squad, tierKey, count);
    const reserveTargetCount = this._reserve.get(tierKey) ?? 0;
    this._reserve.set(tierKey, reserveTargetCount + count);
    eventBus.emit('army:updated');
    return { success: true };
  }

  /**
   * @private Removes up to `count` of `tierKey` from a squad, keeping `squad.units`
   * and `squad.slotUnits` in sync. The single point every squad-membership removal
   * (manual unassign, combat losses) must route through, so slotUnits can never go
   * stale relative to units.
   * @returns {number} amount actually removed
   */
  _removeSquadUnits(squad, tierKey, count) {
    const current = squad.units.get(tierKey) ?? 0;
    const removed = Math.min(current, count);
    if (removed <= 0) return 0;
    squad.units.set(tierKey, current - removed);
    if (squad.slotUnits) {
      let remaining = removed;
      for (const [slotIndex, entry] of squad.slotUnits) {
        if (remaining <= 0) break;
        if (entry.tierKey !== tierKey) continue;
        const take = Math.min(entry.count, remaining);
        entry.count -= take;
        remaining -= take;
        if (entry.count <= 0) squad.slotUnits.delete(slotIndex);
      }
    }
    return removed;
  }

  getTotalUnitCount() {
    let total = 0;
    for (const count of this._reserve.values()) total += count;
    for (const squad of this._squads.values()) {
      for (const count of squad.units.values()) total += count;
    }
    return total;
  }

  /** Remove units (for combat losses) — losses keyed by tierKey */
  removeUnitsFromSquad(squadId, losses) {
    const squad = this._squads.get(squadId);
    if (!squad) return;
    for (const [key, count] of Object.entries(losses)) {
      // Support both tierKey ('infantry_t1') and legacy unitId ('footman')
      const tierKey = key.includes('_t') ? key : this._tierKey(key, 1);
      this._removeSquadUnits(squad, tierKey, count);
    }
    eventBus.emit('army:updated');
  }

  _checkRequirements(requires) {
    if (!requires) return { met: true };
    for (const [key, minLevel] of Object.entries(requires)) {
      // If the key is a known building, check building level
      if (BUILDINGS_CONFIG[key] !== undefined) {
        if (this._bm.getLevelOf(key) < minLevel) {
          const name = BUILDINGS_CONFIG[key]?.name ?? key;
          return { met: false, reason: `Requires ${name} Lv.${minLevel}` };
        }
      } else {
        // Treat as a technology requirement — minLevel acts as minimum research level
        const researchedLevel = this._tm?.getLevelOf(key) ?? 0;
        if (researchedLevel < minLevel) {
          // Format tech name from camelCase/snake_case to readable
          const techName = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          return { met: false, reason: `Requires ${techName}` };
        }
      }
    }
    return { met: true };
  }

  serialize() {
    const serializedSquads = {};
    for (const [id, squad] of this._squads.entries()) {
      serializedSquads[id] = {
        id:                 squad.id,
        name:               squad.name,
        barracksInstanceId: squad.barracksInstanceId ?? null,
        units:              Object.fromEntries(squad.units),
        slotUnitLinks:      Object.fromEntries(
          [...(squad.slotUnitLinks ?? new Map()).entries()].map(([k, v]) => [String(k), v])
        ),
        slotUnits: Object.fromEntries(
          [...(squad.slotUnits ?? new Map()).entries()].map(([k, v]) => [String(k), v])
        ),
      };
    }
    return {
      reserve:      Object.fromEntries(this._reserve),
      squads:       serializedSquads,
      squadCounter: this._squadCounter,
      queues:       Object.fromEntries(
        [...this._queues.entries()].map(([k, v]) => [k, v])
      ),
    };
  }

  deserialize(data) {
    if (!data) return;

    // Migration map: legacy flat unitId -> tierKey
    const LEGACY_MIGRATION = {
      footman: 'infantry_t1',
      archer:  'ranged_t1',
      knight:  'infantry_t4',
      mage:    'siege_t1',
    };
    const migrateKey = key => LEGACY_MIGRATION[key] ?? (key.includes('_t') ? key : null);
    
    const rawReserve = data.army ?? data.reserve ?? {};
    this._reserve = new Map();
    for (const [key, count] of Object.entries(rawReserve)) {
      const tierKey = migrateKey(key);
      if (tierKey && count > 0) {
        this._reserve.set(tierKey, (this._reserve.get(tierKey) ?? 0) + count);
      }
    }

    this._squads = new Map();
    if (data.squads) {
      for (const [id, s] of Object.entries(data.squads)) {
        const units = new Map();
        for (const [key, count] of Object.entries(s.units ?? {})) {
          const tierKey = migrateKey(key);
          if (tierKey && count > 0) units.set(tierKey, (units.get(tierKey) ?? 0) + count);
        }
        // Build slotUnitLinks — migrate legacy heroUnitLinks saves by assigning in slot order
        let slotUnitLinks = new Map();
        if (s.slotUnitLinks && Object.keys(s.slotUnitLinks).length > 0) {
          for (const [k, v] of Object.entries(s.slotUnitLinks)) {
            slotUnitLinks.set(Number(k), v);
          }
        } else if (s.heroUnitLinks) {
          let slotIdx = 0;
          for (const v of Object.values(s.heroUnitLinks)) {
            slotUnitLinks.set(slotIdx++, v);
          }
        }
        // Restore per-slot unit counts
        let slotUnits = new Map();
        if (s.slotUnits) {
          for (const [k, v] of Object.entries(s.slotUnits)) {
            if (v && v.tierKey) slotUnits.set(Number(k), { tierKey: migrateKey(v.tierKey) ?? v.tierKey, count: v.count ?? 0 });
          }
        }
        this._squads.set(id, { id: s.id, name: s.name, barracksInstanceId: s.barracksInstanceId ?? null, units, slotUnitLinks, slotUnits });
      }
    }
    this._squadCounter = data.squadCounter ?? 1;

    this._queues = new Map();
    if (data.queues) {
      const now = Date.now();
      for (const [key, arr] of Object.entries(data.queues)) {
        const adjustedArray = arr.map(q => ({
          ...q,
          tierKey: q.tierKey ?? (migrateKey(key) ?? key), // ensure tierKey on item
          endsAt: q.endsAt > 0 && q.endsAt < now ? now : q.endsAt,
        }));
        // If the key looks like a tierKey (old format: 'infantry_t1'), migrate to buildingId
        const isTierKey = /_t\d+$/.test(key);
        if (isTierKey) {
          const resolvedTierKey = migrateKey(key) ?? key;
          const { unitId } = this._parseTierKey(resolvedTierKey);
          const buildingId = UNITS_CONFIG[unitId]?.buildingId ?? key;
          const existing = this._queues.get(buildingId) ?? [];
          this._queues.set(buildingId, [...existing, ...adjustedArray]);
        } else {
          // Already a buildingId key (new format)
          const existing = this._queues.get(key) ?? [];
          this._queues.set(key, [...existing, ...adjustedArray]);
        }
      }
    }
  }
}
