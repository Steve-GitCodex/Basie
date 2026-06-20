/**
 * BuildablesPanel.js
 * The "Buildables Inventory" — a catalog of everything you can place, opened from
 * the More grid (full catalog) or an empty-plot tap (scoped to that plot's zone).
 * Browse → search / group / sort → tap a card to place.
 *
 * Read-only presenter: reads `bm.getBuildablesCatalog()` and emits intents.
 *   • full catalog  → `ui:placeBuilding { buildingId }`        (enters placement mode)
 *   • plot-scoped   → `ui:placeBuilding { buildingId, plotId }` (builds on that plot)
 */
import { eventBus }          from '../../core/EventBus.js';
import { RES_META, fmt }     from '../uiUtils.js';
import { icon, iconFromEmoji } from '../icons.js';

const ZONE_GROUPS = [
  { id: 'production',  label: `${icon('production')} Production`  },
  { id: 'civic',       label: `${icon('column')} Civic`           },
  { id: 'residential', label: `${icon('house')} Residential`      },
  { id: 'military',    label: `${icon('sword')} Military`         },
];
const FUNCTION_GROUPS = [
  { id: 'core',       label: `${icon('column')} Core`             },
  { id: 'production', label: `${icon('production')} Production`   },
  { id: 'population', label: `${icon('house')} Population`        },
  { id: 'military',   label: `${icon('sword')} Military`          },
];

export class BuildablesPanel {
  /** @param {{ bm, rm }} deps */
  constructor({ bm, rm }) {
    this._bm = bm;
    this._rm = rm;
    this._grouping = 'zone';     // 'zone' | 'function' | 'status'
    this._sort     = 'recommended';
    this._search   = '';
    this._zone     = null;       // plot-scoped zone filter, or null for full catalog
    this._plotId   = null;       // target plot when opened from an empty tile
    this._activeTab = 'all';     // currently shown group, or 'all'
  }

  init() {
    this._panel  = document.getElementById('buildables-panel');
    this._body   = document.getElementById('bp-body');
    this._search$  = document.getElementById('bp-search');
    this._groupBy$ = document.getElementById('bp-groupby');
    this._tabs$    = document.getElementById('bp-tabs');
    this._sort$    = document.getElementById('bp-sort');
    if (!this._panel) return;

    document.getElementById('bp-close')?.addEventListener('click', () => this.close());
    this._panel.addEventListener('click', e => { if (e.target === this._panel) this.close(); });

    this._search$?.addEventListener('input', e => { this._search = e.target.value.trim().toLowerCase(); this._render(); });
    this._groupBy$?.addEventListener('change', e => {
      this._grouping  = e.target.value;
      this._activeTab = 'all';
      this._render();
    });
    this._tabs$?.addEventListener('click', e => {
      const btn = e.target.closest('[data-tab]');
      if (!btn) return;
      this._activeTab = btn.dataset.tab;
      this._render();
    });
    this._sort$?.addEventListener('change', e => { this._sort = e.target.value; this._render(); });

    // Card actions are delegated on the persistent body so the handler survives any
    // body rebuild (and isn't duplicated by re-wiring on every render).
    this._body?.addEventListener('click', e => {
      const btn = e.target.closest('.bp-build');
      if (!btn) return;
      e.stopPropagation();
      eventBus.emit('ui:click');
      const buildingId = btn.dataset.build;
      const plotId = this._plotId;
      this.close();
      eventBus.emit('ui:placeBuilding', plotId ? { buildingId, plotId } : { buildingId });
    });

    eventBus.on('ui:openBuildables', (ctx = {}) => this.open(ctx));

    // Structural changes (new unlocks, a plot freed, built counts) → full re-render.
    const rerender = () => { if (this._isOpen()) this._render(); };
    eventBus.on('building:completed',    rerender);
    eventBus.on('building:queueUpdated', rerender);
    // Affordability changes (resources accruing / rate changes) → patch cost chips +
    // build buttons IN PLACE, never rebuilding the card DOM, so clicks are never eaten.
    this._affordThrottle = 0;
    eventBus.on('resources:ratesChanged', () => { if (this._isOpen()) this._patchAffordability(); });
    eventBus.on('resources:tick', () => {
      const now = Date.now();
      if (!this._isOpen() || now - this._affordThrottle < 500) return;
      this._affordThrottle = now;
      this._patchAffordability();
    });
  }

  _isOpen() { return this._panel && !this._panel.classList.contains('hidden'); }

  /** @param {{ zone?:string, plotId?:string }} ctx */
  open({ zone = null, plotId = null } = {}) {
    if (!this._panel) return;
    this._zone   = zone;
    this._plotId = plotId;
    this._search = '';
    this._activeTab = 'all';
    if (this._search$) this._search$.value = '';
    // A plot-scoped open forces the Zone grouping so the one zone reads clearly
    if (zone) this._grouping = 'zone';
    if (this._groupBy$) this._groupBy$.value = this._grouping;
    const title = document.getElementById('bp-title');
    if (title) title.textContent = zone ? `Build — ${this._zoneLabel(zone)}` : 'Buildables';
    this._panel.classList.remove('hidden');
    this._render();
  }

