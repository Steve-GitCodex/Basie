import { eventBus } from '../../core/EventBus.js';
import { collect, timedEntries, statTotals } from '../../systems/buffs/buffLedger.js';
import { buildSnapshot } from './buffSnapshot.js';
import { renderActiveTab } from './BuffsActiveTab.js';
import { renderOverviewTab } from './BuffsOverviewTab.js';
import { activateBoostItem } from './confirmReplace.js';
import { subscribeBuffRefresh } from './buffEvents.js';
import { BuffBadge } from './buffBadge.js';
import { BuffToasts } from './buffToasts.js';
import { ResourceChipTooltips } from './resourceChipTooltips.js';

export class BuffsUI {
  constructor(systems) {
    this._s = systems;
    this._tab = 'active';
    this._expanded = new Set();
    this._openedAt = 0;
    this._frame = null;
  }

  init() {
    new BuffBadge(this._s).init();
    new ResourceChipTooltips(this._s).init();
    new BuffToasts(this._s).init();
    this._overlay = document.getElementById('buffs-panel-overlay');
    this._panel = document.getElementById('buffs-panel');
    if (!this._overlay || !this._panel) return;
    this._panel.innerHTML = `
      <div class="buffs-header">
        <span class="buffs-title">Buffs</span>
        <div class="buffs-tabs">
          <button class="buffs-tab" data-tab="active">Active</button>
          <button class="buffs-tab" data-tab="overview">Overview</button>
        </div>
        <button class="buffs-close" data-close aria-label="Close">✕</button>
      </div>
      <div class="buffs-body"></div>`;
    this._body = this._panel.querySelector('.buffs-body');
    this._tabButtons = {
      active: this._panel.querySelector('[data-tab="active"]'),
      overview: this._panel.querySelector('[data-tab="overview"]'),
    };

    eventBus.on('ui:openBuffs', payload => this._onOpenRequest(payload));
    subscribeBuffRefresh(this._s, () => this._scheduleRender());
    this._overlay.addEventListener('click', e => { if (e.target === this._overlay) this._close(); });
    this._panel.addEventListener('click', e => this._onClick(e));
    this._panel.addEventListener('keydown', e => this._onKey(e));
  }

  _isOpen() {
    return this._panel?.classList.contains('open') ?? false;
  }

  _onOpenRequest(payload) {
    if (!this._panel) return;
    const tab = payload?.tab;
    if (this._isOpen()) {
      if (tab && tab !== this._tab) this._setTab(tab);
      else this._close();
      return;
    }
    if (tab) this._tab = tab;
    this._openedAt = Date.now();
    this._overlay.classList.add('open');
    this._panel.classList.add('open');
    this._render();
  }

  _close() {
    this._overlay.classList.remove('open');
    this._panel.classList.remove('open');
    cancelAnimationFrame(this._frame);
    this._frame = null;
  }

  _setTab(tab) {
    this._tab = tab;
    this._render();
  }

  _scheduleRender() {
    if (!this._isOpen() || this._frame != null) return;
    this._frame = requestAnimationFrame(() => {
      this._frame = null;
      this._render();
    });
  }

  _render() {
    if (!this._isOpen()) return;
    const snapshot = buildSnapshot(this._s);
    const entries = collect(snapshot);
    const timed = timedEntries(entries);
    this._tabButtons.active.textContent = `Active · ${timed.length}`;
    for (const [id, btn] of Object.entries(this._tabButtons)) {
      btn.classList.toggle('buffs-tab--on', id === this._tab);
    }
    this._body.innerHTML = this._tab === 'overview'
      ? renderOverviewTab({ totals: statTotals(entries, snapshot.rateBreakdowns), expanded: this._expanded, snapshot })
      : renderActiveTab({ timed, snapshot, inventory: this._s.inventory, openedAt: this._openedAt });
  }

  _onClick(e) {
    if (e.target.closest('[data-close]')) return this._close();
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) return this._setTab(tabBtn.dataset.tab);
    const toggle = e.target.closest('[data-stat-toggle]');
    if (toggle) return this._toggleStat(toggle.dataset.statToggle);
    const use = e.target.closest('[data-use-item]');
    if (use) return this._useItem(use.dataset.useItem);
    if (e.target.closest('[data-open-supply]')) eventBus.emit('ui:openTradingTab', { tab: 'supply' });
  }

  _onKey(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const toggle = e.target.closest('[data-stat-toggle]');
    if (!toggle) return;
    e.preventDefault();
    this._toggleStat(toggle.dataset.statToggle);
  }

  _toggleStat(statId) {
    if (!this._expanded.delete(statId)) this._expanded.add(statId);
    this._render();
    this._body.querySelector(`[data-stat-toggle="${statId}"]`)?.focus();
  }

  _useItem(itemId) {
    return activateBoostItem(this._s, itemId);
  }
}
