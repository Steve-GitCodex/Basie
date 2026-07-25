/** Player inventory as a right-side slide-in panel (event: ui:openInventory). No purchasing here — buy from Shop first. */
import { eventBus }        from '../../core/EventBus.js';
import { HEROES_CONFIG,
         FRAGMENTS_PER_SHARD } from '../../entities/GAME_DATA.js';
import { icon } from '../icons.js';

const RARITY_META = {
  common:    { label: 'Common',    color: 'var(--clr-tier-common)'    },
  rare:      { label: 'Rare',      color: 'var(--clr-tier-rare)'      },
  legendary: { label: 'Legendary', color: 'var(--clr-tier-legendary)' },
};

// Item types grouped into the top tab bar (each tab shows a count badge).
const TABS = [
  { id: 'special',  label: `${icon('gift')} Special`,  types: ['hero_card', 'hero_card_universal', 'hero_fragment'] },
  { id: 'resource', label: `${icon('box')} Resource`, types: ['resource_bundle'] },
  { id: 'speedup',  label: `${icon('speedup')} Speedup`,  types: ['speed_boost'] },
  { id: 'boost',    label: `${icon('flask-potion')} Boost`,    types: ['buff', 'xp_bundle'] },
  { id: 'scroll',   label: `${icon('scroll')} Scroll`,   types: ['recruitment_scroll'] },
];

export class InventoryUI {
  /** @param {{ inventory, heroes, notifications }} systems */
  constructor(systems) {
    this._s = systems;
    this._renderDebounceTimer = null;
    // New-item tracking — populated on grantRewards(), cleared when panel opens/closes.
    this._newItemIds    = new Set(); // item-type reward IDs shown with gold highlight
    this._hasNewRewards = false;     // true if any reward arrived while panel was closed
    this._clearNewTimer = null;
    this._activeTab      = null;     // selected tab id (reset on close → re-evaluated on open)
    this._selectedItemId = null;     // tile whose detail popover is shown
  }

  // ─────────────────────────────────────────────
  // BADGE
  // ─────────────────────────────────────────────

