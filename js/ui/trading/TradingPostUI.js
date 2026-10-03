import { eventBus } from '../../core/EventBus.js';
import { fmt } from '../uiUtils.js';

const VIEW_ID = 'trading';
const TAB_ORDER = ['supply', 'market', 'premium'];
const TAB_ALIAS = { exchange: 'market', trader: 'market' };
const TICK_PATCH_MS = 500;

export class TradingPostUI {
  /** @param {{ rm, bm, tech, inventory, heroes, user, shop, market, notifications }} systems */
  constructor(systems) {
    this._s = systems;
    this._tabs = [];
    this._activeId = null;
    this._shownId = null;
    this._visible = false;
    this._pending = null;
    this._ready = false;
    this._lastPatchMs = 0;
    this._lastWallet = { money: null, diamond: null };
  }

  init() {
    const root = document.getElementById('trading-post-root');
    if (!root) return;
    root.innerHTML = `
      <div class="tp">
        <header class="tp__header">
          <h2 class="tp__title">Trading Post</h2>
          <nav class="tp__tabs" role="tablist"></nav>
          <div class="tp__wallet">
            <span class="tp__coin tp__coin--money"></span>
            <span class="tp__coin tp__coin--diamond"></span>
          </div>
        </header>
        <div class="tp__locked hidden">
          <h3 class="tp__locked-title">Locked</h3>
          <p class="tp__locked-reason"></p>
        </div>
        <div class="tp__panes"></div>
      </div>`;
    this._tabBar = root.querySelector('.tp__tabs');
    this._panes = root.querySelector('.tp__panes');
    this._lockedCard = root.querySelector('.tp__locked');
    this._lockedReason = root.querySelector('.tp__locked-reason');
    this._moneyEl = root.querySelector('.tp__coin--money');
    this._diamondEl = root.querySelector('.tp__coin--diamond');

    this._tabBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.tp__tab');
      if (!btn) return;
      eventBus.emit('ui:click');
      this._select(btn.dataset.tab);
    });

    eventBus.on('ui:viewChanged', (v) => this._onViewChanged(v));
    eventBus.on('ui:openTradingTab', (req) => this._onOpenTab(req));
    eventBus.on('tradingpost:refreshDots', () => this.refreshDots());
    eventBus.on('resources:tick', () => this._onResources(false));
    eventBus.on('resources:added', () => this._onResources(true));
    eventBus.on('resources:spent', () => this._onResources(true));

    this._ready = true;
    this._tabs.forEach(tab => this._mountTab(tab));
    this._renderTabBar();
    this._patchWallet();
    this.refreshDots();
  }

  /**
   * @param {{ id: 'supply'|'market'|'premium', label: string,
   *           presenter: { mount(el), render(), patch(), onShow?(), onHide?(), hasDot?(), openCategory?(c) },
   *           lock?: () => string | null }} def
   */
  registerTab(def) {
    if (this._tabs.some(t => t.id === def.id)) return;
    const tab = { ...def, pane: null };
    this._tabs.push(tab);
    this._tabs.sort((a, b) => TAB_ORDER.indexOf(a.id) - TAB_ORDER.indexOf(b.id));
    if (!this._ready) return;
    this._mountTab(tab);
    this._renderTabBar();
    this.refreshDots();
  }

  refreshDots() {
    if (!this._ready) return;
    let any = false;
    for (const tab of this._tabs) {
      const on = !tab.lock?.() && !!tab.presenter.hasDot?.();
      any = any || on;
      this._tabBar.querySelector(`.tp__tab[data-tab="${tab.id}"] .tp-dot`)?.classList.toggle('hidden', !on);
    }
    const nav = document.getElementById('nav-economy');
    if (nav) {
      nav.dataset.tpBadge = any ? '1' : '';
      nav.classList.toggle('tab-has-badge', any);
    }
    eventBus.emit('tradingpost:dotsChanged', { active: any });
  }

  _mountTab(tab) {
    tab.pane = document.createElement('div');
    tab.pane.className = 'tp__pane hidden';
    tab.pane.dataset.tab = tab.id;
    this._panes.appendChild(tab.pane);
    tab.presenter.mount(tab.pane);
  }

  _renderTabBar() {
    this._tabBar.innerHTML = this._tabs.map(t => `
      <button class="tp__tab" role="tab" data-tab="${t.id}">
        ${t.label}<span class="tp-dot hidden"></span>
      </button>`).join('');
    this._syncActiveTab();
  }

  _syncActiveTab() {
    this._tabBar.querySelectorAll('.tp__tab').forEach(btn => {
      const active = btn.dataset.tab === this._activeId;
      btn.classList.toggle('tp__tab--active', active);
      btn.setAttribute('aria-selected', String(active));
    });
  }

  _find(id) {
    return this._tabs.find(t => t.id === id);
  }

  _select(id) {
    const next = this._find(id);
    if (!next) return;
    this._activeId = id;
    this._syncActiveTab();
    this._showActive();
  }

  _showActive() {
    const tab = this._find(this._activeId);
    if (!tab) return;
    const reason = tab.lock?.() ?? null;
    this._tabs.forEach(t => t.pane.classList.add('hidden'));
    this._lockedCard.classList.toggle('hidden', !reason);
    if (reason) {
      this._lockedReason.textContent = reason;
      this._hideShown();
      return;
    }
    tab.pane.classList.remove('hidden');
    tab.presenter.render();
    if (this._visible) this._markShown(tab);
  }

  _markShown(tab) {
    if (this._shownId === tab.id) return;
    this._hideShown();
    this._shownId = tab.id;
    tab.presenter.onShow?.();
    eventBus.emit('tradingpost:tabShown', { id: tab.id });
  }

  _hideShown() {
    const tab = this._find(this._shownId);
    if (!tab) return;
    this._shownId = null;
    tab.presenter.onHide?.();
    eventBus.emit('tradingpost:tabHidden', { id: tab.id });
  }

  _onViewChanged(viewId) {
    const wasVisible = this._visible;
    this._visible = viewId === VIEW_ID;
    if (wasVisible && !this._visible) {
      this._hideShown();
      return;
    }
    if (!this._visible) return;
    const req = this._pending;
    if (wasVisible && !req) return;
    this._pending = null;
    if (!this._activeId && this._tabs.length) this._activeId = this._tabs[0].id;
    if (req) this._applyRequest(req);
    else this._select(this._activeId);
    this._patchWallet();
  }

  _onOpenTab(req) {
    if (!req) return;
    if (this._visible) this._applyRequest(req);
    else this._pending = req;
  }

  _applyRequest({ tab, category }) {
    const target = this._find(TAB_ALIAS[tab] ?? tab) ?? this._find(this._activeId) ?? this._tabs[0];
    if (!target) return;
    this._select(target.id);
    if (!target.lock?.()) target.presenter.openCategory?.(category);
  }

  _onResources(immediate) {
    const now = Date.now();
    if (!immediate && now - this._lastPatchMs < TICK_PATCH_MS) return;
    this._lastPatchMs = now;
    this._patchWallet();
    this._refreshDotsOnLockChange();
    if (!this._visible) return;
    const tab = this._find(this._activeId);
    if (!tab) return;
    const locked = !this._lockedCard.classList.contains('hidden');
    if (locked !== !!tab.lock?.()) this._showActive();
    else if (!locked) tab.presenter.patch();
  }

  _refreshDotsOnLockChange() {
    const signature = this._tabs.map(t => (t.lock?.() ? '1' : '0')).join('');
    if (signature === this._lockSignature) return;
    this._lockSignature = signature;
    this.refreshDots();
  }

  _patchWallet() {
    const snap = this._s.rm.getSnapshot();
    const money = Math.floor(snap.money?.amount ?? 0);
    const diamond = Math.floor(snap.diamond?.amount ?? 0);
    if (money !== this._lastWallet.money) {
      this._moneyEl.textContent = `🪙 ${fmt(money)}`;
      this._lastWallet.money = money;
    }
    if (diamond !== this._lastWallet.diamond) {
      this._diamondEl.textContent = `💎 ${fmt(diamond)}`;
      this._lastWallet.diamond = diamond;
    }
  }
}