  close() { this._panel?.classList.add('hidden'); }

  // ── Render ──────────────────────────────────────────────────────────────────
  _render() {
    if (!this._body) return;
    let items = this._bm.getBuildablesCatalog();
    if (this._zone)   items = items.filter(i => i.zone === this._zone);
    if (this._search) items = items.filter(i => i.name.toLowerCase().includes(this._search));

    const groups   = this._group(items);
    const showDeco = !this._zone && (this._grouping === 'zone' || this._grouping === 'function');

    this._renderTabs(groups, showDeco);

    const decoCard = `<div class="bp-soon-card">Decorations are coming soon — you'll be able to place parks, statues and more here.</div>`;

    let html;
    if (this._activeTab === 'deco') {
      html = decoCard;
    } else if (this._activeTab === 'all') {
      html = groups.map(g => this._renderGroup(g.label, g.items)).join('');
      if (showDeco) html += `<div class="bp-group"><div class="bp-group__head">${icon('star-burst')} Decorations</div>${decoCard}</div>`;
    } else {
      const g = groups.find(x => x.id === this._activeTab);
      html = g ? `<div class="bp-cards">${g.items.map(i => this._card(i)).join('')}</div>` : '';
    }

    this._body.innerHTML = html || '<div class="bp-empty">Nothing matches your search.</div>';
  }

  /**
   * Tab strip: "All" + one tab per non-empty group (+ Decorations stub).
   * The buttons are built once and then only their counts / active state are
   * updated in place. Rebuilding `innerHTML` on every background refresh would
   * let a refresh that lands between mouse-down and mouse-up destroy the button
   * mid-click, so the browser dispatches the click to the container and the tab
   * never switches. Keeping the elements stable makes tab clicks bullet-proof.
   */
  _renderTabs(groups, showDeco) {
    if (!this._tabs$) return;
    const total = groups.reduce((s, g) => s + g.items.length, 0);
    // Drop a stale active tab (e.g. after a search empties its group)
    if (this._activeTab !== 'all' && this._activeTab !== 'deco' && !groups.some(g => g.id === this._activeTab)) {
      this._activeTab = 'all';
    }
    const tabs = [{ id: 'all', label: 'All', count: total }];
    groups.forEach(g => tabs.push({ id: g.id, label: g.label, count: g.items.length }));
    if (showDeco) tabs.push({ id: 'deco', label: `${icon('star-burst')} Decorations`, count: null });

    // One real group + All is redundant — collapse the strip.
    this._tabs$.style.display = (tabs.length <= 2) ? 'none' : '';

    // Only rebuild the DOM when the *set* of tabs changes (open / search / group).
    const sig = tabs.map(t => t.id).join('|');
    if (sig !== this._tabSig) {
      this._tabs$.innerHTML = tabs.map(t =>
        `<button class="bp-tab" data-tab="${t.id}" role="tab">
          <span>${t.label}</span>${t.count != null ? '<span class="bp-tab__count"></span>' : ''}
        </button>`).join('');
      this._tabSig = sig;
    }
    // Update counts + active state on the persistent buttons.
    tabs.forEach(t => {
      const btn = this._tabs$.querySelector(`[data-tab="${t.id}"]`);
      if (!btn) return;
      btn.classList.toggle('active', t.id === this._activeTab);
      const count$ = btn.querySelector('.bp-tab__count');
      if (count$ && t.count != null) count$.textContent = t.count;
    });
  }

  _group(items) {
    const sort = (arr) => arr.slice().sort(this._comparator());
    if (this._grouping === 'status') {
      const buckets = [
        { id: 'available', label: `${icon('check', 'icon--success')} Available`, items: sort(items.filter(i => i.unlocked && i.availableToBuild && !i.maxed)) },
        { id: 'locked',    label: `${icon('lock')} Locked`,                      items: sort(items.filter(i => !i.unlocked)) },
        { id: 'maxed',     label: `${icon('star-burst', 'icon--gold')} Maxed`,   items: sort(items.filter(i => i.unlocked && i.maxed)) },
      ];
      return buckets.filter(b => b.items.length);
    }
    const defs = this._grouping === 'function' ? FUNCTION_GROUPS : ZONE_GROUPS;
    const key  = this._grouping === 'function' ? 'category' : 'zone';
    return defs
      .map(d => ({ id: d.id, label: d.label, items: sort(items.filter(i => i[key] === d.id)) }))
      .filter(g => g.items.length);
  }

  _comparator() {
    switch (this._sort) {
      case 'cost-asc':  return (a, b) => this._costSum(a) - this._costSum(b);
      case 'cost-desc': return (a, b) => this._costSum(b) - this._costSum(a);
      case 'alpha':     return (a, b) => a.name.localeCompare(b.name);
      default: // recommended: buildable-now first, then cheapest
        return (a, b) => this._rank(a) - this._rank(b) || this._costSum(a) - this._costSum(b);
    }
  }