  _updateInventoryBadge() {
    const badge = document.getElementById('inventory-badge');
    if (!badge) return;
    if (this._hasNewRewards) {
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  _clearNewItems() {
    clearTimeout(this._clearNewTimer);
    this._newItemIds.clear();
    this._hasNewRewards = false;
    this._updateInventoryBadge();
    if (this._isOpen()) this._render();
  }

  init() {
    eventBus.on('ui:openInventory',  () => this._open());
    eventBus.on('inventory:updated', (payload) => {
      // If this update came from grantRewards(), fire the floating reward animation
      // and track which items are new for badge + card highlight.
      if (payload?.rewards?.length) {
        eventBus.emit('ui:rewardAnimation', payload.rewards);
        this._hasNewRewards = true;
        for (const r of payload.rewards) {
          if (r.type === 'item') this._newItemIds.add(r.itemId);
        }
        this._updateInventoryBadge();
      }
      if (!this._isOpen()) return;
      // Debounce rapid updates (e.g. rapid shop purchases) so hero picker isn't destroyed mid-use
      clearTimeout(this._renderDebounceTimer);
      this._renderDebounceTimer = setTimeout(() => this._render(), 100);
    });
  }

  // ─────────────────────────────────────────────
  // OPEN / CLOSE
  // ─────────────────────────────────────────────

  _isOpen() {
    return document.getElementById('inventory-panel')?.classList.contains('open') ?? false;
  }

  _open() {
    const overlay = document.getElementById('inventory-panel-overlay');
    const panel   = document.getElementById('inventory-panel');
    if (!overlay || !panel) return;
    // Toggle: tapping the dock button again closes the panel.
    if (this._isOpen()) { this._close(); return; }
    overlay.classList.add('open');
    panel.classList.add('open');
    this._render();
    overlay.onclick = e => { if (e.target === overlay) this._close(); };
    // Dismiss the dot badge immediately; let card highlights linger for 3 s then fade.
    this._hasNewRewards = false;
    this._updateInventoryBadge();
    if (this._newItemIds.size > 0) {
      clearTimeout(this._clearNewTimer);
      this._clearNewTimer = setTimeout(() => this._clearNewItems(), 3000);
    }
  }

  _close() {
    document.getElementById('inventory-panel-overlay')?.classList.remove('open');
    document.getElementById('inventory-panel')?.classList.remove('open');
    // Clear highlights and badge on close.
    clearTimeout(this._clearNewTimer);
    this._newItemIds.clear();
    this._hasNewRewards = false;
    this._activeTab = null;
    this._selectedItemId = null;
    this._updateInventoryBadge();
  }

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────

  _render() {
    const panel = document.getElementById('inventory-panel');
    if (!panel) return;

    const allItems    = this._s.inventory.getItems();
    const ownedItems  = allItems.filter(i => i.quantity > 0);
    const ownedHeroIds = new Set(
      this._s.heroes?.getRosterWithState?.().filter(h => h.isOwned).map(h => h.id) ?? []
    );

    // Empty inventory — no tabs/grid.
    if (ownedItems.length === 0) {
      panel.innerHTML = `
        ${this._headerHtml()}
        <div class="inv-panel-body">
          <div class="inv-empty">
            <div class="inv-empty-icon">${icon('backpack')}</div>
            <div class="inv-empty-title">Your inventory is empty</div>
            <div class="inv-empty-sub">Buy items from the <strong>${icon('gift')} Shop</strong> tab.</div>
          </div>
        </div>`;
      this._bindListeners(panel);
      return;
    }

    // Per-tab item buckets + count badges.
    const tabs = TABS.map(t => {
      const items = ownedItems.filter(i => t.types.includes(i.type));
      return { ...t, items, count: items.reduce((s, i) => s + i.quantity, 0) };
    });
    const nonEmpty = tabs.filter(t => t.items.length > 0);

    // Choose the active tab: keep the current one if it still has items, else
    // prefer a tab holding a newly granted item, else the first non-empty tab.
    if (!this._activeTab || !nonEmpty.some(t => t.id === this._activeTab)) {
      const newTab = nonEmpty.find(t => t.items.some(i => this._newItemIds.has(i.id)));
      this._activeTab = (newTab ?? nonEmpty[0] ?? tabs[0]).id;
      this._selectedItemId = null;
    }
    const active = tabs.find(t => t.id === this._activeTab);

    const tabsHtml = tabs.map(t => `
      <button class="inv-tab${t.id === this._activeTab ? ' inv-tab--active' : ''}"
              data-tab="${t.id}" ${t.items.length ? '' : 'disabled'}>
        <span class="inv-tab__label">${t.label}</span>
        ${t.count ? `<span class="inv-tab__count">${t.count}</span>` : ''}
      </button>`).join('');

    const gridHtml = active.items.map(item => {
      const isNew = this._newItemIds.has(item.id);
      const sel   = this._selectedItemId === item.id;
      const rarity = RARITY_META[item.rarity] ? item.rarity : 'common';
      return `
        <button class="inv-tile inv-tile--${rarity}${isNew ? ' inv-tile--new' : ''}${sel ? ' inv-tile--selected' : ''}"
                data-item-id="${item.id}" title="${item.name}">
          <span class="inv-tile__icon">${item.icon}</span>
          <span class="inv-tile__qty">${item.quantity}</span>
        </button>`;
    }).join('');

    // Detail popover for the selected tile (reuses the existing action builder).
    const selItem = this._selectedItemId
      ? active.items.find(i => i.id === this._selectedItemId)
      : null;
    const detailHtml = selItem ? this._detailHtml(selItem, ownedHeroIds) : '';

    panel.innerHTML = `
      ${this._headerHtml()}
      <div class="inv-tabs">${tabsHtml}</div>
      <div class="inv-panel-body">
        <div class="inv-grid">${gridHtml}</div>
      </div>
      ${detailHtml}`;

    this._bindListeners(panel);
  }

  _headerHtml() {
    return `
      <div class="inv-panel-header">
        <span class="inv-panel-title">${icon('backpack')} Inventory</span>
        <button class="btn btn-sm btn-ghost" id="inv-panel-close">✕</button>
      </div>`;
  }

  _detailHtml(item, ownedHeroIds) {
    const rarityM = RARITY_META[item.rarity] ?? {};
    const meta = rarityM.label
      ? `<span style="color:${rarityM.color}">${rarityM.label}</span> · ×${item.quantity}`
      : `×${item.quantity}`;
    return `
      <div class="inv-detail">
        <div class="inv-detail__head">
          <span class="inv-detail__icon">${item.icon}</span>
          <div class="inv-detail__info">
            <div class="inv-detail__name">${item.name}</div>
            <div class="inv-detail__meta">${meta}</div>
          </div>
        </div>
        ${item.description ? `<div class="inv-detail__desc">${item.description}</div>` : ''}
        <div class="inv-card-action">${this._buildActionHtml(item, ownedHeroIds)}</div>
      </div>`;
  }

  _buildActionHtml(item, ownedHeroIds) {
    // ── Recruitment Scrolls ──────────────────────────────────────────────
    if (item.type === 'recruitment_scroll') {
      const can10  = item.quantity >= 10;
      const can100 = item.quantity >= 100;
      return `
        <div class="inv-scroll-actions">
          <button class="btn btn-xs btn-gold inv-use-scroll" data-item="${item.id}" data-tier="${item.tier}">${icon('scroll')} Roll 1×</button>
          <button class="btn btn-xs btn-secondary inv-bulk-scroll"
            data-tier="${item.tier}" data-count="10"
            ${can10 ? '' : 'disabled'}
            title="${can10 ? 'Roll 10 scrolls at once' : `Need ${10 - item.quantity} more scrolls`}">
            Roll 10× <span class="inv-scroll-cost">(10 scrolls)</span>
          </button>
          <button class="btn btn-xs btn-secondary inv-bulk-scroll"
            data-tier="${item.tier}" data-count="100"
            ${can100 ? '' : 'disabled'}
            title="${can100 ? 'Roll 100 scrolls at once' : `Need ${100 - item.quantity} more scrolls`}">
            Roll 100× <span class="inv-scroll-cost">(100 scrolls)</span>
          </button>
        </div>`;
    }

    // ── Specific Hero Cards ───────────────────────────────────────────────
    if (item.type === 'hero_card') {
      const alreadyOwned = item.targetHeroId && ownedHeroIds.has(item.targetHeroId);
      if (alreadyOwned) return `<button class="btn btn-xs btn-ghost" disabled>Owned</button>`;
      return `<button class="btn btn-xs btn-gold inv-use-card" data-item="${item.id}">Recruit</button>`;
    }

    // ── Universal Hero Cards — fix: check if ALL heroes of tier are owned ─
    if (item.type === 'hero_card_universal') {
      const tier          = item.targetTier;
      const heroesOfTier  = Object.values(HEROES_CONFIG).filter(h => h.tier === tier);
      const allOwned      = heroesOfTier.length > 0 && heroesOfTier.every(h => ownedHeroIds.has(h.id));
      if (allOwned) return `<button class="btn btn-xs btn-ghost" disabled title="All ${tier} heroes owned">All Owned</button>`;
      return `<button class="btn btn-xs btn-gold inv-use-card" data-item="${item.id}">Recruit</button>`;
    }

    // ── Hero Fragments ────────────────────────────────────────────────────
    if (item.type === 'hero_fragment') {
      const heroId     = item.targetHeroId;
      const needed     = FRAGMENTS_PER_SHARD[HEROES_CONFIG[heroId]?.tier ?? 'normal'] ?? 8;
      const canConvert = ownedHeroIds.has(heroId); // owned heroes can receive XP from fragments
      return `
        <div class="inv-frag-actions">
          ${canConvert
            ? `<button class="btn btn-xs btn-primary inv-convert-frag" data-item="${item.id}" data-hero="${heroId}">→ XP</button>`
            : ''}
          <span class="inv-frag-hint">${item.quantity}/${needed}</span>
        </div>`;
    }

    // ── XP Bundles ───────────────────────────────────────────────────────
    if (item.type === 'xp_bundle') {
      return `<button class="btn btn-xs btn-primary inv-use-xp" data-item="${item.id}">Apply</button>`;
    }

    // ── Resource Bundles ─────────────────────────────────────────────────
    if (item.type === 'resource_bundle') {
      return `<button class="btn btn-xs btn-success inv-use-res" data-item="${item.id}">Open</button>`;
    }

    // ── Buffs ─────────────────────────────────────────────────────────────
    if (item.type === 'buff') {
      return `<button class="btn btn-xs btn-primary inv-use-buff" data-item="${item.id}">Activate</button>`;
    }
    // ── Speed Boosts ─────────────────────────────────────────────────────────
    if (item.type === 'speed_boost') {
      return `<span class="inv-speed-hint">Use from queue ⏩</span>`;
    }
    return '';
  }

  // ─────────────────────────────────────────────
  // LISTENERS
  // ─────────────────────────────────────────────

  _bindListeners(panel) {
    panel.querySelector('#inv-panel-close')?.addEventListener('click', () => {
      eventBus.emit('ui:click');
      this._close();
    });

    // ── Tab switching ─────────────────────────────────────────────────────
    panel.querySelectorAll('.inv-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        eventBus.emit('ui:click');
        this._activeTab = tab.dataset.tab;
        this._selectedItemId = null;
        this._render();
      });
    });

