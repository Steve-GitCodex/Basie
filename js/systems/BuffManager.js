import { eventBus } from '../core/EventBus.js';
import { INVENTORY_ITEMS } from '../entities/GAME_DATA.js';

const isBuffConfig = cfg => cfg?.type === 'buff' && typeof cfg.stat === 'string';

export class BuffManager {
  constructor() {
    this.name = 'buffs';
    this._boosts = [];
  }

  activate(itemId) {
    const cfg = INVENTORY_ITEMS[itemId];
    if (!isBuffConfig(cfg)) return { success: false, reason: 'not_a_buff', replaced: null };
    const replaced = this._find(cfg.stat);
    const now = Date.now();
    this._boosts = this._boosts.filter(b => b.stat !== cfg.stat);
    const boost = { itemId, stat: cfg.stat, value: cfg.value, startedAt: now, endsAt: now + cfg.durationMs };
    this._boosts.push(boost);
    eventBus.emit('buff:activated', { itemId, stat: cfg.stat, value: cfg.value, endsAt: boost.endsAt, replaced });
    eventBus.emit('buffs:changed');
    return { success: true, replaced };
  }

  previewActivate(itemId) {
    const cfg = INVENTORY_ITEMS[itemId];
    if (!isBuffConfig(cfg)) return null;
    return {
      stat: cfg.stat,
      current: this._find(cfg.stat),
      incoming: { value: cfg.value, durationMs: cfg.durationMs },
    };
  }

  getBoosts() {
    const now = Date.now();
    return this._boosts.map(b => ({ ...b, remainingMs: Math.max(0, b.endsAt - now) }));
  }

  multiplierFor(stat) {
    return this._boosts.reduce((sum, b) => (b.stat === stat ? sum + b.value : sum), 0);
  }

  update() {
    const now = Date.now();
    const expired = this._boosts.filter(b => b.endsAt <= now);
    if (!expired.length) return;
    this._boosts = this._boosts.filter(b => b.endsAt > now);
    expired.forEach(b => eventBus.emit('buff:expired', { itemId: b.itemId, stat: b.stat }));
    eventBus.emit('buffs:changed');
  }

  serialize() {
    return { boosts: this._boosts.map(b => ({ ...b })) };
  }

  deserialize(data) {
    const now = Date.now();
    const latestByStat = new Map();
    for (const raw of data?.boosts ?? []) {
      if (!this._isValidSaved(raw, now)) continue;
      const kept = latestByStat.get(raw.stat);
      if (!kept || raw.endsAt > kept.endsAt) {
        latestByStat.set(raw.stat, { itemId: raw.itemId, stat: raw.stat, value: raw.value, startedAt: raw.startedAt, endsAt: raw.endsAt });
      }
    }
    this._boosts = [...latestByStat.values()];
    eventBus.emit('buffs:changed');
  }

  _find(stat) {
    const boost = this._boosts.find(b => b.stat === stat);
    return boost ? { ...boost } : null;
  }

  _isValidSaved(raw, now) {
    return raw
      && isBuffConfig(INVENTORY_ITEMS[raw.itemId])
      && typeof raw.stat === 'string'
      && Number.isFinite(raw.value)
      && Number.isFinite(raw.startedAt)
      && Number.isFinite(raw.endsAt)
      && raw.endsAt > now;
  }
}
