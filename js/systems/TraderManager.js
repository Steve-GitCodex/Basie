import { eventBus } from '../core/EventBus.js';
import { INVENTORY_ITEMS, TRADER_TIMING, RESOURCE_VALUE } from '../entities/GAME_DATA.js';
import { generateStock } from './trading/traderStock.js';
import { advanceCycle, cutAwayTime } from './trading/traderCycle.js';

const ACTIVITY_EVENTS = ['building:started', 'unit:trainingStarted', 'combat:victory'];

const isTime = value => Number.isFinite(value) && value >= 0;

const DISCOUNTS = [0, 20, 30];
const isPayable = ([res, amount]) => res !== 'money' && Object.hasOwn(RESOURCE_VALUE, res) && Number.isFinite(amount) && amount > 0;

function isValidSlot(slot) {
  if (!slot || typeof slot.slotId !== 'string' || !Object.hasOwn(INVENTORY_ITEMS, slot.itemId)) return false;
  const costEntries = slot.cost && typeof slot.cost === 'object' ? Object.entries(slot.cost) : [];
  return costEntries.length > 0 && costEntries.every(isPayable)
    && DISCOUNTS.includes(slot.discountPct) && typeof slot.sold === 'boolean';
}

function sanitizeStock(stock) {
  const seen = new Set();
  return stock.filter(slot => {
    if (!isValidSlot(slot) || seen.has(slot.slotId)) return false;
    seen.add(slot.slotId);
    return true;
  }).map(slot => ({ ...slot, cost: { ...slot.cost } }));
}

function hasImpossibleTimes(data, now) {
  return data.present
    ? data.arrivedAt > now || data.leavesAt > now + TRADER_TIMING.stayMs
    : data.nextVisitAt > now + TRADER_TIMING.awayMs;
}

export class TraderManager {
  constructor({ rm, inventory, now = Date.now, rng = Math.random }) {
    this.name = 'TraderManager';
    this._rm = rm;
    this._inventory = inventory;
    this._now = now;
    this._rng = rng;
    this._seed();
    this._unsubscribes = ACTIVITY_EVENTS.map(type => eventBus.on(type, () => this._onActivity()));
  }

  destroy() {
    this._unsubscribes.forEach(off => off());
  }

  update() {
    const { visit, arrived, left } = advanceCycle(this._visit(), this._now(), TRADER_TIMING);
    if (!arrived && !left) return;
    Object.assign(this, { _present: visit.present, _arrivedAt: visit.arrivedAt, _leavesAt: visit.leavesAt, _nextVisitAt: visit.nextVisitAt });
    this._stock = visit.present ? this._freshStock() : [];
    eventBus.emit('trader:updated', this.getState());
  }

  getState() {
    return {
      present: this._present,
      arrivedAt: this._arrivedAt,
      leavesAt: this._leavesAt,
      nextVisitAt: this._nextVisitAt,
      stock: this._stock.map(slot => ({ ...slot, cost: { ...slot.cost } })),
      hasNew: this._present && this._seenVisitAt < this._arrivedAt,
    };
  }

  buy(slotId) {
    if (!this._present) return { success: false, reason: 'away' };
    const slot = this._stock.find(s => s.slotId === slotId);
    if (!slot) return { success: false, reason: 'invalid' };
    if (slot.sold) return { success: false, reason: 'sold' };
    if (!this._rm.canAfford(slot.cost)) return { success: false, reason: 'unaffordable' };
    this._rm.spend(slot.cost);
    this._inventory.addItem(slot.itemId, 1);
    slot.sold = true;
    eventBus.emit('trader:updated', this.getState());
    return { success: true, itemId: slot.itemId };
  }

  markSeen() {
    if (this._seenVisitAt >= this._arrivedAt) return;
    this._seenVisitAt = this._arrivedAt;
    eventBus.emit('trader:updated', this.getState());
  }

  serialize() {
    return { ...this._visit(), seenVisitAt: this._seenVisitAt, stock: this.getState().stock };
  }

  deserialize(data) {
    const valid = data && typeof data.present === 'boolean' && isTime(data.arrivedAt)
      && isTime(data.leavesAt) && isTime(data.nextVisitAt) && Array.isArray(data.stock);
    if (!valid || hasImpossibleTimes(data, this._now())) {
      this._seed();
      return;
    }
    this._present = data.present;
    this._arrivedAt = data.arrivedAt;
    this._leavesAt = data.leavesAt;
    this._nextVisitAt = data.nextVisitAt;
    this._seenVisitAt = isTime(data.seenVisitAt) ? data.seenVisitAt : 0;
    this._stock = sanitizeStock(data.stock);
    if (this._present && this._stock.length === 0) this._stock = this._freshStock();
    this.update();
  }

  _seed() {
    const now = this._now();
    this._present = true;
    this._arrivedAt = now;
    this._leavesAt = now + TRADER_TIMING.stayMs;
    this._nextVisitAt = this._leavesAt + TRADER_TIMING.awayMs;
    this._seenVisitAt = 0;
    this._stock = this._freshStock();
  }

  _visit() {
    return { present: this._present, arrivedAt: this._arrivedAt, leavesAt: this._leavesAt, nextVisitAt: this._nextVisitAt };
  }

  _freshStock() {
    const snapshot = Object.entries(this._rm.getSnapshot());
    const held = Object.fromEntries(snapshot.map(([res, r]) => [res, r.amount]));
    const caps = Object.fromEntries(snapshot.map(([res, r]) => [res, r.cap]));
    return generateStock({ held, caps, rng: this._rng });
  }

  _onActivity() {
    if (this._present) return;
    const next = cutAwayTime(this._nextVisitAt, this._now(), TRADER_TIMING);
    if (next === this._nextVisitAt) return;
    this._nextVisitAt = next;
    eventBus.emit('trader:updated', this.getState());
  }
}