    // ── Tile selection → show detail popover ──────────────────────────────
    panel.querySelectorAll('.inv-tile').forEach(tile => {
      tile.addEventListener('click', () => {
        eventBus.emit('ui:click');
        const id = tile.dataset.itemId;
        this._selectedItemId = this._selectedItemId === id ? null : id;
        this._render();
      });
    });

    // ── Recruitment Scrolls → open GachaUI ─────────────────────────────
    panel.querySelectorAll('.inv-use-scroll').forEach(btn => {
      btn.addEventListener('click', e => {
        eventBus.emit('ui:click');
        const tier = e.currentTarget.dataset.tier;
        this._close();
        eventBus.emit('ui:openGacha', { scrollTier: tier });
      });
    });

    // ── Bulk Recruitment Scrolls → open GachaUI with count ───────────────
    panel.querySelectorAll('.inv-bulk-scroll').forEach(btn => {
      btn.addEventListener('click', e => {
        eventBus.emit('ui:click');
        const tier  = e.currentTarget.dataset.tier;
        const count = parseInt(e.currentTarget.dataset.count, 10);
        this._close();
        eventBus.emit('ui:openGacha', { scrollTier: tier, count });
      });
    });

    // ── Hero cards → recruit ──────────────────────────────────────────────
    panel.querySelectorAll('.inv-use-card').forEach(btn => {
      btn.addEventListener('click', e => {
        eventBus.emit('ui:click');
        const itemId = e.currentTarget.dataset.item;
        const r = this._s.inventory.useItem(itemId);
        if (!r.success) {
          eventBus.emit('ui:error');
          this._s.notifications?.show('warning', 'Cannot Recruit', r.reason);
        } else {
          const roster = this._s.heroes?.getRosterWithState?.() ?? [];
          const hero   = roster.find(h => h.id === r.heroId);
          this._s.notifications?.show('success', '👑 Hero Recruited!', `${hero?.name ?? r.heroId} has joined your roster!`);
        }
      });
    });

