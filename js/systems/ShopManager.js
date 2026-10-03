import { eventBus } from '../core/EventBus.js';
import { INVENTORY_ITEMS, DIAMOND_PACKAGES, CRATE_TABLE, findShopEntry } from '../entities/GAME_DATA.js';
import { rollCrate } from './trading/crateRoll.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const utcDay = () => new Date().toISOString().slice(0, 10);

export class ShopManager {
  constructor({ rm, inventory, bm, tech, now = Date.now, today = utcDay, rng = Math.random }) {
    this.name = 'ShopManager';
    this._rm = rm;
    this._inventory = inventory;
    this._bm = bm;
    this._tech = tech;
    this._now = now;
    this._today = today;
    this._rng = rng;
    this._crateClaimedDay = null;
  }

  update() {}

  buy(entryId) {
    const entry = findShopEntry(entryId);
    const cost = entry && this._costOf(entry);
    if (!cost) return { success: false, reason: 'invalid' };
    const cfg = entry.itemId ? INVENTORY_ITEMS[entry.itemId] : null;
    const blocked = this._blockedReason(cfg);
    if (blocked) return { success: false, reason: blocked };
    if (!this._rm.canAfford(cost)) return { success: false, reason: 'unaffordable' };
    this._rm.spend(cost);
    this._grant(entry, cfg);
    eventBus.emit('game:purchaseComplete', { itemId: entry.itemId, cost });
    return { success: true, itemId: entry.itemId };
  }

  buyPack(packId) {
    const pack = DIAMOND_PACKAGES.find(p => p.id === packId);
    if (!pack) return { success: false, reason: 'invalid' };
    this._rm.add({ diamond: pack.diamonds });
    eventBus.emit('game:purchaseComplete', { packageId: pack.id });
    return { success: true, diamonds: pack.diamonds };
  }

  entryState(entryId) {
    const entry = findShopEntry(entryId);
    const cost = (entry && this._costOf(entry)) ?? {};
    const cfg = entry?.itemId ? INVENTORY_ITEMS[entry.itemId] : null;
    const blocked = this._blockedReason(cfg);
    const status = blocked === 'owned' ? 'purchased' : blocked === 'active' ? 'active' : 'available';
    return {
      cost,
      canAfford: !blocked && !!entry && this._rm.canAfford(cost),
      owned: entry?.itemId ? this._inventory.getQuantity(entry.itemId) : 0,
      status,
    };
  }

  crateStatus() {
    return {
      ready: this._crateClaimedDay !== this._today(),
      msUntilReset: DAY_MS - (this._now() % DAY_MS),
    };
  }

  claimCrate() {
    if (!this.crateStatus().ready) return { success: false, reason: 'claimed' };
    const result = rollCrate({ hqLevel: this._bm.getHQLevel(), rng: this._rng, eligible: this._uncappedResources() });
    this._crateClaimedDay = this._today();
    if (result.itemId) this._inventory.addItem(result.itemId, 1);
    if (result.grants) result.applied = this._addMeasured(result.grants);
    eventBus.emit('shop:crateClaimed', { result });
    return { success: true, result };
  }

  serialize() { return { crateClaimedDay: this._crateClaimedDay }; }

  deserialize(data) {
    this._crateClaimedDay = DAY_PATTERN.test(data?.crateClaimedDay) ? data.crateClaimedDay : null;
  }

  _uncappedResources() {
    const snap = this._rm.getSnapshot();
    return Object.keys(CRATE_TABLE.resourceBase).filter(r => snap[r].amount < snap[r].cap);
  }

  _addMeasured(grants) {
    const held = () => this._rm.getSnapshot();
    const before = held();
    this._rm.add(grants);
    const after = held();
    return Object.fromEntries(Object.keys(grants).map(k => [k, after[k].amount - before[k].amount]));
  }

  _costOf(entry) {
    if (typeof entry.moneyCost === 'number') return { money: entry.moneyCost };
    if (typeof entry.diamondCost === 'number') return { diamond: entry.diamondCost };
    return null;
  }

  _blockedReason(cfg) {
    if (cfg?.type === 'automation' && this._bm.getAutomations()[cfg.automation] === true) return 'active';
    if (cfg?.type === 'slot_purchase') {
      const owned = cfg.slotType === 'build'
        ? this._bm.isShopBuildSlotBought()
        : this._tech.isShopResearchSlotBought();
      if (owned) return 'owned';
    }
    return null;
  }

  _grant(entry, cfg) {
    if (cfg?.type === 'automation') {
      eventBus.emit('automation:purchased', { automation: cfg.automation });
    } else if (cfg?.type === 'slot_purchase') {
      this._rm.add(cfg.bonus);
      eventBus.emit('slot:purchased', { slotType: cfg.slotType });
    } else {
      this._inventory.addItem(entry.itemId, 1);
    }
  }
}
