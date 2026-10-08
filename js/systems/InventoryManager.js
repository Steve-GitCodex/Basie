/**
 * InventoryManager.js
 * Manages the player's item inventory.
 * Items include hero recruitment cards (specific and universal) and XP bundles.
 * Items are added via quest/achievement rewards, welcome mail, or future shop purchases.
 */
import { eventBus } from '../core/EventBus.js';
import { INVENTORY_ITEMS } from '../entities/GAME_DATA.js';
import { BATCHABLE, HERO_XP_TYPES, xpPerUnit, resourceYield } from './inventory/itemYield.js';

/**
 * Tier ladder for each resource type — matched to the entries in economy.js.
 * Listed smallest → largest; used by _splitIntoTierBundles() for greedy decomposition.
 */
/** @see docs/20-decisions — Task 1 renamed universal cards; fold legacy saves onto the new ids. */
const LEGACY_ITEM_ID_ALIASES = {
  card_common: 'card_normal',
  card_rare:   'card_epic',
  scroll_common:    'token_normal',
  scroll_rare:      'token_epic',
  scroll_legendary: 'token_legendary',
};

const RESOURCE_BUNDLE_TIERS = {
  wood:    [200, 500, 1000, 2500, 5000].map((q, i) => ({ id: `res_bundle_wood_t${i + 1}`,    qty: q })),
  stone:   [200, 500, 1000, 2500, 5000].map((q, i) => ({ id: `res_bundle_stone_t${i + 1}`,   qty: q })),
  food:    [200, 500, 1000, 2500, 5000].map((q, i) => ({ id: `res_bundle_food_t${i + 1}`,    qty: q })),
  money:   [200, 500, 1000, 2500, 5000].map((q, i) => ({ id: `res_bundle_money_t${i + 1}`,   qty: q })),
  iron:    [50,  100, 250,  500,  1000].map((q, i) => ({ id: `res_bundle_iron_t${i + 1}`,    qty: q })),
  water:   [50,  100, 250,  500,  1000].map((q, i) => ({ id: `res_bundle_water_t${i + 1}`,   qty: q })),
  diamond: [5,   10,  20,   50,   100 ].map((q, i) => ({ id: `res_bundle_diamond_t${i + 1}`, qty: q })),
};

/**
 * Greedily converts a raw resource amount into tiered bundle stack entries.
 * Works largest-to-smallest. Any non-zero remainder is rounded up to one T1 bundle
 * so the player always receives at least the promised amount.
 * @param {string} resource
 * @param {number} amount
 * @returns {Array<{ bundleId: string, qty: number }>}
 */
function _splitIntoTierBundles(resource, amount) {
  const tiers = RESOURCE_BUNDLE_TIERS[resource];
  if (!tiers) {
    console.warn(`[InventoryManager] No tier config for resource: ${resource}`);
    return [];
  }
  const result = [];
  let remaining = Math.max(0, Math.round(amount));
  // Greedy: consume as many of the largest tier as possible
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (remaining >= tiers[i].qty) {
      const count = Math.floor(remaining / tiers[i].qty);
      result.push({ bundleId: tiers[i].id, qty: count });
      remaining -= count * tiers[i].qty;
    }
  }
  // Non-zero remainder → one extra T1 (player never loses resources)
  if (remaining > 0) result.push({ bundleId: tiers[0].id, qty: 1 });
  return result;
}

export class InventoryManager {
  constructor() {
    this.name = 'InventoryManager';
    /** @type {Map<string, number>} itemId → quantity */
    this._items = new Map();
    this._hm = null; // set via setHeroManager()
    this._buffs = null;
    this._rm = null; // set via setResourceManager()
    this._bm = null; // set via setBuildingManager()
    this._um = null; // set via setUnitManager()
    this._tm = null; // set via setTechnologyManager()
  }

  setHeroManager(hm) { this._hm = hm; }
  setBuffManager(bm) { this._buffs = bm; }
  setResourceManager(rm) { this._rm = rm; }
  setBuildingManager(bm) { this._bm = bm; }
  setUnitManager(um) { this._um = um; }
  setTechnologyManager(tm) { this._tm = tm; }

