import { eventBus } from '../../core/EventBus.js';
import { SHOP_CONFIG } from '../../entities/GAME_DATA.js';
import { pickForYou } from '../../systems/trading/forYouPicks.js';
import { SPEEDUP_DURATIONS, SPEEDUP_TYPES, speedupItemId } from '../../systems/trading/speedupCatalog.js';
import { entryCard } from './entryCard.js';
import { patchCard } from './tradeCards.js';
import { FeaturedBanner } from './featuredBanner.js';
import { CrateCard } from './CrateCard.js';
import { buildForYouSnapshot } from './forYouSnapshot.js';
import { useOwnedItem } from './useOwnedItem.js';
import { BUY_FAILURE_TEXT } from './buyFailureText.js';

const CATEGORIES = SHOP_CONFIG.supply.map(({ id, label }) => ({ id, label }));
const DURATION_LABEL = { '5m': '5 min', '15m': '15 min', '1h': '1 hour', '8h': '8 hours', instant: 'Instant' };
const TYPE_LABEL = { universal: 'Universal', build: 'Build', train: 'Train', research: 'Research' };

export class SupplyTab {
  /** @param {{ rm, bm, um, tech, inventory, heroes, shop, notifications }} systems */
  constructor(systems) {
    this._s = systems;
    this._category = CATEGORIES[0].id;
    this._speedupType = 'universal';
    this._shown = false;
    this._banner = new FeaturedBanner(systems.shop);
    this._crate = new CrateCard(systems.shop);
  }

  hasDot() {
    return this._crate.hasDot();
  }

  mount(el) {
    el.innerHTML = `
      <div class="tp-supply__top">
        <div class="tp-supply__banner"></div>
        <div class="tp-supply__crate"></div>
      </div>
      <h4 class="tp-supply__label">For you <small>picked from what your base needs right now</small></h4>
      <div class="tp-foryou tp-row"></div>
      <div class="tp-supply__bar">
        <div class="tp-seg tp-seg--category">${CATEGORIES.map(c =>
          `<button class="tp-seg__btn" data-category="${c.id}">${c.label}</button>`).join('')}</div>
        <div class="tp-seg tp-supply__types hidden">${SPEEDUP_TYPES.map(t =>
          `<button class="tp-seg__btn" data-speedup-type="${t}">${TYPE_LABEL[t]}</button>`).join('')}</div>
      </div>
      <div class="tp-supply__grid tp-row"></div>`;
    el.querySelector('.tp-supply__banner').appendChild(this._banner.el);
    el.querySelector('.tp-supply__crate').appendChild(this._crate.el);
    this._forYou = el.querySelector('.tp-foryou');
    this._grid = el.querySelector('.tp-supply__grid');
    this._categoryBar = el.querySelector('.tp-seg--category');
    this._typeBar = el.querySelector('.tp-supply__types');
    this._el = el;

    el.addEventListener('click', (e) => this._onClick(e));
    eventBus.on('inventory:updated', () => { if (this._shown) this.patch(); });
  }

  render() {
    this._banner.show();
    this._renderForYou();
    this._renderGrid();
  }

  patch() {
    this._banner.patch();
    this._crate.patch();
    this._el.querySelectorAll('.tp-card').forEach(card => {
      if (card.closest('.tp-featured')) return;
      patchCard(card, this._s.shop.entryState(card.dataset.entryId));
    });
  }

  onShow() {
    this._shown = true;
    this._banner.start();
    this._crate.start();
  }

  onHide() {
    this._shown = false;
    this._banner.stop();
    this._crate.stop();
  }

  openCategory(category) {
    if (!CATEGORIES.some(c => c.id === category)) return;
    this._category = category;
    this._renderGrid();
  }

  _renderForYou() {
    const picks = pickForYou(buildForYouSnapshot(this._s));
    const cards = picks.map(p => entryCard(this._s.shop, p.entryId, { reason: p.reason })).filter(Boolean);
    this._forYou.replaceChildren(...cards);
  }

  _renderGrid() {
    this._categoryBar.querySelectorAll('.tp-seg__btn').forEach(b =>
      b.classList.toggle('tp-seg__btn--on', b.dataset.category === this._category));
    const speedups = this._category === 'speedups';
    this._typeBar.classList.toggle('hidden', !speedups);
    this._typeBar.querySelectorAll('.tp-seg__btn').forEach(b =>
      b.classList.toggle('tp-seg__btn--on', b.dataset.speedupType === this._speedupType));
    const cards = speedups ? this._speedupCards() : this._categoryCards();
    this._grid.replaceChildren(...cards.filter(Boolean));
  }

  _categoryCards() {
    const category = SHOP_CONFIG.supply.find(c => c.id === this._category);
    return category.items.map(item => entryCard(this._s.shop, item.entryId));
  }

  _speedupCards() {
    return SPEEDUP_DURATIONS.map(duration => entryCard(
      this._s.shop,
      speedupItemId(duration, this._speedupType),
      { name: DURATION_LABEL[duration] },
    ));
  }

  _onClick(e) {
    const seg = e.target.closest('.tp-seg__btn');
    if (seg?.dataset.category) {
      this.openCategory(seg.dataset.category);
      return;
    }
    if (seg?.dataset.speedupType) {
      this._speedupType = seg.dataset.speedupType;
      this._renderGrid();
      return;
    }
    const buy = e.target.closest('.tp-card__buy');
    if (buy && !buy.disabled) return this._buy(buy.dataset.entryId);
    const use = e.target.closest('.tp-card__use');
    if (use) useOwnedItem(use.dataset.itemId, use, this._s);
  }

  _buy(entryId) {
    const result = this._s.shop.buy(entryId);
    if (!result.success) {
      eventBus.emit('ui:error');
      this._s.notifications?.show('warning', 'Cannot Buy', BUY_FAILURE_TEXT[result.reason] ?? result.reason);
      return;
    }
    const name = this._el.querySelector(`[data-entry-id="${entryId}"] .tp-card__name`)?.textContent ?? 'Item';
    this._s.notifications?.show('success', 'Purchased', name);
    this.render();
  }
}
