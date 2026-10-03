import { eventBus } from '../../core/EventBus.js';
import { PRESSURE_CAP } from '../../entities/GAME_DATA.js';
import { RES_META, fmt } from '../uiUtils.js';

const RESOURCES = ['wood', 'stone', 'iron', 'food', 'water', 'money'];
const SEGMENTS = 6;
const WARN_FROM = 3;
const RATE_BASIS = 100;

const fmtInt = (n) => Math.floor(n).toLocaleString();
const fmtRate = (rate) => String(Number(rate.toFixed(1)));

export class ExchangeTab {
  /** @param {{ rm, market, notifications }} systems */
  constructor(systems) {
    this._s = systems;
    this._give = 'wood';
    this._get = 'stone';
    this._amount = 0;
  }

  mount(el) {
    this._root = el;
    el.addEventListener('click', (e) => this._onClick(e));
    el.addEventListener('input', (e) => {
      if (!e.target.classList.contains('tp-exchange__slider')) return;
      this._amount = Number(e.target.value);
      this._patchReadout();
    });
    eventBus.on('market:exchanged', () => this._patchIfShown());
    eventBus.on('market:pricesReset', () => this._patchIfShown());
  }

  onShow() {
    this._shown = true;
  }

  onHide() {
    this._shown = false;
  }

  render() {
    const held = this._maxGive();
    const giveIcon = RES_META[this._give].icon;
    const getIcon = RES_META[this._get].icon;
    this._amount = Math.min(this._amount, held);
    this._root.innerHTML = `
      <div class="tp-exchange">
        <p class="tp-supply__label">You give</p>
        <div class="tp-exchange__chips">${this._chips('give')}</div>
        <p class="tp-supply__label">You get</p>
        <div class="tp-exchange__chips">${this._chips('get')}</div>
        <input class="tp-exchange__slider" type="range" min="0" step="1" max="${held}" value="${this._amount}" aria-label="Amount to give">
        <div class="tp-exchange__scale"><span>0</span><span class="tp-exchange__max"></span></div>
        <div class="tp-exchange__readout">
          <span class="tp-exchange__give">${giveIcon} <span class="tp-exchange__give-n"></span></span>
          <span class="tp-exchange__arrow">→</span>
          <span class="tp-exchange__get">${getIcon} <span class="tp-exchange__get-n"></span></span>
        </div>
        <div class="tp-exchange__foot">
          <div>
            <small class="tp-exchange__rate">Rate today: ${RATE_BASIS} ${giveIcon} → <span class="tp-exchange__rate-n"></span> ${getIcon}</small>
            <div class="tp-exchange__meter">${'<i class="tp-exchange__seg"></i>'.repeat(SEGMENTS)}</div>
            <small class="tp-exchange__hint">Rate worsens as you trade · eases back overnight</small>
            <small class="tp-exchange__storage" hidden></small>
          </div>
          <button class="btn btn-primary tp-exchange__trade">Trade</button>
        </div>
      </div>`;
    this._slider = this._root.querySelector('.tp-exchange__slider');
    this._maxEl = this._root.querySelector('.tp-exchange__max');
    this._storageEl = this._root.querySelector('.tp-exchange__storage');
    this._giveEl = this._root.querySelector('.tp-exchange__give-n');
    this._getEl = this._root.querySelector('.tp-exchange__get');
    this._getNEl = this._root.querySelector('.tp-exchange__get-n');
    this._rateEl = this._root.querySelector('.tp-exchange__rate-n');
    this._segs = [...this._root.querySelectorAll('.tp-exchange__seg')];
    this._tradeBtn = this._root.querySelector('.tp-exchange__trade');
    this.patch();
  }

  patch() {
    if (!this._slider) return;
    const max = this._maxGive();
    this._amount = Math.min(this._amount, max);
    this._slider.max = String(max);
    if (Number(this._slider.value) !== this._amount) this._slider.value = String(this._amount);
    this._maxEl.textContent = `max ${fmtInt(max)}`;
    this._patchStorageHint(max);
    this._root.querySelectorAll('.tp-exchange__chip').forEach((chip) => {
      chip.querySelector('small').textContent = this._chipHeld(chip);
    });
    this._patchReadout();
    this._patchMeter();
  }

