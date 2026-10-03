import { FEATURED_ENTRY_IDS } from '../../entities/GAME_DATA.js';
import { entryCard } from './entryCard.js';
import { patchCard } from './tradeCards.js';

const ROTATE_MS = 6000;

export class FeaturedBanner {
  constructor(shop) {
    this._shop = shop;
    this._index = 0;
    this._timer = null;
    this.el = document.createElement('section');
    this.el.className = 'tp-featured';
    this.el.innerHTML = '<div class="tp-featured__slot"></div><div class="tp-featured__dots"></div>';
    this._slot = this.el.querySelector('.tp-featured__slot');
    this._dots = this.el.querySelector('.tp-featured__dots');
    this._dots.addEventListener('click', (e) => {
      const dot = e.target.closest('.tp-featured__dot');
      if (dot) this.show(Number(dot.dataset.index));
    });
  }

  show(index = this._index) {
    this._index = index % FEATURED_ENTRY_IDS.length;
    const card = entryCard(this._shop, FEATURED_ENTRY_IDS[this._index]);
    this._slot.replaceChildren(...(card ? [card] : []));
    this._dots.innerHTML = FEATURED_ENTRY_IDS.map((_, i) =>
      `<button class="tp-featured__dot${i === this._index ? ' tp-featured__dot--on' : ''}" data-index="${i}" aria-label="Offer ${i + 1}"></button>`).join('');
  }

  patch() {
    const card = this._slot.firstElementChild;
    if (!card) return;
    const state = this._shop.entryState(card.dataset.entryId);
    patchCard(card, state);
  }

  start() {
    this.stop();
    this._timer = setInterval(() => this.show(this._index + 1), ROTATE_MS);
  }

  stop() {
    clearInterval(this._timer);
    this._timer = null;
  }
}
