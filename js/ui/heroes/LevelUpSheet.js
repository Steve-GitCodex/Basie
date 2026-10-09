import { eventBus } from '../../core/EventBus.js';
import { project, xpNeeded, autoPick, xpToNext } from '../../systems/hero/heroXpPlan.js';
import { TIER_META } from './heroCardView.js';
import { xpItemsFor, rowsHtml } from './levelUpRows.js';
import { escapeHtml } from '../uiUtils.js';

const fmt = n => Math.round(n).toLocaleString();

export class LevelUpSheet {
  constructor(host, systems) {
    this._host = host;
    this._s = systems;
    this._heroId = null;
    this._items = [];
    this._qty = {};
    this._applying = false;
    this._el = null;
    this._ref = null;
    this._tierLabel = '';
    this._opener = null;
    this._onKey = e => { if (e.key === 'Escape') this.close(); };
    eventBus.on('inventory:updated', () => this._sync());
    eventBus.on('heroes:updated', () => this._sync());
    eventBus.on('ui:viewChanged', view => { if (view !== 'heroes') this.close(); });
    eventBus.on('ui:navigateTo', () => this.close());
    eventBus.on('building:completed', () => this._sync());
  }

  get isOpen() { return !!this._el && !this._el.classList.contains('hidden'); }

  open(heroId) {
    const hero = this._hero(heroId);
    if (!hero?.isOwned) return;
    this._heroId = heroId;
    this._qty = {};
    this._items = xpItemsFor(heroId).filter(i => this._owned(i.id) > 0);
    this._opener = document.activeElement;
    this._mount(hero);
    this._el.classList.remove('hidden');
    document.addEventListener('keydown', this._onKey);
    this._refresh();
    this._ref.use.disabled ? this._ref.close.focus() : this._ref.use.focus();
  }

  close() {
    if (!this._el || this._el.classList.contains('hidden')) return;
    this._el.classList.add('hidden');
    document.removeEventListener('keydown', this._onKey);
    if (this._opener?.isConnected) this._opener.focus();
    this._opener = null;
  }

  _mount(hero) {
    if (!this._el) {
      this._el = document.createElement('div');
      this._el.className = 'hero-levelup hidden';
      this._el.addEventListener('click', e => this._onClick(e));
      this._host.appendChild(this._el);
    }
    this._tierLabel = TIER_META[hero.tier]?.label ?? '';
    this._el.innerHTML = `
      <div class="hero-levelup__shade" data-act="close"></div>
      <div class="hero-levelup__panel" role="dialog" aria-modal="true" aria-label="Level up ${escapeHtml(hero.name)}">
        <div class="hero-levelup__head">
          <span class="hero-levelup__title"><b>Level up · ${escapeHtml(hero.name)}</b><small data-cap></small></span>
          <button type="button" class="hero-levelup__close" data-act="close" aria-label="Close">×</button>
        </div>
        <div class="hero-levelup__preview">
          <div class="hero-levelup__big" data-big></div>
          <div class="hero-levelup__bar"><i data-bar-now></i><u data-bar-gain></u></div>
          <div class="hero-levelup__note" data-note></div>
        </div>
        <div class="hero-levelup__quick">
          <button type="button" class="hero-levelup__quickbtn" data-act="next">Next level</button>
          <button type="button" class="hero-levelup__quickbtn" data-act="fill">Fill to cap</button>
          <button type="button" class="hero-levelup__quickbtn" data-act="clear">Clear</button>
        </div>
        <div class="hero-levelup__empty hidden" data-empty>No XP items. Get Tomes in the Trading Post.</div>
        <div class="hero-levelup__items">${rowsHtml(this._items, id => this._owned(id))}</div>
        <div class="hero-levelup__foot">
          <button type="button" class="btn btn-primary hero-levelup__use" data-act="use"></button>
        </div>
      </div>`;
    this._ref = this._cacheRefs();
  }

  _cacheRefs() {
    const q = sel => this._el.querySelector(sel);
    const rows = new Map([...this._el.querySelectorAll('.hero-levelup__row')].map(row => [row.dataset.itemId, {
      owned: row.querySelector('[data-owned]'),
      qty: row.querySelector('[data-qty]'),
      dec: row.querySelector('[data-act="dec"]'),
      inc: row.querySelector('[data-act="inc"]'),
    }]));
    return {
      cap: q('[data-cap]'),
      close: q('.hero-levelup__close'),
      empty: q('[data-empty]'),
      big: q('[data-big]'),
      barNow: q('[data-bar-now]'),
      barGain: q('[data-bar-gain]'),
      note: q('[data-note]'),
      use: q('.hero-levelup__foot [data-act="use"]'),
      next: q('.hero-levelup__quick [data-act="next"]'),
      fill: q('.hero-levelup__quick [data-act="fill"]'),
      rows,
    };
  }

  _hero(id = this._heroId) { return this._s.heroes.getRosterWithState().find(h => h.id === id) ?? null; }

  _owned(id) { return this._s.inventory?.getQuantity(id) ?? 0; }

  _state(hero) { return { level: hero.level, xp: hero.xp ?? 0, tier: hero.tier }; }

