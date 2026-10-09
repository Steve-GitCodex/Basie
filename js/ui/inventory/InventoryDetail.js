import { eventBus } from '../../core/EventBus.js';
import { INVENTORY_ITEMS } from '../../entities/GAME_DATA.js';
import { formatRemaining } from '../buffs/buffText.js';
import { getActiveQueues } from '../trading/activeQueues.js';
import { useItemFlow } from '../items/useItemFlow.js';
import { ACTION_OF_TYPE } from './inventoryTabs.js';
import { headHtml, actionHtml } from './detailBlocks.js';

const BUSY_COOLDOWN_MS = 400;
const ROUTE_ACTS = new Set(['recruit', 'goto-heroes', 'goto-hero']);
const fmt = (n) => Number(n).toLocaleString();

export class InventoryDetail {
  constructor(rootEl, systems, { onClose } = {}) {
    this._root = rootEl;
    this._s = systems;
    this._onClose = onClose ?? (() => {});
    this._item = null;
    this._action = null;
    this._qty = 1;
    this._els = {};
    this._busy = false;
    this._needed = 0;
    rootEl.addEventListener('click', (e) => this._onClick(e));
    rootEl.addEventListener('input', (e) => this._onInput(e));
    rootEl.addEventListener('change', (e) => this._onChange(e));
  }

  show(item) {
    this._item = item;
    this._root.replaceChildren();
    this._els = {};
    if (!item) return;
    const roster = this._s.heroes.getRosterWithState();
    this._action = ACTION_OF_TYPE[item.type] ?? 'none';
    this._qty = 1;
    if (item.type === 'hero_fragment' && !roster.find(h => h.id === item.targetHeroId)?.isOwned) this._action = 'fragment';
    this._needed = roster.find(h => h.id === item.targetHeroId)?.fragmentsNeeded ?? 0;
    this._root.innerHTML = headHtml(item) + actionHtml(this._action, item, roster);
    this._cache();
    this._refresh();
  }

  patch(item) {
    if (!item || item.id !== this._item?.id) return this.show(item);
    this._item = item;
    this._refresh();
  }

  _cache() {
    const q = (sel) => this._root.querySelector(sel);
    this._els = {
      owned: q('.inv-detail__owned'), slider: q('.inv-qty__slider'), num: q('.inv-qty__num'),
      preview: q('.inv-detail__preview'), one: q('.inv-use-one'), many: q('.inv-use-n'),
      hint: q('.inv-detail__hint'),
    };
  }

  _refresh() {
    this._els.owned.textContent = String(this._item.quantity);
    this._qty = Math.max(1, Math.min(this._qty, this._item.quantity));
    if (this._els.slider) this._refreshQty();
    if (this._action === 'speedup') this._refreshSpeedup();
    if (this._action === 'boost') this._refreshBoost();
    if (this._action === 'fragment') this._els.hint.textContent = `Fragments ${this._item.quantity} / ${this._needed}`;
  }

  _refreshQty() {
    const { slider, num, many, one } = this._els;
    const owned = this._item.quantity;
    const value = String(this._qty);
    slider.max = num.max = String(owned);
    slider.disabled = num.disabled = owned < 2;
    if (slider.value !== value) slider.value = value;
    if (num.value !== value) num.value = value;
    one.hidden = owned < 2;
    many.textContent = owned < 2 ? 'Use' : `Use ×${this._qty}`;
    one.disabled = many.disabled = this._busy;
    this._renderPreview();
  }

  _renderPreview() {
    const el = this._els.preview;
    el.replaceChildren();
    const result = this._s.inventory.previewUse(this._item.id, { qty: this._qty });
    if (!result.success) {
      el.textContent = result.reason ?? '';
      return;
    }
    const grants = result.grants ?? {};
    const lost = result.lost ?? {};
    const requested = Object.keys({ ...grants, ...lost }).map(res => `+${fmt((grants[res] ?? 0) + (lost[res] ?? 0))} ${res}`);
    el.textContent = requested.join(', ');
    const capped = Object.keys(lost).filter(res => lost[res] > 0);
    if (!capped.length) return;
    const warn = document.createElement('span');
    warn.className = 'inv-detail__warn';
    warn.textContent = ` (storage room: ${capped.map(res => `${fmt(grants[res] ?? 0)} ${res}`).join(', ')})`;
    el.append(warn);
  }

  _runningTimer() {
    const active = getActiveQueues(this._s);
    const target = INVENTORY_ITEMS[this._item.id]?.target;
    if (target && target !== 'any') return active[target] ?? null;
    return Object.values(active).find(Boolean) ?? null;
  }

  _refreshSpeedup() {
    const job = this._runningTimer();
    this._els.hint.textContent = job ? `${job.label} · ${formatRemaining(job.secsLeft * 1000)} left` : 'Nothing to speed up';
  }

  _refreshBoost() {
    const current = this._s.buffs.previewActivate(this._item.id)?.current;
    const { hint } = this._els;
    hint.classList.toggle('hidden', !current);
    if (!current) return;
    const name = INVENTORY_ITEMS[current.itemId]?.name ?? current.itemId;
    hint.textContent = `Active: ${name} · ${formatRemaining(current.endsAt - Date.now())}. Using this one replaces it.`;
  }

  _setQty(value) {
    const n = Math.round(Number(value));
    this._qty = Math.max(1, Math.min(Number.isFinite(n) ? n : 1, this._item.quantity));
    this._refreshQty();
  }

  _onInput(e) {
    if (e.target.matches('.inv-qty__slider')) this._setQty(e.target.value);
  }

  _onChange(e) {
    if (e.target.matches('.inv-qty__num')) this._setQty(e.target.value);
  }

  _onClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn || !this._item || btn.disabled || this._busy) return;
    const act = btn.dataset.act;
    if (act === 'dec') return this._setQty(this._qty - 1);
    if (act === 'inc') return this._setQty(this._qty + 1);
    if (act === 'buffs') return eventBus.emit('ui:openBuffs');
    if (ROUTE_ACTS.has(act)) this._onClose();
    this._run(act === 'one' ? 1 : this._qty, btn);
  }

  async _run(qty, anchorEl) {
    this._setBusy(true);
    try {
      await useItemFlow({ systems: this._s, itemId: this._item.id, qty, anchorEl });
    } finally {
      setTimeout(() => this._setBusy(false), BUSY_COOLDOWN_MS);
    }
  }

  _setBusy(busy) {
    this._busy = busy;
    for (const btn of this._root.querySelectorAll('.inv-detail__acts [data-act]')) btn.disabled = busy;
    if (!busy && this._item && this._els.owned) this._refresh();
  }
}