    // ── Hero Fragments → convert to XP ───────────────────────────────────
    panel.querySelectorAll('.inv-convert-frag').forEach(btn => {
      btn.addEventListener('click', e => {
        eventBus.emit('ui:click');
        const itemId = e.currentTarget.dataset.item;
        const heroId = e.currentTarget.dataset.hero;
        const r = this._s.inventory.useItem(itemId, { heroId });
        if (!r.success) {
          eventBus.emit('ui:error');
          this._s.notifications?.show('warning', 'Cannot Convert', r.reason);
        } else {
          this._s.notifications?.show('success', '🔮 Fragment Converted!', `+${r.xpAmount ?? 50} XP granted.`);
        }
      });
    });

    // ── XP Bundles → hero picker ──────────────────────────────────────────
    panel.querySelectorAll('.inv-use-xp').forEach(btn => {
      btn.addEventListener('click', e => {
        eventBus.emit('ui:click');
        const itemId = e.currentTarget.dataset.item;
        const card   = e.currentTarget.closest('.inv-detail');
        this._showHeroPicker(itemId, card);
      });
    });

    // ── Resource Bundles → open ───────────────────────────────────────────
    panel.querySelectorAll('.inv-use-res').forEach(btn => {
      btn.addEventListener('click', e => {
        eventBus.emit('ui:click');
        const itemId = e.currentTarget.dataset.item;
        const r = this._s.inventory.useItem(itemId);
        if (!r.success) {
          eventBus.emit('ui:error');
          this._s.notifications?.show('warning', 'Cannot Open', r.reason);
        } else {
          const grants = Object.entries(r.grants ?? {})
            .map(([k, v]) => `+${v.toLocaleString()} ${k}`).join(', ');
          this._s.notifications?.show('success', '📦 Bundle Opened!', grants);
        }
      });
    });