  /** Get count of fragments for a hero by heroId */
  getFragmentCount(heroId) {
    const fragId = `fragment_${heroId}`;
    return this._items.get(fragId) ?? 0;
  }

  // ─────────────────────────────────────────────
  // MUTATION
  // ─────────────────────────────────────────────

  /**
   * Add qty of an item to the inventory.
   * @param {string} itemId
   * @param {number} [qty=1]
   * @returns {boolean} false if itemId is unknown and nothing was granted
   */
  addItem(itemId, qty = 1) {
    if (!INVENTORY_ITEMS[itemId]) {
      console.warn(`[InventoryManager] Unknown item: ${itemId}`);
      return false;
    }
    this._items.set(itemId, (this._items.get(itemId) ?? 0) + qty);
    eventBus.emit('inventory:updated', this.getItems());
    return true;
  }

  /**
   * Grant an array of rewards into the player's inventory for deferred use.
   * Resource rewards become usable resource_bundle items; item rewards are added directly.
   * @param {Array<{ type: 'resource'|'item', itemId: string, quantity: number }>} rewardArray
   * @returns {Array<{ type: string, itemId: string, quantity: number }>} the same array (for UI summary)
   */
  grantRewards(rewardArray) {
    if (!Array.isArray(rewardArray)) return [];
    // Collect resolved bundle item entries so InventoryUI can show the NEW highlight
    // on the actual bundle cards (resource entries don't carry itemIds of bundles).
    const resolvedBundleEntries = [];
    for (const r of rewardArray) {
      if (r.type === 'resource') {
        // Decompose the amount into tiered bundles (greedy, largest-first).
        const splits = _splitIntoTierBundles(r.itemId, r.quantity);
        for (const { bundleId, qty } of splits) {
          this.addItem(bundleId, qty);
          resolvedBundleEntries.push({ type: 'item', itemId: bundleId, quantity: qty });
        }
      } else if (r.type === 'item') {
        this.addItem(r.itemId, r.quantity);
      }
    }

    if (rewardArray.length > 0) {
      eventBus.emit('inventory:updated', { rewards: [...rewardArray, ...resolvedBundleEntries] });
    }
    return rewardArray;
  }

  /**
   * Remove qty of an item. Returns false if insufficient quantity.
   * @param {string} itemId
   * @param {number} [qty=1]
   * @returns {boolean}
   */
  removeItem(itemId, qty = 1) {
    const current = this._items.get(itemId) ?? 0;
    if (current < qty) return false;
    const next = current - qty;
    if (next === 0) this._items.delete(itemId);
    else this._items.set(itemId, next);
    eventBus.emit('inventory:updated', this.getItems());
    return true;
  }

  // ─────────────────────────────────────────────
  // QUERY
  // ─────────────────────────────────────────────

  /**
   * Check whether the player has at least qty of an item.
   * @param {string} itemId
   * @param {number} [qty=1]
   */
  hasItem(itemId, qty = 1) {
    return (this._items.get(itemId) ?? 0) >= qty;
  }

  /**
   * Get quantity of a specific item.
   * @param {string} itemId
   * @returns {number}
   */
  getQuantity(itemId) {
    return this._items.get(itemId) ?? 0;
  }

  /**
   * Returns all inventory items (config merged with current quantity).
   * Items with qty 0 are included so UI can show grayed-out entries.
   * @returns {Array<object>}
   */
  getItems() {
    return Object.values(INVENTORY_ITEMS).map(cfg => ({
      ...cfg,
      quantity: this._items.get(cfg.id) ?? 0,
    }));
  }

  /**
   * Returns only items the player currently owns (qty > 0).
   * @returns {Array<object>}
   */
  getOwnedItems() {
    return this.getItems().filter(i => i.quantity > 0);
  }

  /**
   * Returns items filtered by type.
   * @param {string} type  e.g. 'hero_card', 'hero_card_universal', 'xp_bundle'
   */
  getItemsByType(type) {
    return this.getItems().filter(i => i.type === type);
  }

