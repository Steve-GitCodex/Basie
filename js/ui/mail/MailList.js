import { inCategory } from '../../systems/mail/mailCategories.js';
import { CATEGORY_META } from './mailCategoryMeta.js';
import { expandedHtml, patchExpanded } from './mailExpand.js';
import { createRow, patchRow } from './mailRow.js';

export class MailList {
  constructor(el, emptyEl, handlers) {
    this._el = el;
    this._emptyEl = emptyEl;
    this._handlers = handlers;
    this._rows = new Map();
    this._byId = new Map();
    this._cat = null;
    this.openId = null;
    el.addEventListener('click', e => this._onClick(e));
  }

  get category() { return this._cat; }

  rowEl(id) { return this._rows.get(id) ?? null; }

  visibleIds() { return [...this._rows.keys()]; }

  show(cat, messages) {
    this._cat = cat;
    this.openId = null;
    this._rows.clear();
    this._byId.clear();
    this._el.replaceChildren();
    this._el.scrollTop = 0;
    this._emptyEl.textContent = CATEGORY_META[cat].empty;
    this.patch(messages);
  }

  patch(messages) {
    if (!this._cat) return;
    const visible = messages.filter(m => inCategory(m, this._cat));
    const ids = new Set(visible.map(m => m.id));
    for (const [id, el] of this._rows) {
      if (ids.has(id)) continue;
      el.remove();
      this._rows.delete(id);
      this._byId.delete(id);
      if (this.openId === id) this.openId = null;
    }
    let prev = null;
    for (const msg of visible) {
      this._byId.set(msg.id, msg);
      let el = this._rows.get(msg.id);
      if (!el) {
        el = createRow(msg);
        this._rows.set(msg.id, el);
      } else {
        patchRow(el, msg);
      }
      const slot = prev ? prev.nextElementSibling : this._el.firstElementChild;
      if (el !== slot) this._el.insertBefore(el, slot);
      if (msg.id === this.openId) patchExpanded(el.querySelector('.mail-row__body'), msg);
      prev = el;
    }
    this._emptyEl.classList.toggle('hidden', visible.length > 0);
  }

  /** @returns {boolean} true when the row is now open */
  toggle(id) {
    const wasOpen = this.openId;
    if (wasOpen != null) this._setOpen(wasOpen, false);
    this.openId = null;
    if (wasOpen === id || !this._rows.has(id)) return false;
    this.openId = id;
    this._setOpen(id, true);
    return true;
  }

  _setOpen(id, open) {
    const el = this._rows.get(id);
    if (!el) return;
    el.classList.toggle('mail-row--open', open);
    el.querySelector('.mail-row__head').setAttribute('aria-expanded', String(open));
    if (open) el.insertAdjacentHTML('beforeend', expandedHtml(this._byId.get(id)));
    else el.querySelector('.mail-row__body')?.remove();
  }

  _onClick(e) {
    const row = e.target.closest('.mail-row');
    if (!row) return;
    const id = Number(row.dataset.id);
    const act = e.target.closest('[data-act]');
    if (act) this._handlers.onAction(act.dataset.act, id);
    else if (e.target.closest('[data-row-claim]')) this._handlers.onClaim(id);
    else if (e.target.closest('[data-row-star]')) this._handlers.onStar(id);
    else if (e.target.closest('.mail-row__head')) this._handlers.onHead(id);
  }
}
