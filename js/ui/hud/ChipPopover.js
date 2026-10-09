import { eventBus } from '../../core/EventBus.js';
import { RES_META } from '../uiUtils.js';
import { fillState, fillRatio, timeToFull, formatDuration } from './hudFormat.js';
import { commanderRows, commanderHtml, patchCommander } from './commanderPopover.js';
import { subscribeBuffRefresh } from '../buffs/buffEvents.js';
import { liveBuffEntries, buffPopoverModel, buffPopoverHtml, patchBuffTimes } from '../buffs/buffPopover.js';
import { cafeteriaTotals, cafeteriaHtml, patchCafeteria, restockAll } from './cafeteriaPopover.js';

const TICK_THROTTLE_MS = 500;
const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 6;
const CHIP_SELECTOR = '#resource-bar .resource-chip, .hud-wallet .resource-chip';
const CAFETERIA_KEY = 'cafeteria';
const CAFETERIA_ID = 'res-cafeteria';
const COMMANDER_KEY = 'commander';
const COMMANDER_EVENTS = ['user:xpGained', 'user:levelUp', 'user:profileUpdated', 'user:vipUpdate'];
const BUFFS_KEY = 'buffs';
const BUFF_BADGE_ID = 'buff-hud-badge';
const WALLET_KEYS = ['money', 'diamond'];
const POPOVER_ID = 'chip-popover';
const MODAL_EVENTS = ['ui:openInventory', 'ui:openProfile', 'ui:openBuffs', 'ui:openTradingTab', 'ui:openBuildingInfo'];
const TRADE_TABS = { money: 'supply', diamond: 'premium' };

const exact = n => Math.floor(n).toLocaleString();

export class ChipPopover {
  constructor({ rm, bm, user, buffSystems }) {
    this._buffSystems = buffSystems;
    this._buffSignature = '';
    this._rm = rm;
    this._user = user;
    this._bm = bm;
    this._el = null;
    this._key = null;
    this._anchor = null;
    this._lastTickAt = 0;
    this._parts = {};
    this._keyboardOpen = false;
  }