  _total() { return this._items.reduce((sum, i) => sum + (this._qty[i.id] ?? 0) * i.xp, 0); }

  _onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const act = el.dataset.act;
    if (act === 'close') { this.close(); return; }
    const hero = this._hero();
    if (!hero) return;
    const cap = this._s.heroes.levelCap();
    const id = el.closest('.hero-levelup__row')?.dataset.itemId;
    const handlers = {
      inc: () => { this._qty[id] = Math.min(this._owned(id), (this._qty[id] ?? 0) + 1); },
      dec: () => { this._qty[id] = Math.max(0, (this._qty[id] ?? 0) - 1); },
      next: () => { this._qty = this._pick(hero, Math.min(cap, hero.level + 1)); },
      fill: () => { this._qty = this._pick(hero, cap); },
      clear: () => { this._qty = {}; },
      use: () => this._apply(hero),
    };
    eventBus.emit('ui:click');
    handlers[act]?.();
    if (this.isOpen) this._refresh();
  }

  _pick(hero, target) {
    const items = this._items.map(i => ({ ...i, owned: this._owned(i.id) }));
    return autoPick(items, xpNeeded(this._state(hero), target));
  }

  _apply(hero) {
    const from = hero.level;
    const gained = this._total();
    this._applying = true;
    let failure = null;
    const cap = this._s.heroes.levelCap();
    for (const item of this._items) {
      const qty = this._qty[item.id] ?? 0;
      if (qty <= 0) continue;
      if ((this._hero()?.level ?? 0) >= cap) break;
      const result = this._s.inventory.useItem(item.id, { qty, heroId: hero.id });
      if (!result?.success) { failure = result?.reason ?? 'Something went wrong.'; break; }
    }
    this._applying = false;
    if (failure) {
      eventBus.emit('ui:error');
      this._s.notifications?.show('warning', 'Cannot Level Up', failure);
      this._sync();
      return;
    }
    const to = this._hero()?.level ?? from;
    if (to <= from) this._s.notifications?.show('success', 'XP Applied', `+${fmt(gained)} XP`);
    this.close();
  }

  _sync() {
    if (!this.isOpen || this._applying) return;
    if (!this._hero()?.isOwned) { this.close(); return; }
    this._refresh();
  }

  _refresh() {
    const hero = this._hero();
    if (!hero) return;
    const cap = this._s.heroes.levelCap();
    const r = this._ref;
    this._patchRows();
    const add = this._total();
    const p = project({ ...this._state(hero), cap }, add);
    const hq = this._s.bm?.getLevelOf?.('heroquarters');
    r.cap.textContent = `${this._tierLabel} · cap Lv ${cap}${hq ? ` (Hero Quarters ${hq})` : ''}`;
    r.big.innerHTML = `Lv ${hero.level}${p.level > hero.level ? ` → <em>${p.level}</em>` : ''} <small>+${fmt(add)} XP</small>`;
    this._paintBar(hero, p, add, cap);
    const wasted = p.wasted > 0;
    r.note.classList.toggle('hero-levelup__waste', wasted);
    r.note.textContent = this._noteText(hero, p, cap);
    r.use.disabled = add <= 0;
    r.use.textContent = `Use · Lv ${hero.level}${p.level > hero.level ? ` → ${p.level}` : ''}`;
    const hasPlain = this._items.some(i => !i.fragment);
    r.empty.classList.toggle('hidden', hasPlain);
    r.next.disabled = r.fill.disabled = hero.level >= cap || !hasPlain;
  }

  _patchRows() {
    for (const item of this._items) {
      const owned = this._owned(item.id);
      const qty = Math.min(this._qty[item.id] ?? 0, owned);
      this._qty[item.id] = qty;
      const row = this._ref.rows.get(item.id);
      row.owned.textContent = owned;
      row.qty.textContent = qty;
      row.dec.disabled = qty <= 0;
      row.inc.disabled = qty >= owned;
    }
  }

  _paintBar(hero, p, add, cap) {
    const need = xpToNext(hero.level, hero.tier) || 1;
    const nowPct = Math.min(100, ((hero.xp ?? 0) / need) * 100);
    const levelled = p.level > hero.level;
    const startPct = levelled ? 0 : nowPct;
    let endPct = Math.min(100, (((hero.xp ?? 0) + add) / need) * 100);
    if (levelled) endPct = p.level >= cap ? 100 : (p.xp / xpToNext(p.level, hero.tier)) * 100;
    this._ref.barNow.style.width = `${startPct}%`;
    if (!levelled && p.wasted > 0) endPct = 100;
    this._ref.barGain.style.left = `${startPct}%`;
    this._ref.barGain.style.width = `${Math.max(0, endPct - startPct)}%`;
  }

  _noteText(hero, p, cap) {
    if (p.wasted > 0) return `${fmt(p.wasted)} XP would be wasted at the cap`;
    if (p.level >= cap) return 'Reaches the cap exactly';
    return `${fmt(p.xp)} / ${fmt(xpToNext(p.level, hero.tier))} XP into Lv ${p.level}`;
  }
}
