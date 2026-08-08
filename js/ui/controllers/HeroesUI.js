import { eventBus } from '../../core/EventBus.js';
import { HeroRosterPanel } from '../heroes/HeroRosterPanel.js';
import { HeroDetailPanel } from '../heroes/HeroDetailPanel.js';

const TABS = ['roster', 'recruit', 'assign'];

export class HeroesUI {
  /** @param {{ rm, um, bm, heroes, inventory, notifications }} systems */
  constructor(systems) {
    this._s = systems;
    this._activeTab = 'roster';
    this._tabs = null;
    this._panelEls = {};
    this._roster = new HeroRosterPanel(systems);
    this._detail = new HeroDetailPanel(systems);
  }

  init() {
    this._tabs = document.getElementById('heroes-tabs');
    for (const tab of TABS) this._panelEls[tab] = document.getElementById(`heroes-tab-${tab}`);
    if (!this._tabs || !this._panelEls.roster) return;

    this._roster.init(this._panelEls.roster);
    this._detail.init(document.getElementById('heroes-detail-pane'));
    this._roster.onSelect(heroId => this._detail.showHero(heroId));

    this._tabs.querySelectorAll('.heroes-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        eventBus.emit('ui:click');
        this._showTab(btn.dataset.tab);
      });
    });

    eventBus.on('ui:viewChanged',  v => { if (v === 'heroes') this._showTab(this._activeTab); });
    eventBus.on('ui:openHeroesTab', tab => {
      if (!TABS.includes(tab)) return;
      this._activeTab = tab;
      this._showTab(tab);
    });
    eventBus.on('heroes:updated',    () => this._patchActive());
    eventBus.on('inventory:updated', () => this._patchActive());
    eventBus.on('hero:levelUp',  d => this._s.notifications?.show('success', '⚔️ Hero Level Up!', `${d.name} reached Lv.${d.level}!`));
    eventBus.on('hero:awakened', d => this._s.notifications?.show('success', '✨ Awakened!', `${d.name} is now ★${d.stars}!`));
  }

  _showTab(tab) {
    this._activeTab = tab;
    for (const id of TABS) this._panelEls[id]?.classList.toggle('hidden', id !== tab);
    this._tabs?.querySelectorAll('.heroes-tab').forEach(b => {
      b.classList.toggle('heroes-tab--active', b.dataset.tab === tab);
    });
    this._panelFor(tab)?.render();
  }

  _patchActive() {
    this._panelFor(this._activeTab)?.patch();
    if (this._activeTab === 'roster') this._detail.patch();
  }

  _panelFor(tab) { return tab === 'roster' ? this._roster : null; }
}