    // ── Buffs → activate ─────────────────────────────────────────────────
    panel.querySelectorAll('.inv-use-buff').forEach(btn => {
      btn.addEventListener('click', e => {
        eventBus.emit('ui:click');
        const itemId = e.currentTarget.dataset.item;
        const r = this._s.inventory.useItem(itemId);
        if (!r.success) {
          eventBus.emit('ui:error');
          this._s.notifications?.show('warning', 'Cannot Activate', r.reason);
        } else {
          const mins = Math.round((r.durationMs ?? 0) / 60000);
          this._s.notifications?.show('success', '⚗️ Buff Activated!', `+${((r.value ?? 0) * 100).toFixed(0)}% production for ${mins} min.`);
        }
      });
    });
  }

  // ─────────────────────────────────────────────
  // HERO PICKER (inline, for XP bundles)
  // ─────────────────────────────────────────────

  _showHeroPicker(bundleId, rowEl) {
    document.getElementById('inv-hero-picker')?.remove();

    const ownedHeroes = this._s.heroes?.getRosterWithState?.().filter(h => h.isOwned) ?? [];
    if (ownedHeroes.length === 0) {
      this._s.notifications?.show('warning', 'No Heroes', 'Recruit a hero first.');
      return;
    }

    const picker = document.createElement('div');
    picker.id = 'inv-hero-picker';
    picker.className = 'inv-hero-picker';
    picker.innerHTML = `
      <div class="inv-picker-label">Choose hero to receive XP:</div>
      ${ownedHeroes.map(h => `
        <button class="btn btn-xs inv-pick-hero" data-hero="${h.id}">
          ${h.icon} ${h.name} <span class="inv-pick-lv">Lv.${h.level}</span>
        </button>`).join('')}
      <button class="btn btn-xs btn-ghost" id="inv-picker-cancel">Cancel</button>`;

    rowEl?.after(picker);

    picker.querySelector('#inv-picker-cancel')?.addEventListener('click', () => {
      eventBus.emit('ui:click');
      picker.remove();
    });

    picker.querySelectorAll('.inv-pick-hero').forEach(btn => {
      btn.addEventListener('click', e => {
        eventBus.emit('ui:click');
        const heroId = e.currentTarget.dataset.hero;
        const r = this._s.inventory.useItem(bundleId, { heroId });
        picker.remove();
        if (!r.success) {
          eventBus.emit('ui:error');
          this._s.notifications?.show('warning', 'Cannot Apply', r.reason);
        } else {
          const hero = ownedHeroes.find(h => h.id === heroId);
          this._s.notifications?.show('success', '📖 XP Applied!', `+${r.xpAmount?.toLocaleString() ?? '?'} XP → ${hero?.name ?? heroId}`);
        }
      });
    });
  }
}