  _patchIfShown() {
    if (this._shown) this.patch();
  }

  _chips(side) {
    return RESOURCES.map((key) => {
      const selected = (side === 'give' ? this._give : this._get) === key;
      const blocked = side === 'get' && key === this._give;
      return `
        <button class="tp-exchange__chip${selected ? ' tp-exchange__chip--on' : ''}" data-side="${side}" data-res="${key}"
                title="${RES_META[key].label}"${blocked ? ' disabled' : ''}>
          ${RES_META[key].icon}<small>${blocked ? '—' : fmt(this._held(key))}</small>
        </button>`;
    }).join('');
  }

  _chipHeld(chip) {
    const blocked = chip.dataset.side === 'get' && chip.dataset.res === this._give;
    return blocked ? '—' : fmt(this._held(chip.dataset.res));
  }

  _held(key) {
    return Math.floor(this._s.rm.getSnapshot()[key]?.amount ?? 0);
  }

  _maxGive() {
    const held = this._held(this._give);
    const room = this._s.market.storageRoom(this._get);
    if (!Number.isFinite(room) || (this._quote(held)?.gain ?? 0) <= room) return held;
    let low = 0;
    let high = held;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if ((this._quote(mid)?.gain ?? 0) <= room) low = mid;
      else high = mid - 1;
    }
    return low;
  }

  _patchStorageHint(max) {
    const limited = max < this._held(this._give);
    this._storageEl.hidden = !limited;
    this._storageEl.textContent = max < 1 ? 'Storage full' : 'Limited by storage';
  }

  _quote(amount) {
    try {
      return this._s.market.quote(this._give, this._get, amount);
    } catch (err) {
      if (err instanceof RangeError) return null;
      throw err;
    }
  }

  _patchReadout() {
    const gain = this._amount >= 1 ? (this._quote(this._amount)?.gain ?? 0) : 0;
    this._giveEl.textContent = fmtInt(this._amount);
    this._getNEl.textContent = fmtInt(gain);
    this._getEl.dataset.amount = String(gain);
    const basis = this._quote(RATE_BASIS);
    this._rateEl.textContent = basis ? fmtRate(basis.rate) : '';
    this._tradeBtn.disabled = this._amount < 1 || gain < 1;
  }

  _patchMeter() {
    const pressure = this._s.market.getPressure()[this._give] ?? 1;
    const fraction = (pressure - 1) / (PRESSURE_CAP - 1);
    const lit = Math.ceil(Math.min(1, Math.max(0, fraction)) * SEGMENTS - 1e-9);
    this._segs.forEach((seg, i) => {
      seg.classList.toggle('tp-exchange__seg--on', i < lit);
      seg.classList.toggle('tp-exchange__seg--warn', i < lit && i >= WARN_FROM);
    });
  }

  _onClick(e) {
    const chip = e.target.closest('.tp-exchange__chip');
    if (chip && !chip.disabled) return this._pick(chip.dataset.side, chip.dataset.res);
    if (e.target.closest('.tp-exchange__trade')) this._trade();
  }

  _pick(side, key) {
    if (side === 'give') {
      this._give = key;
      if (this._get === key) this._get = RESOURCES.find((r) => r !== key);
    } else {
      this._get = key;
    }
    this.render();
  }

  _trade() {
    const { _give: give, _get: get, _amount: amount } = this;
    const result = this._s.market.exchange(give, get, amount);
    if (result.success) {
      this._s.notifications?.show('success', 'Traded', `${fmtInt(amount)} ${RES_META[give].label} → ${fmtInt(result.gain)} ${RES_META[get].label}`);
    } else {
      this._s.notifications?.show('warning', 'Cannot Trade', result.reason);
    }
    this.render();
  }
}
