import { eventBus } from '../../core/EventBus.js';
import { INVENTORY_ITEMS } from '../../entities/GAME_DATA.js';
import { RES_META } from '../uiUtils.js';
import { itemCard, patchCard } from './tradeCards.js';
import { useOwnedItem } from './useOwnedItem.js';
import { formatCountdown } from './countdown.js';
import { BUY_FAILURE_TEXT } from './buyFailureText.js';

const NEED_ICON = { wood: '🪵', stone: '🪨', food: '🍖', water: '💧', iron: '⛓️', money: '🪙' };

const costHtml = (cost) => Object.entries(cost)
  .map(([res, n]) => `<span>${RES_META[res].icon} ${Math.floor(n).toLocaleString()}</span>`).join('');

export class TraderTab {
  /** @param {{ rm, inventory, heroes, bm, um, tech, trader, notifications }} systems */
  constructor(systems) {
    this._s = systems;
    this._shown = false;
    this._off = null;
    this._renderedPresent = null;
    this._state = null;
  }

  hasDot() {
    return this._s.trader.getState().hasNew;
  }

  mount(el) {
    this._el = el;
    el.addEventListener('click', (e) => this._onClick(e));
    eventBus.on('trader:updated', () => {
      eventBus.emit('tradingpost:refreshDots');
      if (this._shown) this.render();
    });
    eventBus.on('inventory:updated', () => { if (this._shown) this.patch(); });
  }

  render() {
    this._state = this._s.trader.getState();
    this._renderedPresent = this._state.present;
    this._el.innerHTML = `
      <div class="tp-trader">
        <div class="tp-trader__head">
          <p class="tp-supply__label">Wandering trader</p>
          <span class="tp-trader__timer"></span>
        </div>
        <small class="tp-trader__blurb"></small>
        <div class="tp-trader__grid tp-row"></div>
      </div>`;
    this._timerEl = this._el.querySelector('.tp-trader__timer');
    this._blurb = this._el.querySelector('.tp-trader__blurb');
    this._blurb.textContent = this._state.present
      ? 'Takes resources, not money. New stock each visit.'
      : 'Comes back sooner when you build, train or fight.';
    this._el.querySelector('.tp-trader__grid').replaceChildren(...this._state.stock.map(slot => this._card(slot)));
    this._patchTimer();
  }

  patch() {
    if (!this._state) return;
    this._el.querySelectorAll('.tp-card').forEach(card => {
      const slot = this._state.stock.find(s => s.slotId === card.dataset.entryId);
      if (slot) patchCard(card, this._cardState(slot));
    });
  }

  onShow() {
    this._s.trader.markSeen();
    eventBus.emit('tradingpost:refreshDots');
    this._shown = true;
    this._off?.();
    this._off = eventBus.on('tick:ui', () => this._patchTimer());
    this._patchTimer();
  }

  onHide() {
    this._shown = false;
    this._off?.();
    this._off = null;
  }

  _card(slot) {
    const cfg = INVENTORY_ITEMS[slot.itemId];
    const card = itemCard({
      entryId: slot.slotId,
      itemId: slot.itemId,
      name: cfg.name,
      icon: cfg.icon,
      rarity: cfg.rarity,
      priceLabel: 'Buy',
      currency: 'resources',
      ...this._cardState(slot),
    });
    const anchor = card.querySelector('.tp-card__actions');
    const extras = [];
    if (slot.discountPct) {
      const pill = document.createElement('span');
      pill.className = 'tp-trader__pill';
      pill.textContent = `−${slot.discountPct}%`;
      extras.push(pill);
    }
    const cost = document.createElement('div');
    cost.className = 'tp-trader__cost';
    cost.innerHTML = costHtml(slot.cost);
    extras.push(cost);
    anchor.before(...extras);
    return card;
  }

  _cardState(slot) {
    const missing = this._firstMissing(slot.cost);
    return {
      owned: this._s.inventory.getQuantity(slot.itemId),
      canAfford: !missing,
      status: slot.sold ? 'sold' : 'available',
      needLabel: missing ? `Need ${NEED_ICON[missing]}` : null,
    };
  }

  _firstMissing(cost) {
    if (this._s.rm.canAfford(cost)) return null;
    const snap = this._s.rm.getSnapshot();
    return Object.keys(cost).find(res => (snap[res]?.amount ?? 0) < cost[res]) ?? null;
  }

  _patchTimer() {
    if (!this._timerEl || !this._state) return;
    const { present, leavesAt, nextVisitAt } = this._state;
    const remaining = (present ? leavesAt : nextVisitAt) - Date.now();
    if (remaining <= 0 && this._s.trader.getState().present !== this._renderedPresent) {
      this.render();
      return;
    }
    const text = `${present ? 'leaves in' : 'returns in'} ${formatCountdown(remaining)}`;
    if (this._timerEl.textContent !== text) this._timerEl.textContent = text;
  }

  _onClick(e) {
    const buy = e.target.closest('.tp-card__buy');
    if (buy && !buy.disabled) return this._buy(buy.dataset.entryId);
    const use = e.target.closest('.tp-card__use');
    if (use) useOwnedItem(use.dataset.itemId, use, this._s);
  }

  _buy(slotId) {
    const result = this._s.trader.buy(slotId);
    if (!result.success) {
      eventBus.emit('ui:error');
      this._s.notifications?.show('warning', 'Cannot Buy', BUY_FAILURE_TEXT[result.reason] ?? result.reason);
      this.render();
      return;
    }
    this._s.notifications?.show('success', 'Purchased', INVENTORY_ITEMS[result.itemId]?.name ?? 'Item');
  }
}
