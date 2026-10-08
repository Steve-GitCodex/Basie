import { formatRemaining } from '../buffs/buffText.js';

export const INVENTORY_HEADER_HTML = `
  <div class="inv-modal__header">
    <span class="inv-modal__title">🎒 Inventory</span>
    <button class="inv-modal__boosts hidden" type="button"></button>
    <button class="modal-close" type="button" aria-label="Close">✕</button>
  </div>`;

export class InventoryHeader {
  constructor(rootEl, buffs, onBoosts) {
    this._buffs = buffs;
    this._chip = rootEl.querySelector('.inv-modal__boosts');
    this._chip.addEventListener('click', onBoosts);
    this.patch();
  }

  patch() {
    const boosts = this._buffs?.getBoosts?.() ?? [];
    this._chip.classList.toggle('hidden', boosts.length === 0);
    if (!boosts.length) return;
    const shortest = Math.min(...boosts.map(b => b.remainingMs));
    const noun = boosts.length === 1 ? 'boost' : 'boosts';
    this._chip.textContent = `⚗ ${boosts.length} ${noun} · ${formatRemaining(shortest)}`;
  }
}
