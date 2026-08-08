import { eventBus } from '../../core/EventBus.js';
import { TIER_CSS_SUFFIX } from '../uiUtils.js';
import { portraitHtml, statusChipHtml, tierPillHtml, TIER_META } from './heroCardView.js';
import { squadNameForHero } from './heroSquadLookup.js';

const TIER_FILTERS = [
  { id: 'all',       label: 'All Heroes' },
  { id: 'normal',    label: '● Normal' },
  { id: 'epic',      label: '◆ Epic' },
  { id: 'legendary', label: '★ Legendary' },
];

export class HeroRosterPanel {
  constructor(systems) {
    this._s = systems;
    this._root = null;
    this._grid = null;
    this._tierFilter = 'all';
    this._selectedHeroId = null;
    this._onSelect = null;
  }

  init(rootEl) {
    this._root = rootEl;
    this._root.innerHTML = `
      <div class="hero-control-bar">
        <div class="tier-filter-bar">
          ${TIER_FILTERS.map(f => `<button class="tier-pill${f.id === 'all' ? ' tier-pill--active' : ''}" data-tier="${f.id}">${f.label}</button>`).join('')}
        </div>
      </div>
      <div class="heroes-split-layout">
        <div class="heroes-roster-grid" id="heroes-roster-grid"></div>
        <div class="heroes-detail-pane" id="heroes-detail-pane"></div>
      </div>`;
    this._grid = this._root.querySelector('#heroes-roster-grid');
    this._root.querySelectorAll('.tier-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        eventBus.emit('ui:click');
        this._tierFilter = btn.dataset.tier;
        this._root.querySelectorAll('.tier-pill').forEach(b => b.classList.toggle('tier-pill--active', b === btn));
        this.render();
      });
    });
  }

  onSelect(cb) { this._onSelect = cb; }

  selectHero(heroId) {
    this._selectedHeroId = heroId;
    this._grid?.querySelectorAll('.hero-roster-card').forEach(c => {
      c.classList.toggle('hero-roster-card--selected', c.dataset.heroId === heroId);
    });
    this._onSelect?.(heroId);
  }

  render() {
    if (!this._grid) return;
    const heroes = this._filtered();
    this._grid.innerHTML = heroes.map(h => this._cardHtml(h)).join('')
      || `<div class="heroes-empty">No heroes in this tier yet.</div>`;
    this._grid.querySelectorAll('.hero-roster-card').forEach(card => {
      card.addEventListener('click', () => {
        eventBus.emit('ui:click');
        this.selectHero(card.dataset.heroId);
      });
    });
    if (!heroes.find(h => h.id === this._selectedHeroId) && heroes.length > 0) {
      this.selectHero(heroes[0].id);
    }
  }

  patch() {
    if (!this._grid) return;
    const byId = new Map(this._filtered().map(h => [h.id, h]));
    const cards = this._grid.querySelectorAll('.hero-roster-card');
    if (cards.length !== byId.size) { this.render(); return; }
    for (const card of cards) {
      const hero = byId.get(card.dataset.heroId);
      if (!hero) { this.render(); return; }
      card.querySelector('.hero-roster-status').innerHTML = statusChipHtml(hero, { squadName: this._squadName(hero) });
      const lvl = card.querySelector('.hero-level-pip');
      if (lvl) lvl.textContent = `Lv.${hero.level}`;
    }
  }

  _filtered() {
    const roster = this._s.heroes.getRosterWithState();
    return this._tierFilter === 'all' ? roster : roster.filter(h => h.tier === this._tierFilter);
  }

  _squadName(hero) { return squadNameForHero(hero, this._s.um); }

  _cardHtml(hero) {
    const suffix = TIER_CSS_SUFFIX[hero.tier] ?? 'common';
    const meta = TIER_META[hero.tier] ?? TIER_META.normal;
    return `
      <div class="hero-roster-card hero-roster-card--${suffix}${hero.id === this._selectedHeroId ? ' hero-roster-card--selected' : ''}"
           data-hero-id="${hero.id}" data-tier="${meta.label}">
        <div class="hero-roster-portrait">${portraitHtml(hero, 'thumb')}</div>
        <div class="hero-roster-info">
          <div class="hero-roster-name">${hero.name}</div>
          <div class="hero-roster-sub">
            ${tierPillHtml(hero)}
            ${hero.isOwned ? `<span class="hero-level-pip">Lv.${hero.level}</span>` : ''}
          </div>
        </div>
        <div class="hero-roster-status">${statusChipHtml(hero, { squadName: this._squadName(hero) })}</div>
      </div>`;
  }
}
