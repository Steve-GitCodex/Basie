import { eventBus } from '../../core/EventBus.js';
import { SHOP_CONFIG, DIAMOND_PACKAGES, VIP_TIERS } from '../../entities/GAME_DATA.js';
import { entryCard } from './entryCard.js';
import { patchCard } from './tradeCards.js';
import { openCheckout } from './CheckoutSheet.js';
import { escapeHtml } from '../uiUtils.js';
import { BUY_FAILURE_TEXT } from './buyFailureText.js';

export class PremiumTab {
  /** @param {{ shop, user, notifications }} systems */
  constructor(systems) {
    this._s = systems;
  }

  mount(el) {
    el.innerHTML = `
      <div class="tp-testmode">⚠ Test mode: purchases are simulated. No payment is taken.</div>
      <div class="tp-vip"></div>
      <h4 class="tp-supply__label">Diamonds</h4>
      <div class="tp-packs"></div>
      <h4 class="tp-supply__label">Permanent unlocks &amp; diamond spends</h4>
      <div class="tp-unlocks tp-row"></div>`;
    this._vip = el.querySelector('.tp-vip');
    this._packs = el.querySelector('.tp-packs');
    this._unlocks = el.querySelector('.tp-unlocks');
    el.addEventListener('click', (e) => this._onClick(e));
    eventBus.on('user:vipUpdate', () => this._patchVip());
    eventBus.on('user:statsUpdated', () => this._patchVip());
  }

  render() {
    this._renderPacks();
    this._renderUnlocks();
    this._patchVip();
  }

  patch() {
    this._unlocks.querySelectorAll('.tp-card').forEach(card =>
      patchCard(card, this._s.shop.entryState(card.dataset.entryId)));
  }

  _spent() {
    return this._s.user.getProfile().stats.diamondsSpent;
  }

  _patchVip() {
    const tier = this._s.user.getVipTier();
    const current = VIP_TIERS.find(t => t.tier === tier);
    const next = VIP_TIERS.find(t => t.tier > tier);
    const spent = this._spent();
    const pct = next ? Math.min(100, (spent / next.threshold) * 100) : 100;
    const html = `
      <span class="tp-vip__badge">${current ? `${current.badge} ${current.label}` : 'No VIP yet'}</span>
      <div>
        <div class="tp-vip__bar"><i style="width:${pct.toFixed(1)}%"></i></div>
        <small class="tp-vip__text">${next
          ? `${spent.toLocaleString()} / ${next.threshold.toLocaleString()} 💎 spent to <b>${next.label}</b> · ${escapeHtml(next.description)}`
          : `${spent.toLocaleString()} 💎 spent · max tier`}</small>
      </div>`;
    if (this._vip.dataset.html === html) return;
    this._vip.dataset.html = html;
    this._vip.innerHTML = html;
  }

  _renderPacks() {
    this._packs.innerHTML = SHOP_CONFIG.premium.packs.map(p => {
      const pkg = DIAMOND_PACKAGES.find(d => d.id === p.diamondPackageId);
      return `
        <div class="tp-pack${p.badge ? ' tp-pack--featured' : ''}" data-pack-id="${p.diamondPackageId}">
          ${p.badge ? `<span class="tp-pack__ribbon">${escapeHtml(p.badge)}</span>` : ''}
          <div class="tp-pack__gem">${p.icon}</div>
          <div class="tp-pack__amt">${pkg.diamonds.toLocaleString()}</div>
          <small>${escapeHtml(p.label)}</small>
          <button class="btn btn-primary tp-pack__buy">${escapeHtml(p.displayPrice)}</button>
        </div>`;
    }).join('');
  }

  _renderUnlocks() {
    const cards = SHOP_CONFIG.premium.unlocks.map(u => entryCard(this._s.shop, u.entryId)).filter(Boolean);
    this._unlocks.replaceChildren(...cards);
  }

  _onClick(e) {
    const pack = e.target.closest('.tp-pack__buy');
    if (pack) return this._checkout(pack.closest('.tp-pack').dataset.packId);
    const buy = e.target.closest('.tp-card__buy');
    if (buy && !buy.disabled) this._buyUnlock(buy.dataset.entryId);
  }

  _checkout(packId) {
    const pkg = DIAMOND_PACKAGES.find(d => d.id === packId);
    const entry = SHOP_CONFIG.premium.packs.find(p => p.diamondPackageId === packId);
    openCheckout(
      { label: entry.label, displayPrice: entry.displayPrice, diamonds: pkg.diamonds },
      { onConfirm: () => this._s.shop.buyPack(packId), vipLine: `${this._spent().toLocaleString()} 💎 spent (packs do not change it)` },
    );
  }

  _buyUnlock(entryId) {
    const result = this._s.shop.buy(entryId);
    if (!result.success) {
      eventBus.emit('ui:error');
      this._s.notifications?.show('warning', 'Cannot Buy', BUY_FAILURE_TEXT[result.reason] ?? result.reason);
      return;
    }
    const name = this._unlocks.querySelector(`[data-entry-id="${entryId}"] .tp-card__name`)?.textContent ?? 'Item';
    this._s.notifications?.show('success', 'Purchased', name);
    this.render();
  }
}
