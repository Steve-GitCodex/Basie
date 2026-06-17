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
import { eventBus }      from '../../core/EventBus.js';
import { RES_META, fmt } from '../uiUtils.js';

const ZONE_GROUPS = [
  { id: 'production',  label: '⚒️ Production'  },
  { id: 'civic',       label: '🏛️ Civic'       },
  { id: 'residential', label: '🏠 Residential' },
  { id: 'military',    label: '⚔️ Military'    },
];
const FUNCTION_GROUPS = [
  { id: 'core',       label: '🏛️ Core'       },
  { id: 'production', label: '⚒️ Production' },
  { id: 'population', label: '👥 Population' },
  { id: 'military',   label: '⚔️ Military'   },
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
  }

  init() {
    this._panel  = document.getElementById('buildables-panel');
    this._body   = document.getElementById('bp-body');
    this._search$ = document.getElementById('bp-search');
    this._group$  = document.getElementById('bp-group');
    this._sort$   = document.getElementById('bp-sort');
    if (!this._panel) return;

    document.getElementById('bp-close')?.addEventListener('click', () => this.close());
    this._panel.addEventListener('click', e => { if (e.target === this._panel) this.close(); });

    this._search$?.addEventListener('input', e => { this._search = e.target.value.trim().toLowerCase(); this._render(); });
    this._group$?.addEventListener('click', e => {
      const btn = e.target.closest('[data-group]');
      if (!btn) return;
      this._grouping = btn.dataset.group;
      this._syncGroupTabs();
      this._render();
    });
    this._sort$?.addEventListener('change', e => { this._sort = e.target.value; this._render(); });

    eventBus.on('ui:openBuildables', (ctx = {}) => this.open(ctx));
    // Keep affordability/availability fresh while open
    const refresh = () => { if (this._isOpen()) this._render(); };
    eventBus.on('resources:ratesChanged', refresh);
    eventBus.on('building:completed', refresh);
    eventBus.on('building:queueUpdated', refresh);
  }

  _isOpen() { return this._panel && !this._panel.classList.contains('hidden'); }

  /** @param {{ zone?:string, plotId?:string }} ctx */
  open({ zone = null, plotId = null } = {}) {
    if (!this._panel) return;
    this._zone   = zone;
    this._plotId = plotId;
    this._search = '';
    if (this._search$) this._search$.value = '';
    // A plot-scoped open forces the Zone grouping so the one zone reads clearly
    if (zone) this._grouping = 'zone';
    this._syncGroupTabs();
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

    const groups = this._group(items);
    let html = groups.map(g => this._renderGroup(g.label, g.items)).join('');

    // Decorations stub (only in the full, unscoped catalog)
    if (!this._zone && (this._grouping === 'zone' || this._grouping === 'function')) {
      html += `<div class="bp-group">
        <div class="bp-group__head">🎨 Decorations</div>
        <div class="bp-soon-card">Decorations are coming soon — you'll be able to place parks, statues and more here.</div>
      </div>`;
    }

    this._body.innerHTML = html || '<div class="bp-empty">Nothing matches your search.</div>';
    this._wireCards();
  }

  _group(items) {
    const sort = (arr) => arr.slice().sort(this._comparator());
    if (this._grouping === 'status') {
      const buckets = [
        { label: '✅ Available', items: sort(items.filter(i => i.unlocked && i.availableToBuild && !i.maxed)) },
        { label: '🔒 Locked',    items: sort(items.filter(i => !i.unlocked)) },
        { label: '⭐ Maxed',     items: sort(items.filter(i => i.unlocked && i.maxed)) },
      ];
      return buckets.filter(b => b.items.length);
    }
    const defs = this._grouping === 'function' ? FUNCTION_GROUPS : ZONE_GROUPS;
    const key  = this._grouping === 'function' ? 'category' : 'zone';
    return defs
      .map(d => ({ label: d.label, items: sort(items.filter(i => i[key] === d.id)) }))
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
      return `<span class="cost-chip ${has ? 'affordable' : 'unaffordable'}">${RES_META[res]?.icon ?? '?'} ${fmt(amt)}</span>`;
    }).join('');

    // Availability → tag + whether the build button is enabled
    const inPlotMode = !!this._plotId;
    let tag, enabled;
    if (!i.unlocked)              { tag = `🔒 ${i.lockReason ?? 'Locked'}`;  enabled = false; }
    else if (i.maxed)            { tag = '⭐ Max';                          enabled = false; }
    else if (!i.availableToBuild){ tag = `${i.builtCount}/${i.maxCount} · unlocks later`; enabled = false; }
    else if (!inPlotMode && !i.hasFreePlot) { tag = 'No free plot'; enabled = false; }
    else                         { tag = `${i.builtCount}/${i.maxCount} built`; enabled = i.canAfford; }

    const btn = enabled
      ? `<button class="btn btn-sm btn-primary bp-build" data-build="${i.id}">${inPlotMode ? 'Build Here' : 'Place'}</button>`
      : `<button class="btn btn-sm btn-ghost" disabled>${i.canAfford === false && i.unlocked && !i.maxed && i.availableToBuild ? 'Need resources' : '—'}</button>`;

    return `<div class="bp-card${enabled ? '' : ' bp-card--off'}">
      <div class="bp-card__icon">${i.icon ?? '🏗️'}</div>
      <div class="bp-card__main">
        <div class="bp-card__name">${i.name}</div>
        ${i.effectLabel ? `<div class="bp-card__effect">${i.effectLabel}</div>` : ''}
        <div class="bp-card__costs">${costHtml}</div>
        <div class="bp-card__tag">${tag}</div>
      </div>
      <div class="bp-card__action">${btn}</div>
    </div>`;
  }

  _wireCards() {
    this._body.querySelectorAll('.bp-build').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        eventBus.emit('ui:click');
        const buildingId = btn.dataset.build;
        const plotId = this._plotId;
        this.close();
        eventBus.emit('ui:placeBuilding', plotId ? { buildingId, plotId } : { buildingId });
      });
    });
  }

  _syncGroupTabs() {
    this._group$?.querySelectorAll('[data-group]').forEach(b =>
      b.classList.toggle('active', b.dataset.group === this._grouping));
  }

  _zoneLabel(zone) { return zone.charAt(0).toUpperCase() + zone.slice(1); }
}
