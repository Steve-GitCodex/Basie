import { eventBus } from '../../core/EventBus.js';
import { escapeHtml } from '../uiUtils.js';
import { portraitHtml, rarityClass, shardProgress, TIER_META } from './heroCardView.js';

const TIER_FILTERS = [
  { id: 'all',       label: 'All Heroes' },
  { id: 'normal',    label: '● Normal' },
  { id: 'epic',      label: '◆ Epic' },
  { id: 'legendary', label: '★ Legendary' },
];

function cardSignature(hero) {
  return [hero.isOwned, hero.level, hero.stars, hero.shardQty].join('|');
}

export class HeroRosterPanel {
  constructor(systems) {
    this._s = systems;
    this._root = null;
    this._rosterEl = null;
    this._grid = null;
    this._ownedEl = null;
    this._detailHost = null;
    this._tierFilter = 'all';
    this._onSelect = null;
  }

  init(rootEl) {
    this._root = rootEl;
    this._root.innerHTML = `
      <div class="hq-roster">
        <div class="hq-roster__head">
          <div class="tier-filter-bar">
            ${TIER_FILTERS.map(f => `<button class="tier-pill${f.id === 'all' ? ' tier-pill--active' : ''}" data-tier="${f.id}">${f.label}</button>`).join('')}
          </div>
          <span class="hq-roster__owned"></span>
        </div>
        <div class="hq-grid" id="heroes-roster-grid"></div>
      </div>
      <div class="hq-detail-host hidden" id="heroes-detail-pane"></div>`;
    this._rosterEl = this._root.querySelector('.hq-roster');
    this._grid = this._root.querySelector('#heroes-roster-grid');
    this._ownedEl = this._root.querySelector('.hq-roster__owned');
    this._detailHost = this._root.querySelector('#heroes-detail-pane');

    this._root.querySelectorAll('.tier-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        eventBus.emit('ui:click');
        this._tierFilter = btn.dataset.tier;
        this._root.querySelectorAll('.tier-pill').forEach(b => b.classList.toggle('tier-pill--active', b === btn));
        this.render();
      });
    });
    this._grid.addEventListener('click', e => {
      const card = e.target.closest('.hq-card');
      if (!card) return;
      eventBus.emit('ui:click');
      this._onSelect?.(card.dataset.heroId);
    });
  }

  onSelect(cb) { this._onSelect = cb; }

  detailHost() { return this._detailHost; }

  setMode(mode) {
    this._rosterEl?.classList.toggle('hidden', mode === 'detail');
    this._detailHost?.classList.toggle('hidden', mode !== 'detail');
  }

  visibleHeroIds() { return this._filtered().map(h => h.id); }

  render() {
    if (!this._grid) return;
    const heroes = this._filtered();
    this._grid.innerHTML = heroes.map(h => this._cardHtml(h)).join('')
      || `<div class="heroes-empty">No heroes in this tier yet.</div>`;
    this._renderOwnedCount();
  }

  patch() {
    if (!this._grid) return;
    const heroes = this._filtered();
    const cards = [...this._grid.querySelectorAll('.hq-card')];
    const sameSet = cards.length === heroes.length && heroes.every((h, i) => cards[i].dataset.heroId === h.id);
    if (!sameSet) { this.render(); return; }
    heroes.forEach((hero, i) => {
      if (cards[i].dataset.sig !== cardSignature(hero)) cards[i].outerHTML = this._cardHtml(hero);
    });
    this._renderOwnedCount();
  }

  _filtered() {
    const roster = this._s.heroes.getRosterWithState();
    return this._tierFilter === 'all' ? roster : roster.filter(h => h.tier === this._tierFilter);
  }

  _renderOwnedCount() {
    const roster = this._s.heroes.getRosterWithState();
    this._ownedEl.textContent = `Owned ${roster.filter(h => h.isOwned).length} / ${roster.length}`;
  }

  _cardHtml(hero) {
    return `
      <button type="button" class="hq-card ${rarityClass(hero)}${hero.isOwned ? '' : ' hq-card--locked'}"
              data-hero-id="${hero.id}" data-sig="${cardSignature(hero)}">
        ${hero.isOwned ? `<span class="hq-card__level">LV ${hero.level}</span>` : ''}
        <span class="hq-card__art">${portraitHtml(hero, 'splash')}</span>
        <span class="hq-card__foot">
          <span class="hq-card__name">${escapeHtml(hero.name)}</span>
          ${hero.isOwned ? this._ownedFootHtml(hero) : this._lockedFootHtml(hero)}
        </span>
      </button>`;
  }

  _ownedFootHtml(hero) {
    const meta = TIER_META[hero.tier] ?? TIER_META.normal;
    return `
      <span class="hq-card__sub">
        <span class="hq-card__rarity">${meta.label}</span>
        <span class="hq-card__stars">${'★'.repeat(hero.stars ?? 0)}</span>
      </span>`;
  }

  _lockedFootHtml(hero) {
    const shards = shardProgress(hero);
    return `
      <span class="hq-card__sub hq-card__shards">Hero Shards ${shards.have} / ${shards.need}</span>
      <span class="hq-bar${shards.ready ? ' hq-bar--ready' : ''}"><i style="width:${shards.pct}%"></i></span>`;
  }
}