  _rank(i) {
    if (i.unlocked && i.availableToBuild && i.hasFreePlot && i.canAfford) return 0;
    if (i.unlocked && i.availableToBuild) return 1;
    if (i.maxed) return 3;
    if (!i.unlocked) return 4;
    return 2;
  }

  _costSum(i) { return Object.values(i.cost ?? {}).reduce((s, v) => s + v, 0); }

  _renderGroup(label, items) {
    return `<div class="bp-group">
      <div class="bp-group__head">${label}</div>
      <div class="bp-cards">${items.map(i => this._card(i)).join('')}</div>
    </div>`;
  }

  _card(i) {
    const snap = this._rm.getSnapshot();
    const costHtml = Object.entries(i.cost).map(([res, amt]) => {
      const has = (snap[res]?.amount ?? 0) >= amt;
      return `<span class="cost-chip ${has ? 'affordable' : 'unaffordable'}" data-res="${res}">${RES_META[res]?.icon ?? '?'} ${fmt(amt)}</span>`;
    }).join('');

    // Availability → tag + whether the build button is enabled
    const inPlotMode = !!this._plotId;
    let tag, enabled;
    if (!i.unlocked)              { tag = `${icon('lock')} ${i.lockReason ?? 'Locked'}`;       enabled = false; }
    else if (i.maxed)            { tag = `${icon('star-burst', 'icon--gold')} Max`;             enabled = false; }
    else if (!i.availableToBuild){ tag = `${i.builtCount}/${i.maxCount} · unlocks later`; enabled = false; }
    else if (!inPlotMode && !i.hasFreePlot) { tag = 'No free plot'; enabled = false; }
    else                         { tag = `${i.builtCount}/${i.maxCount} built`; enabled = i.canAfford; }

    const btn = enabled
      ? `<button class="btn btn-sm btn-primary bp-build" data-build="${i.id}">${inPlotMode ? 'Build Here' : 'Place'}</button>`
      : `<button class="btn btn-sm btn-ghost" disabled>${i.canAfford === false && i.unlocked && !i.maxed && i.availableToBuild ? 'Need resources' : '—'}</button>`;

    return `<div class="bp-card${enabled ? '' : ' bp-card--off'}" data-id="${i.id}">
      <div class="bp-card__icon">${iconFromEmoji(i.icon ?? '') || icon('hammer')}</div>
      <div class="bp-card__main">
        <div class="bp-card__name">${i.name}</div>
        ${i.effectLabel ? `<div class="bp-card__effect">${i.effectLabel}</div>` : ''}
        <div class="bp-card__costs">${costHtml}</div>
        <div class="bp-card__tag">${tag}</div>
      </div>
      <div class="bp-card__action">${btn}</div>
    </div>`;
  }

  /**
   * Reactive in-place affordability update: re-colour cost chips and flip the build
   * button between "Place/Build Here" and "Need resources" as the player's resources
   * change — WITHOUT rebuilding the card DOM (so tab/card clicks are never eaten).
   * Only resource-dependent state (`canAfford`) is touched; structural changes (unlocks,
   * free plots, built counts) come through the full re-render on building events.
   */
  _patchAffordability() {
    if (!this._body) return;
    const snap       = this._rm.getSnapshot();
    const inPlotMode = !!this._plotId;
    const byId = new Map(this._bm.getBuildablesCatalog().map(i => [i.id, i]));

    this._body.querySelectorAll('.bp-card[data-id]').forEach(card => {
      const i = byId.get(card.dataset.id);
      if (!i) return;

      card.querySelectorAll('.bp-card__costs .cost-chip').forEach(chip => {
        const amt = i.cost?.[chip.dataset.res];
        if (amt == null) return;
        const has = (snap[chip.dataset.res]?.amount ?? 0) >= amt;
        chip.classList.toggle('affordable', has);
        chip.classList.toggle('unaffordable', !has);
      });

      // Only the "buildable now except for resources" case flips with resources.
      const buildable = i.unlocked && !i.maxed && i.availableToBuild && (inPlotMode || i.hasFreePlot);
      if (!buildable) return;
      const wrap = card.querySelector('.bp-card__action');
      const cur  = wrap?.querySelector('button');
      const enabledNow = !!cur && !cur.disabled;
      if (!wrap || i.canAfford === enabledNow) return;   // no change → leave DOM alone
      wrap.innerHTML = i.canAfford
        ? `<button class="btn btn-sm btn-primary bp-build" data-build="${i.id}">${inPlotMode ? 'Build Here' : 'Place'}</button>`
        : `<button class="btn btn-sm btn-ghost" disabled>Need resources</button>`;
      card.classList.toggle('bp-card--off', !i.canAfford);
    });
  }

  _zoneLabel(zone) { return zone.charAt(0).toUpperCase() + zone.slice(1); }
}