  /**
   * Dry-run of useItem: validates qty and reports what the player would receive. Never mutates or emits.
   * @returns {{ success: boolean, reason?: string, qty: number, grants?: object, lost?: object, xpAmount?: number }}
   */
  previewUse(itemId, { qty = 1 } = {}) {
    const cfg = INVENTORY_ITEMS[itemId];
    if (!cfg) return { success: false, reason: 'Unknown item.', qty: 0 };
    const n = BATCHABLE.has(cfg.type) ? qty : 1;
    if (!Number.isInteger(n) || n < 1) return { success: false, reason: 'Invalid quantity.', qty: n };
    if (!this.hasItem(itemId, n)) {
      return { success: false, reason: `You don't have ${n > 1 ? `${n}× ` : ''}${cfg.name}.`, qty: n };
    }
    if (cfg.type === 'resource_bundle') {
      if (!this._rm) return { success: false, reason: 'Resource system not available.', qty: n };
      const mult = this._rm.isSandbox?.() ? 10 : 1;
      return { success: true, qty: n, ...resourceYield(cfg.grants, n, this._rm.getSnapshot(), mult) };
    }
    if (HERO_XP_TYPES.has(cfg.type)) {
      const per = xpPerUnit(cfg);
      if (!per) return { success: false, reason: `${cfg.name} has no XP value configured.`, qty: n };
      return { success: true, qty: n, xpAmount: per * n };
    }
    return { success: true, qty: n };
  }

  /**
   * Use/consume an item, applying its effect. Batchable types apply qty units with one inventory:updated.
   * @param {string} itemId
   * @param {{ qty?: number, heroId?: string, queueType?: string, targetInstanceId?: string }} [opts]
   * @returns {{ success: boolean, reason?: string }}
   */
  useItem(itemId, { qty = 1, heroId, queueType, targetInstanceId } = {}) {
    const cfg = INVENTORY_ITEMS[itemId];
    if (!cfg) return { success: false, reason: 'Unknown item.' };
    if (!this.hasItem(itemId)) return { success: false, reason: `You don't have ${cfg.name}.` };
    if (BATCHABLE.has(cfg.type)) return this._useBatch(itemId, cfg, qty, heroId);

    if (cfg.type === 'hero_card' || cfg.type === 'hero_card_universal') {
      if (!this._hm) return { success: false, reason: 'Hero system not available.' };
      const r = this._hm.recruitWithCard(itemId);
      return r;

    } else if (cfg.type === 'recruitment_scroll') {
      if (!this._hm) return { success: false, reason: 'Hero system not available.' };
      if (typeof this._hm.rollScroll !== 'function') {
        return { success: false, reason: 'Recruitment scrolls have been retired — use Recruit Tokens instead.' };
      }
      const r = this._hm.rollScroll(cfg.tier);
      if (!r.outcome || r.grantFailed) {
        return { success: false, reason: r.reason ?? 'Failed to grant reward.', gachaResult: r };
      }
      return { success: true, gachaResult: r };

    } else if (cfg.type === 'buff') {
      if (!this._buffs) return { success: false, reason: 'Buff system not available.' };
      const r = this._buffs.activate(itemId);
      if (!r?.success) return { success: false, reason: r?.reason ?? 'Could not activate buff.' };
      this.removeItem(itemId, 1);
      eventBus.emit('inventory:itemUsed', { itemId });
      return { success: true, replaced: r.replaced, durationMs: cfg.durationMs, value: cfg.value };

    } else if (cfg.type === 'speed_boost') {
      const target = queueType ?? cfg.target;
      if (cfg.target !== 'any' && target !== cfg.target) {
        return { success: false, reason: `This speedup only works on ${cfg.target}.` };
      }
      const skipSec = cfg.skipSeconds >= 999999 || !isFinite(cfg.skipSeconds) ? 999999 : cfg.skipSeconds;
      let result;
      if (target === 'building') {
        if (!this._bm) return { success: false, reason: 'Building system not available.' };
        result = this._bm.reduceActiveTimer(skipSec, targetInstanceId ?? null);
      } else if (target === 'training') {
        if (!this._um) return { success: false, reason: 'Training system not available.' };
        result = this._um.reduceActiveTrainTimer(skipSec);
      } else if (target === 'research') {
        if (!this._tm) return { success: false, reason: 'Research system not available.' };
        result = this._tm.reduceActiveResearchTimer(skipSec);
      } else {
        return { success: false, reason: 'Invalid speedup target.' };
      }
      if (!result.success) return result;
      this.removeItem(itemId, 1);
      eventBus.emit('inventory:itemUsed', { itemId, target, skipSeconds: cfg.skipSeconds });
      return { success: true, remaining: result.remaining, completed: result.completed, target };

    } else if (cfg.type === 'slot_purchase') {
      // B17 — unlock an extra build or research queue slot
      if (cfg.slotType === 'build') {
        if (!this._bm) return { success: false, reason: 'Building system not available.' };
        if (this._bm.isShopBuildSlotBought()) return { success: false, reason: 'Build slot already unlocked.' };
        this._bm.grantShopBuildSlot();
      } else if (cfg.slotType === 'research') {
        if (!this._tm) return { success: false, reason: 'Research system not available.' };
        if (this._tm.isShopResearchSlotBought()) return { success: false, reason: 'Research slot already unlocked.' };
        this._tm.grantShopResearchSlot();
      } else {
        return { success: false, reason: 'Unknown slot type.' };
      }
      if (cfg.bonus && this._rm) this._rm.add(cfg.bonus);
      this.removeItem(itemId, 1);
      eventBus.emit('inventory:itemUsed', { itemId, slotType: cfg.slotType });
      return { success: true, slotType: cfg.slotType };

    }
    return { success: false, reason: 'This item cannot be used.' };
  }

