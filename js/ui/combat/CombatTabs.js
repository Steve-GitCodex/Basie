import { eventBus } from '../../core/EventBus.js';

const ACTIVE = 'combat-tabs__tab--active';

export class CombatTabs {
  constructor(navEl, panes, { onShow }) {
    this._buttons = [...navEl.querySelectorAll('[data-tab]')];
    this._panes = panes;
    this._onShow = onShow;
    this._active = 'campaign';
    navEl.addEventListener('click', e => {
      const btn = e.target.closest('[data-tab]');
      if (!btn || btn.dataset.tab === this._active) return;
      eventBus.emit('ui:click');
      this.show(btn.dataset.tab);
    });
  }

  get active() {
    return this._active;
  }

  show(tab) {
    this._active = tab;
    for (const btn of this._buttons) {
      const on = btn.dataset.tab === tab;
      btn.classList.toggle(ACTIVE, on);
      btn.setAttribute('aria-selected', String(on));
    }
    for (const [name, pane] of Object.entries(this._panes)) pane.classList.toggle('hidden', name !== tab);
    this._onShow(tab);
  }
}
