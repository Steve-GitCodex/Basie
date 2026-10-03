import { eventBus } from '../../core/EventBus.js';
import { INVENTORY_ITEMS } from '../../entities/GAME_DATA.js';
import { escapeHtml } from '../uiUtils.js';
import { formatCountdown } from './countdown.js';

const RES_ICON = { wood: '🪵', stone: '🪨', food: '🍖', water: '💧', iron: '⛓️', money: '🪙' };

function describe(result) {
  if (result.itemId) {
    const item = INVENTORY_ITEMS[result.itemId];
    return `${item?.icon ?? '🎁'} ${escapeHtml(item?.name ?? result.itemId)}`;
  }
  return Object.entries(result.applied)
    .map(([res, n]) => `${RES_ICON[res] ?? ''} ${Math.floor(n)} ${res}`).join(', ');
}

function overflowNote(result) {
  const clipped = result.grants && Object.keys(result.grants).some(k => result.applied[k] < result.grants[k]);
  return clipped ? `<p class="tp-crate__note">Storage full — some of this didn't fit.</p>` : '';
}

function openReveal(result) {
  const shade = document.createElement('div');
  shade.className = 'tp-sheet-shade';
  shade.innerHTML = `
    <div class="tp-sheet" role="dialog" aria-modal="true" aria-label="Supply drop">
      <h3 class="tp-sheet__title">Supply drop <button class="tp-sheet__close" aria-label="Close">✕</button></h3>
      <div class="tp-crate__reveal">${describe(result)}</div>
      ${overflowNote(result)}
      <div class="tp-sheet__actions"><button class="btn btn-primary tp-sheet__done">Collect</button></div>
    </div>`;
  const close = () => {
    document.removeEventListener('keydown', onKey);
    shade.remove();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  shade.addEventListener('click', (e) => {
    if (e.target === shade || e.target.closest('.tp-sheet__close, .tp-sheet__done')) close();
  });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(shade);
}

export class CrateCard {
  constructor(shop) {
    this._shop = shop;
    this._off = null;
    this._ready = null;
    this.el = document.createElement('section');
    this.el.className = 'tp-crate';
    this.el.innerHTML = `
      <div class="tp-crate__icon">📦</div>
      <div class="tp-crate__body">
        <div class="tp-crate__name">Supply drop</div>
        <div class="tp-crate__timer"></div>
      </div>
      <button class="btn btn-success tp-crate__claim">Claim</button>`;
    this._timer = this.el.querySelector('.tp-crate__timer');
    this._claim = this.el.querySelector('.tp-crate__claim');
    this._claim.addEventListener('click', () => this._onClaim());
  }

  hasDot() {
    return this._shop.crateStatus().ready;
  }

  patch() {
    const { ready, msUntilReset } = this._shop.crateStatus();
    const text = ready ? 'Ready to claim' : `Resets in ${formatCountdown(msUntilReset)}`;
    if (this._timer.textContent !== text) this._timer.textContent = text;
    if (ready === this._ready) return;
    this._ready = ready;
    this._claim.disabled = !ready;
    this._claim.textContent = ready ? 'Claim' : 'Claimed';
    this.el.classList.toggle('tp-crate--ready', ready);
    eventBus.emit('tradingpost:refreshDots');
  }

  start() {
    this.stop();
    this._ready = null;
    this.patch();
    this._off = eventBus.on('tick:ui', () => this.patch());
  }

  stop() {
    this._off?.();
    this._off = null;
  }

  _onClaim() {
    const outcome = this._shop.claimCrate();
    if (!outcome.success) return;
    this.patch();
    openReveal(outcome.result);
  }
}
