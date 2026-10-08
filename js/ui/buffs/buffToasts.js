import { eventBus } from '../../core/EventBus.js';
import { INVENTORY_ITEMS, BUFF_STATS } from '../../entities/GAME_DATA.js';
import { describeEntry, worldBuffEffect, formatRemaining } from './buffText.js';

export class BuffToasts {
  constructor(systems) {
    this._notifications = systems.notifications;
  }

  init() {
    eventBus.on('buff:activated', d => this._onActivated(d));
    eventBus.on('buff:expired', d => this._onExpired(d));
    eventBus.on('world:buffGranted', d => this._show('success', 'Buff gained', worldBuffEffect(d.buff)));
    eventBus.on('world:buffExpired', d => this._show('info', 'Buff expired', worldBuffEffect(d.buff)));
  }

  _onActivated({ itemId, stat, value, endsAt }) {
    const { effect } = describeEntry({ stat, pct: value });
    const name = INVENTORY_ITEMS[itemId]?.name ?? itemId;
    this._show('success', 'Boost active', `${name}: ${effect} for ${formatRemaining(endsAt - Date.now())}`);
  }

  _onExpired({ itemId, stat }) {
    const name = INVENTORY_ITEMS[itemId]?.name ?? itemId;
    this._show('info', 'Boost expired', `${name} (${BUFF_STATS[stat]?.label ?? stat})`);
  }

  _show(type, title, message) {
    this._notifications?.show(type, title, message);
  }
}
