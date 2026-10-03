import { escapeHtml } from '../uiUtils.js';

const STATUS_LABEL = { purchased: 'Owned', active: 'Active', sold: 'Sold' };
const BUY_VARIANT = { money: 'btn-gold', resources: 'btn-gold', diamond: 'btn-primary' };

/**
 * @param {{ entryId: string, itemId: string, name: string, icon: string, rarity?: string,
 *           reason?: string|null, owned: number, priceLabel: string,
 *           currency: 'money'|'diamond'|'resources', canAfford: boolean,
 *           status?: 'available'|'purchased'|'active'|'sold', needLabel?: string|null }} opts
 * @returns {HTMLElement}
 */
export function itemCard({ entryId, itemId, name, icon, rarity = 'common', reason = null, owned, priceLabel, currency, canAfford, status = 'available', needLabel = null }) {
  const el = document.createElement('div');
  el.className = `tp-card tp-card--${rarity}`;
  el.dataset.entryId = entryId;
  el.dataset.itemId = itemId;
  el.dataset.priceLabel = priceLabel;
  el.dataset.currency = currency;
  el.innerHTML = `
    <span class="tp-card__owned"></span>
    <div class="tp-card__icon">${icon}</div>
    <b class="tp-card__name">${escapeHtml(name)}</b>
    ${reason ? `<small class="tp-card__why">${escapeHtml(reason)}</small>` : ''}
    <div class="tp-card__actions">
      <button class="btn btn-xs btn-success tp-card__use" data-item-id="${itemId}">Use</button>
      <button class="btn btn-xs tp-card__buy tp-card__buy--${currency}" data-entry-id="${entryId}"></button>
    </div>`;
  patchCard(el, { owned, canAfford, status, needLabel });
  return el;
}

export function patchCard(el, { owned, canAfford, status = 'available', needLabel = null }) {
  const ownedEl = el.querySelector('.tp-card__owned');
  const useBtn = el.querySelector('.tp-card__use');
  const buyBtn = el.querySelector('.tp-card__buy');
  const ownedText = `×${owned}`;
  if (ownedEl.textContent !== ownedText) ownedEl.textContent = ownedText;
  ownedEl.classList.toggle('tp-card__owned--none', owned <= 0);
  useBtn.classList.toggle('hidden', owned <= 0);
  const buyable = status === 'available' && canAfford;
  const unaffordable = status === 'available' && !canAfford && needLabel;
  const label = STATUS_LABEL[status] ?? (unaffordable ? needLabel : el.dataset.priceLabel);
  if (buyBtn.textContent !== label) buyBtn.textContent = label;
  buyBtn.disabled = !buyable;
  buyBtn.classList.toggle('tp-card__buy--off', status === 'available' && !canAfford);
  const variant = BUY_VARIANT[el.dataset.currency] ?? 'btn-gold';
  buyBtn.classList.toggle(variant, buyable);
  buyBtn.classList.toggle('btn-ghost', !buyable);
}
