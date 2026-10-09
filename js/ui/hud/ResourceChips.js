import { eventBus } from '../../core/EventBus.js';
import { RES_META } from '../uiUtils.js';
import { tickTo } from '../fx/numberTicker.js';
import { icon } from '../icons.js';
import { compact, fillState, fillRatio, LOW_STOCK_RATIO } from './hudFormat.js';
import { cafeteriaTotals, cafeteriaTipHtml } from './cafeteriaPopover.js';

const TICK_THROTTLE_MS = 500;
const RESOURCE_KEYS = Object.keys(RES_META).filter(key => key !== 'xp');

export class ResourceChips {
  constructor({ rm, bm }) {
    this._rm = rm;
    this._bm = bm;
    this._lastTickAt = 0;
    this._chips = new Map();
    this._cafeteria = null;
    this._bar = null;
  }

  init() {
    this._bar = document.getElementById('resource-bar');
    for (const key of RESOURCE_KEYS) this._chips.set(key, this._cacheChip(key));
    this._cafeteria = this._cacheChip('cafeteria');
    this._cafeteria.chip?.removeAttribute('title');
    eventBus.on('resources:tick', snap => this._onTick(snap));
    eventBus.on('resources:ratesChanged', snap => this.render(snap));
    this.render(this._rm.getSnapshot());
  }

  render(snap) {
    for (const key of RESOURCE_KEYS) {
      const res = snap[key];
      if (res) this._renderChip(this._chips.get(key), res.amount, res.cap, res.perSec);
    }
    this._renderCafeteria();
  }

  _cacheChip(key) {
    const id = name => document.getElementById(`${name}-${key}`);
    return { chip: id('res'), value: id('v'), rate: id('r'), cap: id('c') };
  }

  _onTick(snap) {
    const now = Date.now();
    if (now - this._lastTickAt < TICK_THROTTLE_MS) return;
    this._lastTickAt = now;
    this.render(snap);
  }

  _renderChip(els, amount, cap, perSec) {
    const hasCap = Number.isFinite(cap) && cap > 0;
    if (els.value) tickTo(els.value, amount, compact);
    if (els.rate) els.rate.textContent = perSec > 0 ? `+${perSec.toFixed(1)}/s` : '';
    if (els.cap) els.cap.textContent = hasCap ? `/ ${compact(cap)}` : '';
    if (!els.chip) return;
    const state = fillState(amount, cap);
    els.chip.style.setProperty('--fill', fillRatio(amount, cap).toFixed(3));
    els.chip.classList.toggle('resource-chip--near', state === 'near');
    els.chip.classList.toggle('resource-chip--full', state === 'full');
  }

  _renderCafeteria() {
    const els = this._cafeteria;
    if (!els.chip) return;
    const stocks = this._bm?.getCafeteriaStock?.() ?? [];
    const shown = stocks.length > 0;
    els.chip.style.display = shown ? '' : 'none';
    this._bar?.classList.toggle('resource-bar--six', shown);
    if (!shown) return;
    els.chip.dataset.tooltipHtml = cafeteriaTipHtml(cafeteriaTotals(this._bm));
    const sum = pick => stocks.reduce((total, s) => total + pick(s), 0);
    const stock = Math.min(sum(s => s.stock.food), sum(s => s.stock.water));
    const cap = Math.min(sum(s => s.stockCap.food), sum(s => s.stockCap.water));
    this._renderChip(els, Math.floor(stock), cap, 0);
    const low = cap > 0 && stock / cap < LOW_STOCK_RATIO;
    els.chip.classList.toggle('resource-chip--low', low);
    if (els.rate) els.rate.innerHTML = low ? `${icon('warning')} Low` : '';
  }
}