  _useBatch(itemId, cfg, qty, heroId) {
    const preview = this.previewUse(itemId, { qty });
    if (!preview.success) return preview;
    if (cfg.type === 'resource_bundle') return this._openBundles(itemId, cfg, preview);
    if (!heroId) return { success: false, reason: 'Select a hero to receive the XP.' };
    if (!this._hm) return { success: false, reason: 'Hero system not available.' };
    if (cfg.type === 'hero_fragment' && heroId !== cfg.targetHeroId) {
      return { success: false, reason: 'Fragments can only be used on their own hero.' };
    }
    const r = this._hm.awardHeroXP(heroId, preview.xpAmount);
    if (!r?.success) return { success: false, reason: r?.reason ?? 'Could not award XP.' };
    if (r.gained === 0) return { success: false, reason: 'Hero is at max level.' };
    this.removeItem(itemId, preview.qty);
    return { success: true, qty: preview.qty, xpAmount: preview.xpAmount };
  }

  _openBundles(itemId, cfg, preview) {
    const requested = Object.fromEntries(Object.entries(cfg.grants).map(([res, per]) => [res, per * preview.qty]));
    try {
      this._rm.add(requested);
    } catch {
      return { success: false, reason: 'Failed to grant resources.' };
    }
    this.removeItem(itemId, preview.qty);
    eventBus.emit('inventory:itemUsed', { itemId, qty: preview.qty, grants: preview.grants });
    return { success: true, qty: preview.qty, grants: preview.grants, lost: preview.lost };
  }

  // ─────────────────────────────────────────────
  // GAME ENGINE HOOK
  // ─────────────────────────────────────────────

  /** No per-tick logic needed. */
  update(_dt) { }

  // ─────────────────────────────────────────────
  // PERSISTENCE
  // ─────────────────────────────────────────────

  serialize() {
    return { items: Object.fromEntries(this._items) };
  }

  deserialize(data) {
    if (!data?.items) return;
    for (const [rawId, qty] of Object.entries(data.items)) {
      const id = LEGACY_ITEM_ID_ALIASES[rawId] ?? rawId;
      if (qty > 0 && INVENTORY_ITEMS[id]) {
        this._items.set(id, (this._items.get(id) ?? 0) + qty);
      }
    }
    // P12: notify UI panels to refresh after a save load
    eventBus.emit('inventory:updated', { source: 'load' });
  }
}