  init() {
    this._el = document.createElement('div');
    this._el.className = 'chip-popover';
    this._el.id = POPOVER_ID;
    this._el.setAttribute('role', 'dialog');
    this._el.hidden = true;
    document.body.appendChild(this._el);

    const snap = this._rm.getSnapshot();
    for (const chip of document.querySelectorAll(CHIP_SELECTOR)) {
      if (!snap[chip.id.slice(4)] && chip.id !== CAFETERIA_ID) continue;
      this._bindAnchor(chip, () => this._toggle(chip));
    }

    this._bindAnchor(document.getElementById('player-chip'), () => this._toggleCommander());
    for (const name of COMMANDER_EVENTS) eventBus.on(name, () => this._onCommanderChange());

    this._bindAnchor(document.getElementById(BUFF_BADGE_ID), () => this._toggleBuffs());
    if (this._buffSystems) {
      subscribeBuffRefresh(this._buffSystems, () => this._onBuffChange(), ['world:buffExpired']);
      eventBus.on('tick:ui', () => this._onBuffTick());
    }

    this._el.addEventListener('click', e => this._onAction(e));
    document.addEventListener('click', e => {
      if (!this._key || this._el.contains(e.target) || this._anchor?.contains(e.target)) return;
      this.close();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this._closeFromKeyboard(); });
    for (const name of MODAL_EVENTS) eventBus.on(name, () => this.close());
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
      new MutationObserver(() => { if (!overlay.classList.contains('hidden')) this.close(); })
        .observe(overlay, { attributes: true, attributeFilter: ['class'] });
    }
    window.addEventListener('resize', () => this.close());
    eventBus.on('ui:viewChanged', () => this.close());
    eventBus.on('resources:tick', next => this._onTick(next));
    eventBus.on('resources:ratesChanged', next => this._onTick(next));
  }

  _bindAnchor(el, toggle) {
    if (!el) return;
    el.setAttribute('role', 'button');
    el.setAttribute('data-tooltip-mouse-only', '');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-expanded', 'false');
    el.setAttribute('aria-haspopup', 'dialog');
    el.setAttribute('aria-controls', POPOVER_ID);
    el.addEventListener('click', toggle);
    el.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      this._keyboardOpen = true;
      toggle();
      this._keyboardOpen = false;
    });
  }

  open(key, anchorEl) {
    const snap = this._rm.getSnapshot();
    if (!snap[key] && key !== CAFETERIA_KEY && key !== COMMANDER_KEY && key !== BUFFS_KEY) return;
    this.close();
    document.getElementById('game-tooltip')?.classList.remove('visible');
    this._key = key;
    this._anchor = anchorEl;
    anchorEl?.setAttribute('aria-expanded', 'true');
    this._build(key);
    this._patch(snap);
    if (!this._key) return;
    this._el.setAttribute('aria-label', this._el.querySelector('.chip-popover__title')?.textContent.trim() ?? '');
    this._el.hidden = false;
    this._place();
    if (this._keyboardOpen) this._el.querySelector('button:not([disabled])')?.focus();
  }

  _closeFromKeyboard() {
    if (!this._key) return;
    const anchor = this._anchor;
    const hadFocus = this._el.contains(document.activeElement);
    this.close();
    if (hadFocus) anchor?.focus();
  }

  close() {
    if (!this._key) return;
    this._anchor?.setAttribute('aria-expanded', 'false');
    this._key = null;
    this._anchor = null;
    this._el.hidden = true;
  }

  _toggleCommander() {
    eventBus.emit('ui:click');
    if (this._key === COMMANDER_KEY) this.close();
    else this.open(COMMANDER_KEY, document.getElementById('player-chip'));
  }

  _toggleBuffs() {
    eventBus.emit('ui:click');
    if (this._key === BUFFS_KEY) this.close();
    else this.open(BUFFS_KEY, document.getElementById(BUFF_BADGE_ID));
  }

  _onBuffChange() {
    if (this._key !== BUFFS_KEY) return;
    const model = buffPopoverModel(liveBuffEntries(this._buffSystems));
    if (model.signature === this._buffSignature) {
      patchBuffTimes(this._el);
      this._place();
      return;
    }
    this._buildBuffs(model);
    this._place();
  }

  _onBuffTick() {
    this._onBuffChange();
  }

  _buildBuffs(model = buffPopoverModel(liveBuffEntries(this._buffSystems))) {
    this._buffSignature = model.signature;
    this._el.innerHTML = buffPopoverHtml(model);
    this._indexParts();
  }

  _onCommanderChange() {
    if (this._key !== COMMANDER_KEY) return;
    this._patch();
    this._place();
  }

  _toggle(chip) {
    eventBus.emit('ui:click');
    const key = chip.id.slice(4);
    if (this._key === key) this.close();
    else this.open(key, chip);
  }

  _onTick(snap) {
    if (!this._key || this._key === COMMANDER_KEY || this._key === BUFFS_KEY) return;
    const now = Date.now();
    if (now - this._lastTickAt < TICK_THROTTLE_MS) return;
    this._lastTickAt = now;
    this._patch(snap);
    this._place();
  }

  _onAction(e) {
    const node = e.target.closest('[data-pop]');
    const action = node?.dataset.pop;
    if (action === 'items') eventBus.emit('ui:openInventory');
    else if (action === 'buffs') {
      eventBus.emit('ui:click');
      eventBus.emit('ui:openBuffs');
    } else if (action === 'trade') eventBus.emit('ui:openTradingTab', { tab: node.dataset.tab });
    else if (action === 'restock') return this._restock();
    else if (action === 'profile') {
      eventBus.emit('ui:click');
      eventBus.emit('ui:openProfile');
    } else if (action === 'cafeteria') eventBus.emit('ui:openBuildingInfo', { buildingId: 'cafeteria' });
    else return;
    this.close();
  }

  _restock() {
    eventBus.emit('ui:click');
    const message = restockAll(this._bm);
    this._parts.msg.textContent = message;
    this._parts.msg.hidden = !message;
    this._patch(this._rm.getSnapshot());
    this._place();
  }

  _build(key) {
    if (key === BUFFS_KEY) {
      this._buildBuffs();
      return;
    }
    if (key === COMMANDER_KEY) {
      this._el.innerHTML = commanderHtml();
      this._indexParts();
      return;
    }
    if (key === CAFETERIA_KEY) {
      this._el.innerHTML = cafeteriaHtml();
      this._indexParts();
      return;
    }
    const title = `<h5 class="chip-popover__title"><span class="res-icon res-icon--${key}"></span>${RES_META[key].label}</h5>`;
    this._el.innerHTML = WALLET_KEYS.includes(key) ? this._walletHtml(key, title) : this._resourceHtml(title);
    this._indexParts();
  }

  _indexParts() {
    this._parts = {};
    for (const node of this._el.querySelectorAll('[data-part]')) this._parts[node.dataset.part] = node;
  }

  _walletHtml(key, title) {
    const cta = key === 'money' ? 'Trading Post' : 'Get more';
    return `${title}${this._row('Money', 'money')}${this._row('Diamond', 'diamond')}
      <div class="chip-popover__note">No storage limit</div>
      <div class="chip-popover__acts"><button class="btn btn-primary chip-popover__btn" data-pop="trade" data-tab="${TRADE_TABS[key]}">${cta}</button></div>`;
  }

  _resourceHtml(title) {
    return `${title}${this._row('Stock', 'stock')}
      <div class="chip-popover__bar"><i data-part="fill"></i></div>
      ${this._row('Production', 'rate')}${this._row('', 'full')}
      <div class="chip-popover__acts">
        <button class="btn btn-primary chip-popover__btn" data-pop="items">Use items</button>
        <button class="btn chip-popover__btn chip-popover__btn--ghost" data-pop="storage" disabled>Upgrade storage</button>
      </div>`;
  }

  _row(label, part) {
    return `<div class="chip-popover__row"><span data-part="${part}-label">${label}</span><b data-part="${part}"></b></div>`;
  }

  _patch(snap) {
    if (this._key === BUFFS_KEY) return;
    if (this._key === COMMANDER_KEY) {
      patchCommander(this._parts, commanderRows(this._user.getProfile(), this._user.getVipTier()));
      return;
    }
    if (this._key === CAFETERIA_KEY) {
      const totals = cafeteriaTotals(this._bm);
      if (totals.count === 0) this.close();
      else patchCafeteria(this._parts, totals);
      return;
    }
    const res = snap[this._key];
    if (!res) return;
    const p = this._parts;
    if (WALLET_KEYS.includes(this._key)) {
      p.money.textContent = exact(snap.money?.amount ?? 0);
      p.diamond.textContent = exact(snap.diamond?.amount ?? 0);
      return;
    }
    const capped = Number.isFinite(res.cap) && res.cap > 0;
    const state = fillState(res.amount, res.cap);
    p.stock.textContent = capped ? `${exact(res.amount)} / ${exact(res.cap)}` : exact(res.amount);
    p.fill.style.width = `${(fillRatio(res.amount, res.cap) * 100).toFixed(1)}%`;
    p.fill.dataset.state = state;
    p.fill.style.setProperty('--pop-res', `var(--clr-res-${this._key})`);
    p.rate.textContent = `+${res.perSec.toFixed(1)}/s`;
    this._patchFull(res, capped, state);
  }

  _patchFull(res, capped, state) {
    const label = this._parts['full-label'];
    const value = this._parts.full;
    value.classList.toggle('chip-popover__bad', state === 'full');
    if (!capped) {
      label.textContent = '';
      value.textContent = 'No storage limit';
      return;
    }
    label.textContent = 'Full in';
    if (state === 'full') { value.textContent = 'Full — production stopped'; return; }
    const secs = timeToFull(res.amount, res.cap, res.perSec);
    value.textContent = secs === null ? '—' : formatDuration(secs);
  }

  _place() {
    if (!this._anchor) return;
    this._el.style.left = '0px';
    const a = this._anchor.getBoundingClientRect();
    const maxLeft = window.innerWidth - this._el.offsetWidth - VIEWPORT_MARGIN;
    const maxTop = window.innerHeight - this._el.offsetHeight - VIEWPORT_MARGIN;
    const left = Math.max(VIEWPORT_MARGIN, Math.min(a.left, maxLeft));
    const top = Math.max(VIEWPORT_MARGIN, Math.min(a.bottom + ANCHOR_GAP, maxTop));
    this._el.style.left = `${left}px`;
    this._el.style.top = `${top}px`;
  }
}
