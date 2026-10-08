import { MAIL_CATEGORIES } from '../../systems/mail/mailCategories.js';
import { CATEGORY_META, categoryIcon } from './mailCategoryMeta.js';

function tileHtml(cat) {
  return `
    <div class="mail-tile" data-cat="${cat}">
      <button type="button" class="mail-tile__main" aria-pressed="false">
        <span class="mail-tile__icon">${categoryIcon(cat)}<span class="mail-tile__badge hidden"></span></span>
        <span class="mail-tile__text">
          <span class="mail-tile__name">${CATEGORY_META[cat].label}</span>
          <span class="mail-tile__meta"></span>
        </span>
      </button>
      <button type="button" class="mail-tile__claim hidden" data-tile-claim></button>
    </div>`;
}

export class MailHub {
  /** @param {HTMLElement} el @param {{ onSelect(cat: string): void, onClaim(cat: string): void }} handlers */
  constructor(el, { onSelect, onClaim }) {
    el.innerHTML = MAIL_CATEGORIES.map(tileHtml).join('');
    this._tiles = new Map([...el.querySelectorAll('.mail-tile')].map(t => [t.dataset.cat, {
      root:  t,
      main:  t.querySelector('.mail-tile__main'),
      meta:  t.querySelector('.mail-tile__meta'),
      badge: t.querySelector('.mail-tile__badge'),
      claim: t.querySelector('[data-tile-claim]'),
    }]));
    el.addEventListener('click', e => {
      const tile = e.target.closest('.mail-tile');
      if (!tile) return;
      if (e.target.closest('[data-tile-claim]')) onClaim(tile.dataset.cat);
      else onSelect(tile.dataset.cat);
    });
  }

  patch(counts, activeCat) {
    for (const [cat, t] of this._tiles) {
      const { total, unread, claimable } = counts[cat];
      const on = cat === activeCat;
      t.root.classList.toggle('mail-tile--on', on);
      t.main.setAttribute('aria-pressed', String(on));
      t.meta.textContent = cat === 'trash' ? `${total} mail` : `${total} mail · ${unread} unread`;
      t.badge.textContent = String(unread);
      t.badge.classList.toggle('hidden', unread === 0);
      t.claim.textContent = `Claim ${claimable}`;
      t.claim.classList.toggle('hidden', claimable === 0);
    }
  }
}
