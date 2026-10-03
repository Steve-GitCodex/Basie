import { ExchangeTab } from './ExchangeTab.js';
import { TraderTab } from './TraderTab.js';

export class MarketTab {
  /** @param {{ rm, inventory, heroes, bm, um, tech, market, trader, notifications }} systems */
  constructor(systems) {
    this._exchange = new ExchangeTab(systems);
    this._trader = new TraderTab(systems);
    this._panels = [this._exchange, this._trader];
  }

  hasDot() {
    return this._trader.hasDot();
  }

  mount(el) {
    el.innerHTML = `
      <div class="tp-market">
        <section class="tp-market__panel tp-market__panel--exchange"></section>
        <section class="tp-market__panel tp-market__panel--trader"></section>
      </div>`;
    this._exchange.mount(el.querySelector('.tp-market__panel--exchange'));
    this._trader.mount(el.querySelector('.tp-market__panel--trader'));
  }

  render() {
    this._panels.forEach(p => p.render());
  }

  patch() {
    this._panels.forEach(p => p.patch());
  }

  onShow() {
    this._panels.forEach(p => p.onShow());
  }

  onHide() {
    this._panels.forEach(p => p.onHide());
  }
}
