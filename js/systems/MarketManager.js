import { eventBus } from '../core/EventBus.js';
import { RESOURCE_VALUE, PRESSURE_CAP } from '../entities/GAME_DATA.js';
import { quote, addPressure } from './trading/exchangeRates.js';

const utcDay = () => new Date().toISOString().slice(0, 10);

const freshPressure = () => Object.fromEntries(Object.keys(RESOURCE_VALUE).map(key => [key, 1]));

export class MarketManager {
  constructor(rm, { today = utcDay } = {}) {
    this.name = 'MarketManager';
    this._rm = rm;
    this._today = today;
    this._pressure = freshPressure();
    this._lastResetDate = this._today();
  }

  quote(give, get, amount) {
    return quote({ give, get, amount, pressure: this._pressure[give] });
  }

  exchange(give, get, amount) {
    let result;
    try {
      result = this.quote(give, get, amount);
    } catch (err) {
      return { success: false, reason: err.message };
    }
    if (result.gain < 1) return { success: false, reason: 'Amount too small to exchange.' };
    if (!this._rm.canAfford({ [give]: amount })) return { success: false, reason: 'Not enough resources.' };
    if (result.gain > this.storageRoom(get)) return { success: false, reason: 'Not enough storage.' };

    this._rm.spend({ [give]: amount });
    this._rm.add({ [get]: result.gain });
    this._pressure[give] = addPressure(this._pressure[give], give, amount);

    const payload = { give, get, amount, gain: result.gain };
    eventBus.emit('market:exchanged', payload);
    return { success: true, gain: result.gain };
  }

  storageRoom(key) {
    const { amount = 0, cap } = this._rm.getSnapshot()[key] ?? {};
    return Number.isFinite(cap) ? Math.max(0, cap - amount) : Infinity;
  }

  getPressure() {
    return { ...this._pressure };
  }

  update() {
    const today = this._today();
    if (today === this._lastResetDate) return;
    this._pressure = freshPressure();
    this._lastResetDate = today;
    eventBus.emit('market:pricesReset');
    eventBus.emit('notification:show', { type: 'info', title: '🏪 Market Reset', message: 'Daily prices have been reset!' });
  }

  serialize() {
    return { pressure: { ...this._pressure }, lastResetDate: this._lastResetDate };
  }

  deserialize(data) {
    const saved = data && typeof data === 'object' ? data : {};
    const today = this._today();
    const savedDate = typeof saved.lastResetDate === 'string' ? saved.lastResetDate : null;
    this._pressure = freshPressure();
    if (savedDate === today && saved.pressure && typeof saved.pressure === 'object') {
      for (const key of Object.keys(this._pressure)) {
        const value = saved.pressure[key];
        if (Number.isFinite(value) && value >= 1) this._pressure[key] = Math.min(PRESSURE_CAP, value);
      }
    }
    this._lastResetDate = today;
  }
}
