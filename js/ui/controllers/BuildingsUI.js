/**
 * BuildingsUI.js
 * Renders the Base tab: build queue strip + grouped building category sections.
 *
 * UI sections:
 *  1. Build queue strip  (#build-queue-panel) — full-width, horizontal
 *  2. Grouped buildings  (#buildings-container) — per-category sections with multi-instance cards
 */
import { eventBus }         from '../../core/EventBus.js';
import { RES_META, fmt }    from '../uiUtils.js';
import { BUILDINGS_CONFIG, HEROES_CONFIG, HQ_UNLOCK_TABLE, UNITS_CONFIG, TECH_CONFIG, INVENTORY_ITEMS } from '../../entities/GAME_DATA.js';

export class BuildingsUI {
  /** @param {{ rm, bm, notifications, heroes }} systems */
  constructor(systems) {
    this._s = systems;
    this._activeCat       = null;
    this._activeType      = null;
    this._ttHideTimeout   = null;
    this._ttBid           = null;
    this._ttIdx           = 0;
  }

  render() {
    this._renderBaseGrid();
    this._renderSidebar();
    this._renderBuildingCards();
  }

  init() {
    this._unsubs = [];

    // Hide tooltip on click outside the grid
    document.addEventListener('click', e => {
      if (!e.target.closest('#base-grid') && !e.target.closest('#tile-tooltip')) {
        this._hideTileTooltip(true);
      }
    });

    // Keep tooltip visible when mouse re-enters it
    const tt = document.getElementById('tile-tooltip');
    if (tt) {
      tt.addEventListener('mouseenter', () => clearTimeout(this._ttHideTimeout));
      tt.addEventListener('mouseleave', () => { this._ttHideTimeout = setTimeout(() => this._hideTileTooltip(), 120); });
    }

    // Build queue sidebar toggle
    document.getElementById('bq-toggle')?.addEventListener('click', () => {
      document.getElementById('bq-sidebar')?.classList.toggle('is-collapsed');
    });

    this._unsubs.push(eventBus.on('ui:viewChanged',             v => { if (v === 'base') this.render(); }));
    this._unsubs.push(eventBus.on('building:completed',         () => { this.render(); this._refreshTooltip(); }));
    this._unsubs.push(eventBus.on('building:started',           () => {
      this.render();
      this._refreshTooltip();
      document.getElementById('bq-sidebar')?.classList.remove('is-collapsed');
    }));
    this._unsubs.push(eventBus.on('building:queueUpdated',      () => { this.render(); this._refreshTooltip(); }));
    this._unsubs.push(eventBus.on('building:automationEnabled', () => this.render()));
    this._unsubs.push(eventBus.on('tech:researched',            () => this.render()));
    this._unsubs.push(eventBus.on('tech:queueUpdated',          () => {
      this._renderSidebar();
      document.getElementById('bq-sidebar')?.classList.remove('is-collapsed');
    }));
    this._unsubs.push(eventBus.on('unit:queueUpdated',          () => {
      this._renderSidebar();
      document.getElementById('bq-sidebar')?.classList.remove('is-collapsed');
    }));
    this._unsubs.push(eventBus.on('heroes:updated',             () => this.render()));
    this._tickThrottle = 0;
    this._unsubs.push(eventBus.on('resources:tick', () => {
      const now = Date.now();
      if (now - this._tickThrottle >= 2000) {
        this._tickThrottle = now;
        this.render();
        this._refreshTooltip();
        eventBus.emit('buildings:rendered');
      }
    }));
    // Tutorial: show tooltip for the requested building
    this._unsubs.push(eventBus.on('buildings:focusBuilding', id => {
      const tile = document.querySelector(`#base-grid .base-tile[data-building-id="${id}"]`);
      if (tile) this._showTileTooltip(id, 0, tile.getBoundingClientRect());
    }));
  }

  destroy() {
    this._unsubs?.forEach(fn => fn());
    this._unsubs = [];
  }

  // ─────────────────────────────────────────────
  // Base Grid (visual city map)
  // ─────────────────────────────────────────────

  static SPRITE_MAP = {
    townhall:          'scifiStructure_01.png',
    heroquarters:      'scifiStructure_02.png',
    barracks:          'scifiStructure_03.png',
    construction_hall: 'scifiStructure_04.png',
    lumbermill:        'scifiStructure_05.png',
    storehouse:        'scifiStructure_06.png',
    cafeteria:         'scifiStructure_07.png',
    well:              'scifiStructure_08.png',
    mine:              'scifiStructure_09.png',
    quarry:            'scifiStructure_10.png',
    bank:              'scifiStructure_11.png',
    farm:              'scifiStructure_12.png',
    workshop:          'scifiStructure_13.png',
    archeryrange:      'scifiStructure_14.png',
    house:             'scifiStructure_15.png',
    cavalrystable:     'scifiStructure_15.png',
    infantryhall:      'scifiStructure_16.png',
    siegeworkshop:     'scifiStructure_03.png',
    magictower:        'scifiStructure_13.png',
  };

  _renderBaseGrid() {
    const grid = document.getElementById('base-grid');
    if (!grid) return;

    const COLS = 10;
    const ROWS = 7;
    const bm   = this._s.bm;

    // Build reverse lookup: "col,row" -> { buildingId, instanceIndex }
    const posMap = new Map();
    for (const [bid, cfg] of Object.entries(BUILDINGS_CONFIG)) {
      if (!cfg.gridPositions) continue;
      cfg.gridPositions.forEach((pos, idx) => {
        posMap.set(`${pos.col},${pos.row}`, { buildingId: bid, instanceIndex: idx });
      });
    }

    const queue = bm.getBuildQueue();
    const html  = [];

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const entry = posMap.get(`${col},${row}`);
        if (!entry) {
          html.push(`<div class="base-tile base-tile--empty"></div>`);
          continue;
        }

        const { buildingId, instanceIndex } = entry;
        const cfg   = BUILDINGS_CONFIG[buildingId];
        const level = bm.getInstanceLevelOf(`${buildingId}_${instanceIndex}`);
        const isBuilding = queue.some(q => q.buildingId === buildingId && q.instanceIndex === instanceIndex);

        // Hide slot if the instance slot is locked and not yet built
        if (level === 0 && bm.canBuild(buildingId, instanceIndex).ok === false &&
            cfg.instanceSlots[instanceIndex]?.condition) {
          html.push(`<div class="base-tile base-tile--empty"></div>`);
          continue;
        }

        const progressHtml = isBuilding
          ? `<div class="base-tile__progress"><div class="base-tile__progress-fill" style="width:50%"></div></div>`
          : '';
        const levelHtml = level > 0 ? `<span class="base-tile__level">Lv${level}</span>` : '';
        const sprite = BuildingsUI.SPRITE_MAP[buildingId];
        const spriteStyle = sprite
          ? `style="background-image:url('assets/sprites/buildings/${sprite}')"`
          : '';
        const isBuilt = level > 0;
        const classes = [
          'base-tile',
          isBuilding ? 'base-tile--building' : '',
          !isBuilt   ? 'base-tile--unbuilt'  : '',
        ].filter(Boolean).join(' ');

        html.push(`
          <div class="${classes}" data-building-id="${buildingId}" data-instance-index="${instanceIndex}"
               title="${cfg.name}${level > 0 ? ` (Lv.${level})` : ' — Tap to build'}" ${spriteStyle}>
            ${levelHtml}
            <span class="base-tile__name">${cfg.name}</span>
            ${progressHtml}
          </div>`);
      }
    }

    grid.innerHTML = html.join('');

    // Hover → show tooltip; click → toggle tooltip (touch-friendly fallback)
    grid.querySelectorAll('.base-tile[data-building-id]').forEach(tile => {
      const bid = tile.dataset.buildingId;
      const idx = parseInt(tile.dataset.instanceIndex, 10);

      tile.addEventListener('mouseenter', () => {
        clearTimeout(this._ttHideTimeout);
        this._showTileTooltip(bid, idx, tile.getBoundingClientRect());
      });
      tile.addEventListener('mouseleave', () => {
        this._ttHideTimeout = setTimeout(() => this._hideTileTooltip(), 120);
      });
      tile.addEventListener('click', e => {
        e.stopPropagation();
        const tt = document.getElementById('tile-tooltip');
        if (tt?.classList.contains('is-visible') && this._ttBid === bid && this._ttIdx === idx) {
          this._hideTileTooltip(true);
        } else {
          this._showTileTooltip(bid, idx, tile.getBoundingClientRect());
        }
      });
    });
  }

  // ─────────────────────────────────────────────
  // Tile hover tooltip
  // ─────────────────────────────────────────────

  _showTileTooltip(buildingId, instanceIndex, tileRect) {
    const tt = document.getElementById('tile-tooltip');
    if (!tt) return;

    const allTypes = this._s.bm.getBuildingTypesWithInstances();
    const bType    = allTypes.find(t => t.id === buildingId);
    const b        = bType?.instances[instanceIndex];
    const snap     = this._s.rm.getSnapshot();
    if (!b) return;

    const sprite    = BuildingsUI.SPRITE_MAP[buildingId];
    const spriteUrl = sprite ? `assets/sprites/buildings/${sprite}` : '';
    const isBuilt   = b.level > 0;
    const nextLv    = b.effectiveLevel + 1;

    const costHtml = Object.entries(b.cost).map(([res, amt]) => {
      const has = (snap[res]?.amount ?? 0) >= amt;
      return `<span class="cost-chip ${has ? 'affordable' : 'unaffordable'}">${RES_META[res]?.icon ?? '?'} ${fmt(amt)}</span>`;
    }).join('');

    const now = Date.now();
    const progressHtml = b.isActivelyBuilding && b.constructionEndsAt ? (() => {
      const pct  = Math.max(0, Math.min(100, ((now - (b.startedAt ?? 0)) / (b.constructionEndsAt - (b.startedAt ?? 0))) * 100));
      const secs = Math.max(0, Math.ceil((b.constructionEndsAt - now) / 1000));
      return `<div class="tt-progress progress-container" data-timer-start="${b.startedAt}" data-timer-end="${b.constructionEndsAt}">
        <div class="progress-label"><span>🏗️ Building…</span><span class="progress-time-label">${secs}s</span></div>
        <div class="progress-bar"><div class="progress-fill progress-fill-primary" style="width:${pct}%"></div></div>
      </div>`;
    })() : '';

    let btnText, btnCls, btnDisabled;
    if (!b.requirementsMet)  { btnText = `🔒 ${b.requirementsReason ?? 'Locked'}`;  btnCls = 'btn-ghost'; btnDisabled = true;  }
    else if (b.isMaxLevel)   { btnText = '⭐ Max Level';                              btnCls = 'btn-ghost'; btnDisabled = true;  }
    else if (!b.canAfford)   { btnText = isBuilt ? `→ Lv.${nextLv}` : 'Build';       btnCls = 'btn-ghost'; btnDisabled = true;  }
    else                     { btnText = isBuilt ? `→ Lv.${nextLv}` : 'Build';       btnCls = 'btn-primary';                    btnDisabled = false; }

    const timeHint = !b.isMaxLevel && !b.isActivelyBuilding && b.nextLevelBuildTime
      ? `<span class="tt-time-hint">⏱ ${fmt(b.nextLevelBuildTime)}s</span>` : '';

    tt.innerHTML = `
      <div class="tt-header">
        <div class="tt-sprite" style="background-image:url('${spriteUrl}')"></div>
        <div class="tt-title-block">
          <div class="tt-name">${b.name}</div>
          <div class="tt-level">${isBuilt ? `Lv. ${b.level} / ${b.maxLevel}` : 'Not built'}</div>
        </div>
      </div>
      ${b.effectLabel ? `<div class="tt-effect">${b.effectLabel}</div>` : ''}
      ${progressHtml}
      <div class="tt-costs">${costHtml}</div>
      <div class="tt-actions">
        <button class="btn btn-sm ${btnCls} tt-upgrade-btn" ${btnDisabled ? 'disabled' : ''}>${btnText}</button>
        ${timeHint}
      </div>
      <div class="tt-arrow"></div>`;

    // Position the tooltip
    const TT_W = 270;
    const TT_GAP = 10;
    let left = tileRect.left + tileRect.width / 2 - TT_W / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - TT_W - 8));

    const spaceAbove = tileRect.top;
    const above = spaceAbove > 180;
    const arrowLeft = Math.min(
      Math.max(tileRect.left + tileRect.width / 2 - left, 16),
      TT_W - 16
    );

    tt.style.width   = `${TT_W}px`;
    tt.style.left    = `${left}px`;
    tt.style.setProperty('--tt-arrow-left', `${arrowLeft}px`);
    tt.classList.toggle('tt-above', above);
    tt.classList.toggle('tt-below', !above);

    if (above) {
      tt.style.top    = 'auto';
      tt.style.bottom = `${window.innerHeight - tileRect.top + TT_GAP}px`;
    } else {
      tt.style.bottom = 'auto';
      tt.style.top    = `${tileRect.bottom + TT_GAP}px`;
    }

    this._ttBid = buildingId;
    this._ttIdx = instanceIndex;
    tt.style.display = 'block';
    requestAnimationFrame(() => tt.classList.add('is-visible'));

    tt.querySelector('.tt-upgrade-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      eventBus.emit('ui:click');
      const r = this._s.bm.build(buildingId, instanceIndex);
      if (!r.success) {
        eventBus.emit('ui:error');
        this._s.notifications?.show('warning', 'Cannot Build', r.reason);
      }
      this.render();
      const tile = document.querySelector(`#base-grid .base-tile[data-building-id="${buildingId}"][data-instance-index="${instanceIndex}"]`);
      this._showTileTooltip(buildingId, instanceIndex, tile?.getBoundingClientRect() ?? tileRect);
    });
  }

  _hideTileTooltip(immediate = false) {
    const tt = document.getElementById('tile-tooltip');
    if (!tt) return;
    tt.classList.remove('is-visible');
    this._ttBid = null;
    const delay = immediate ? 0 : 150;
    setTimeout(() => { if (!tt.classList.contains('is-visible')) tt.style.display = 'none'; }, delay);
  }

  _refreshTooltip() {
    if (!this._ttBid) return;
    const tile = document.querySelector(`#base-grid .base-tile[data-building-id="${this._ttBid}"][data-instance-index="${this._ttIdx}"]`);
    if (tile && document.getElementById('tile-tooltip')?.classList.contains('is-visible')) {
      this._showTileTooltip(this._ttBid, this._ttIdx, tile.getBoundingClientRect());
    }
  }

  // ─────────────────────────────────────────────
  // Activity Sidebar — Build + Research + Training
  // ─────────────────────────────────────────────

  _renderSidebar() {
    const panel = document.getElementById('build-queue-panel');
    if (!panel) return;

    panel.innerHTML = '';
    panel.appendChild(this._buildBuildSection());
    panel.appendChild(this._buildResearchSection());
    panel.appendChild(this._buildTrainingSection());

    // Badge = total active items across all queues
    const buildActive    = (this._s.bm?.getBuildQueue() ?? []).length;
    const researchActive = (this._s.tm?.getQueue()      ?? []).length;
    const trainActive    = (this._s.um?.getAllQueues()   ?? []).length;
    const total = buildActive + researchActive + trainActive;
    const countEl = document.getElementById('bq-toggle-count');
    if (countEl) countEl.textContent = total > 0 ? String(total) : '0';
  }

  _buildBuildSection() {
    const bm       = this._s.bm;
    const queue    = bm.getBuildQueue();
    const maxSlots = bm.getMaxBuildSlots();
    const slotInfo = bm.getBuildSlotInfo();
    const now      = Date.now();

    const section = document.createElement('div');
    section.className = 'aq-section';

    const header = document.createElement('div');
    header.className = 'aq-section-header aq-section-header--build';
    header.innerHTML = `<span class="aq-section-icon">🏗️</span><span class="aq-section-title">BUILD</span><span class="aq-section-count">${queue.length}/${maxSlots}</span>`;
    section.appendChild(header);

    const items = document.createElement('div');
    items.className = 'aq-items';

    // Active + queued items
    for (const queueItem of queue) {
      const cfg = queueItem.cfg ?? {};
      const el  = document.createElement('div');

      if (queueItem.isActive) {
        const startedAt = queueItem.startedAt ?? 0;
        const endsAt    = queueItem.endsAt    ?? 0;
        const pct       = endsAt ? Math.max(0, Math.min(100, ((now - startedAt) / (endsAt - startedAt)) * 100)) : 0;
        const secsLeft  = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;
        el.className = 'aq-slot aq-slot--active';
        el.innerHTML = `
          <div class="aq-slot-row">
            <span class="aq-slot-icon">${cfg.icon ?? '🏗️'}</span>
            <div class="aq-slot-info">
              <div class="aq-slot-name">${cfg.name ?? queueItem.buildingId}</div>
              <div class="aq-slot-sub">→ Lv.${queueItem.pendingLevel}</div>
            </div>
            <div class="aq-slot-actions">
              <button class="aq-speed-btn" title="Speed Up">⏩</button>
              <button class="aq-cancel-btn" title="Cancel &amp; refund">✕</button>
            </div>
          </div>
          <div class="progress-container aq-progress" data-timer-start="${startedAt}" data-timer-end="${endsAt}">
            <div class="progress-label aq-progress-label">
              <span class="progress-time-label">${secsLeft}s</span>
            </div>
            <div class="progress-bar"><div class="progress-fill progress-fill-primary" style="width:${pct}%"></div></div>
          </div>`;
        el.querySelector('.aq-cancel-btn')?.addEventListener('click', e => {
          e.stopPropagation();
          eventBus.emit('ui:click');
          const r = bm.cancelBuild(0);
          if (!r.success) this._s.notifications?.show('warning', 'Cannot Cancel', r.reason);
        });
        el.querySelector('.aq-speed-btn')?.addEventListener('click', e => {
          e.stopPropagation();
          eventBus.emit('ui:click');
          this._openSpeedupPicker(el, 'building', secsLeft);
        });
      } else {
        el.className = 'aq-slot aq-slot--queued';
        el.innerHTML = `
          <div class="aq-slot-row">
            <span class="aq-slot-icon">${cfg.icon ?? '🏗️'}</span>
            <div class="aq-slot-info">
              <div class="aq-slot-name">${cfg.name ?? queueItem.buildingId}</div>
              <div class="aq-slot-sub">→ Lv.${queueItem.pendingLevel} · #${queueItem.queuePosition + 1}</div>
            </div>
            <button class="aq-cancel-btn" title="Cancel &amp; refund">✕</button>
          </div>`;
        const pos = queueItem.queuePosition;
        el.querySelector('.aq-cancel-btn')?.addEventListener('click', e => {
          e.stopPropagation();
          eventBus.emit('ui:click');
          const r = bm.cancelBuild(pos);
          if (!r.success) this._s.notifications?.show('warning', 'Cannot Cancel', r.reason);
        });
      }
      items.appendChild(el);
    }

    // Show empty state only if all unlocked slots are empty
    if (queue.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'aq-empty';
      emptyEl.textContent = 'No builds queued';
      items.appendChild(emptyEl);
    }

    // Summarize locked slots compactly
    const lockedCount = slotInfo.filter(s => !s.unlocked).length;
    if (lockedCount > 0) {
      const lockEl = document.createElement('div');
      lockEl.className = 'aq-locked-summary';
      lockEl.innerHTML = `🔒 ${lockedCount} slot${lockedCount > 1 ? 's' : ''} locked`;
      items.appendChild(lockEl);
    }

    section.appendChild(items);
    return section;
  }

  _buildResearchSection() {
    const tm    = this._s.tm;
    const queue = tm ? tm.getQueue() : [];
    const now   = Date.now();

    const section = document.createElement('div');
    section.className = 'aq-section';

    const header = document.createElement('div');
    header.className = 'aq-section-header aq-section-header--research';
    header.innerHTML = `<span class="aq-section-icon">🔬</span><span class="aq-section-title">RESEARCH</span><span class="aq-section-count">${queue.length}</span>`;
    section.appendChild(header);

    const items = document.createElement('div');
    items.className = 'aq-items';

    if (!tm || queue.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'aq-empty';
      emptyEl.textContent = 'No research active';
      items.appendChild(emptyEl);
    } else {
      for (const item of queue) {
        const el = document.createElement('div');
        if (item.isActive && item.researchEndsAt) {
          const pct      = Math.max(0, Math.min(100, ((now - (item.startedAt ?? 0)) / (item.researchEndsAt - (item.startedAt ?? 0))) * 100));
          const secsLeft = Math.max(0, Math.ceil((item.researchEndsAt - now) / 1000));
          el.className = 'aq-slot aq-slot--active';
          el.innerHTML = `
            <div class="aq-slot-row">
              <span class="aq-slot-icon">${item.icon ?? '🔬'}</span>
              <div class="aq-slot-info">
                <div class="aq-slot-name">${item.name}</div>
                <div class="aq-slot-sub">→ Lv.${item.targetLevel}</div>
              </div>
              <div class="aq-slot-actions">
                <button class="aq-speed-btn" title="Speed Up">⏩</button>
                <button class="aq-cancel-btn" title="Cancel &amp; refund">✕</button>
              </div>
            </div>
            <div class="progress-container aq-progress" data-timer-start="${item.startedAt}" data-timer-end="${item.researchEndsAt}">
              <div class="progress-label aq-progress-label">
                <span class="progress-time-label">${secsLeft}s</span>
              </div>
              <div class="progress-bar"><div class="progress-fill progress-fill-success" style="width:${pct}%"></div></div>
            </div>`;
          const techId = item.techId;
          el.querySelector('.aq-cancel-btn')?.addEventListener('click', e => {
            e.stopPropagation();
            eventBus.emit('ui:click');
            const r = tm.cancelResearch(techId);
            if (!r.success) this._s.notifications?.show('warning', 'Cannot Cancel', r.reason);
          });
          el.querySelector('.aq-speed-btn')?.addEventListener('click', e => {
            e.stopPropagation();
            eventBus.emit('ui:click');
            this._openSpeedupPicker(el, 'research', secsLeft);
          });
        } else {
          el.className = 'aq-slot aq-slot--queued';
          el.innerHTML = `
            <div class="aq-slot-row">
              <span class="aq-slot-icon">${item.icon ?? '🔬'}</span>
              <div class="aq-slot-info">
                <div class="aq-slot-name">${item.name}</div>
                <div class="aq-slot-sub">→ Lv.${item.targetLevel} · #${item.queuePosition + 1}</div>
              </div>
              <button class="aq-cancel-btn" title="Cancel &amp; refund">✕</button>
            </div>`;
          const techId = item.techId;
          el.querySelector('.aq-cancel-btn')?.addEventListener('click', e => {
            e.stopPropagation();
            eventBus.emit('ui:click');
            const r = tm.cancelResearch(techId);
            if (!r.success) this._s.notifications?.show('warning', 'Cannot Cancel', r.reason);
          });
        }
        items.appendChild(el);
      }
    }

    section.appendChild(items);
    return section;
  }

  _buildTrainingSection() {
    const um    = this._s.um;
    const items = um ? um.getAllQueues() : [];
    const now   = Date.now();

    const section = document.createElement('div');
    section.className = 'aq-section';

    const header = document.createElement('div');
    header.className = 'aq-section-header aq-section-header--training';
    header.innerHTML = `<span class="aq-section-icon">⚔️</span><span class="aq-section-title">TRAINING</span><span class="aq-section-count">${items.length}</span>`;
    section.appendChild(header);

    const itemsEl = document.createElement('div');
    itemsEl.className = 'aq-items';

    if (!um || items.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'aq-empty';
      emptyEl.textContent = 'No units training';
      itemsEl.appendChild(emptyEl);
    } else {
      for (const item of items) {
        const el = document.createElement('div');
        const isActive = item.queueIndex === 0 && item.endsAt > 0;
        if (isActive) {
          const pct      = Math.max(0, Math.min(100, ((now - (item.startedAt ?? 0)) / (item.endsAt - (item.startedAt ?? 0))) * 100));
          const secsLeft = Math.max(0, Math.ceil((item.endsAt - now) / 1000));
          el.className = 'aq-slot aq-slot--active';
          el.innerHTML = `
            <div class="aq-slot-row">
              <span class="aq-slot-icon">${item.icon ?? '⚔️'}</span>
              <div class="aq-slot-info">
                <div class="aq-slot-name">${item.name ?? item.unitId} ×${item.count}</div>
                <div class="aq-slot-sub">T${item.tier}</div>
              </div>
              <div class="aq-slot-actions">
                <button class="aq-speed-btn" title="Speed Up">⏩</button>
                <button class="aq-cancel-btn" title="Cancel &amp; refund">✕</button>
              </div>
            </div>
            <div class="progress-container aq-progress" data-timer-start="${item.startedAt}" data-timer-end="${item.endsAt}">
              <div class="progress-label aq-progress-label">
                <span class="progress-time-label">${secsLeft}s</span>
              </div>
              <div class="progress-bar"><div class="progress-fill progress-fill-danger" style="width:${pct}%"></div></div>
            </div>`;
          const { buildingId, queueIndex } = item;
          el.querySelector('.aq-cancel-btn')?.addEventListener('click', e => {
            e.stopPropagation();
            eventBus.emit('ui:click');
            const r = um.cancelTrain(buildingId, queueIndex);
            if (!r.success) this._s.notifications?.show('warning', 'Cannot Cancel', r.reason);
          });
          el.querySelector('.aq-speed-btn')?.addEventListener('click', e => {
            e.stopPropagation();
            eventBus.emit('ui:click');
            this._openSpeedupPicker(el, 'training', secsLeft);
          });
        } else {
          el.className = 'aq-slot aq-slot--queued';
          el.innerHTML = `
            <div class="aq-slot-row">
              <span class="aq-slot-icon">${item.icon ?? '⚔️'}</span>
              <div class="aq-slot-info">
                <div class="aq-slot-name">${item.name ?? item.unitId} ×${item.count}</div>
                <div class="aq-slot-sub">T${item.tier} · #${item.queueIndex + 1}</div>
              </div>
              <button class="aq-cancel-btn" title="Cancel &amp; refund">✕</button>
            </div>`;
          const { buildingId, queueIndex } = item;
          el.querySelector('.aq-cancel-btn')?.addEventListener('click', e => {
            e.stopPropagation();
            eventBus.emit('ui:click');
            const r = um.cancelTrain(buildingId, queueIndex);
            if (!r.success) this._s.notifications?.show('warning', 'Cannot Cancel', r.reason);
          });
        }
        itemsEl.appendChild(el);
      }
    }

    section.appendChild(itemsEl);
    return section;
  }

  // ─────────────────────────────────────────────
  // Grouped Building Sections — two-level tabs
  // ─────────────────────────────────────────────

  _renderBuildingCards() {
    const container = document.getElementById('buildings-grid');
    if (!container) return;
    container.innerHTML = '';
    container.className = 'buildings-container';

    const snap = this._s.rm.getSnapshot();

    const CATEGORIES = [
      { id: 'core',       label: 'Core',       icon: '🏛️' },
      { id: 'production', label: 'Production', icon: '⚒️' },
      { id: 'population', label: 'Population', icon: '👥' },
      { id: 'military',   label: 'Military',   icon: '⚔️' },
    ];

    const allTypes   = this._s.bm.getBuildingTypesWithInstances();
    const activeCats = CATEGORIES.filter(c => allTypes.some(t => t.category === c.id));
    if (activeCats.length === 0) return;

    // Default to first available category / type
    if (!this._activeCat || !activeCats.find(c => c.id === this._activeCat)) {
      this._activeCat = activeCats[0].id;
    }

    // ── Level 1: Category tab strip ──────────────
    const catStrip = document.createElement('div');
    catStrip.className = 'bc-cat-tabs';

    for (const cat of activeCats) {
      const typesInCat  = allTypes.filter(t => t.category === cat.id);
      const built       = typesInCat.reduce((s, t) => s + t.instances.filter(i => i.level > 0).length, 0);
      const total       = typesInCat.reduce((s, t) => s + t.totalSlots, 0);
      const isBuilding  = typesInCat.some(t => t.instances.some(i => i.isActivelyBuilding));

      const btn = document.createElement('button');
      btn.className = `bc-cat-tab${this._activeCat === cat.id ? ' active' : ''}`;
      btn.innerHTML = `
        <span>${cat.icon} ${cat.label}</span>
        ${isBuilding ? '<span class="bc-pip bc-pip-building"></span>' : ''}
        <span class="bc-cat-stat">${built}/${total}</span>`;
      btn.addEventListener('click', () => {
        this._activeCat  = cat.id;
        this._activeType = null;
        this._renderBuildingCards();
      });
      catStrip.appendChild(btn);
    }
    container.appendChild(catStrip);

    // ── Level 2: Building-type tab strip ─────────
    const typesInCat = allTypes.filter(t => t.category === this._activeCat);

    if (!this._activeType || !typesInCat.find(t => t.id === this._activeType)) {
      this._activeType = typesInCat[0]?.id ?? null;
    }

    if (typesInCat.length > 1) {
      const typeStrip = document.createElement('div');
      typeStrip.className = 'bc-type-tabs';

      for (const bType of typesInCat) {
        const hasBuilt   = bType.instances.some(i => i.level > 0);
        const isBuilding = bType.instances.some(i => i.isActivelyBuilding);
        const builtCount = bType.instances.filter(i => i.level > 0).length;

        const btn = document.createElement('button');
        btn.className = `bc-type-tab${this._activeType === bType.id ? ' active' : ''}${bType.isHQLocked ? ' bc-type-tab-locked' : ''}`;
        btn.innerHTML = `
          <span class="bc-type-icon">${bType.icon}</span>
          <span>${bType.name}</span>
          ${bType.isHQLocked ? `<span class="bc-type-lock">🔒</span>`
            : isBuilding ? '<span class="bc-pip bc-pip-building"></span>'
            : hasBuilt ? `<span class="bc-type-count">${builtCount}</span>` : ''}`;
        btn.addEventListener('click', () => {
          this._activeType = bType.id;
          this._renderBuildingCards();
        });
        typeStrip.appendChild(btn);
      }
      container.appendChild(typeStrip);
    }

    // ── Card grid for the selected building type ──
    const bType = typesInCat.find(t => t.id === this._activeType);
    if (!bType) return;

    const grid = document.createElement('div');
    grid.className = 'buildings-grid';

    // HQ-locked building type — show a single locked card
    if (bType.isHQLocked) {
      grid.appendChild(this._buildHQLockedCard(bType));
    } else {
      const multiInst = bType.totalSlots > 1;
      for (const inst of bType.instances) {
        grid.appendChild(this._buildCard(inst, snap, multiInst));
      }
      for (const slot of bType.lockedSlots) {
        grid.appendChild(this._buildLockedSlotCard(bType, slot));
      }
    }

    container.appendChild(grid);
  }

  /** Build a live building instance card. */
  _buildCard(b, snap, showInstanceLabel) {
    const costHtml = Object.entries(b.cost).map(([res, amt]) =>
      `<span class="cost-chip ${(snap[res]?.amount ?? 0) >= amt ? 'affordable' : 'unaffordable'}">${RES_META[res]?.icon ?? '?'} ${fmt(amt)}</span>`
    ).join('');

    // ── Hero station section ──
    let heroStationHtml = '';
    const hm = this._s.heroes;
    if (hm) {
      const compatCfg = Object.values(HEROES_CONFIG).find(h => h.buildingBonus?.buildingType === b.id);
      if (compatCfg) {
        const stationed = hm.getBuildingHero(b.instanceId);
        if (stationed) {
          const hName   = HEROES_CONFIG[stationed.heroId]?.name ?? stationed.heroId;
          const hTier   = HEROES_CONFIG[stationed.heroId]?.tier ?? 'common';
          const bonusPct = stationed.level * 5;
          heroStationHtml = `
            <div class="hero-station-section">
              <div class="hero-stationed-badge">
                <span class="stationed-tier-dot stationed-tier-dot--${hTier}"></span>
                <span class="stationed-name">${hName}</span>
                <span class="stationed-bonus">+${bonusPct}%</span>
                <button class="btn-unstation" data-hero="${stationed.heroId}">✕</button>
              </div>
            </div>`;
        } else {
          const roster    = hm.getRosterWithState?.() ?? [];
          const heroState = roster.find(h => h.id === compatCfg.id);
          if (heroState?.isOwned && !heroState.isInSquad && !heroState.isInBuilding) {
            heroStationHtml = `
              <div class="hero-station-section">
                <button class="btn btn-xs btn-station-hero" data-hero="${compatCfg.id}" data-instance="${b.instanceId}">
                  ${compatCfg.icon} Station ${compatCfg.name}
                </button>
              </div>`;
          } else if (heroState?.isOwned && heroState.isInSquad) {
            heroStationHtml = `
              <div class="hero-station-section hero-station-busy">
                <span class="stationed-busy-label">${compatCfg.icon} ${compatCfg.name} is on squad duty</span>
              </div>`;
          }
        }
      }
    }

    const now       = Date.now();
    const startedAt = b.startedAt ?? 0;
    const pct       = b.isActivelyBuilding && b.constructionEndsAt
      ? Math.max(0, Math.min(100, ((now - startedAt) / (b.constructionEndsAt - startedAt)) * 100)) : 0;
    const secsLeft  = b.isActivelyBuilding && b.constructionEndsAt
      ? Math.max(0, Math.ceil((b.constructionEndsAt - now) / 1000)) : 0;

    const progressHtml = b.isActivelyBuilding && b.constructionEndsAt ? `
      <div class="progress-container" data-timer-start="${startedAt}" data-timer-end="${b.constructionEndsAt}">
        <div class="progress-label"><span>🏗️ Building…</span><span class="progress-time-label">${secsLeft}s</span></div>
        <div class="progress-bar"><div class="progress-fill progress-fill-primary" style="width:${pct}%"></div></div>
      </div>` : '';

    const effectLabelHtml = (() => {
      const isMaxed_ = b.isMaxLevel;
      // Production buildings: show current → next rate delta
      const numericEffects = Object.entries(b.effects ?? {}).filter(([, v]) => typeof v === 'number');
      if (numericEffects.length > 0 && b.level > 0) {
        const parts = numericEffects.map(([res, rate]) => {
          const icon = RES_META[res]?.icon ?? res;
          const cur  = +(rate * b.level).toFixed(1);
          if (isMaxed_) return `${icon} ${cur}/s`;
          const nxt  = +(rate * (b.level + 1)).toFixed(1);
          return `${icon} ${cur}/s → ${nxt}/s`;
        });
        return `<div class="building-effect-label">${parts.join(' · ')}</div>`;
      }
      // Storage buildings: show current → next cap contribution
      if (b.storageCap && b.level > 0) {
        // If storageCap uses level-indexed arrays, the effectLabel is more descriptive;
        // show a compact "current level cap" line for just the top two resources instead.
        const entries = Object.entries(b.storageCap);
        const isArrayBased = entries.some(([, v]) => Array.isArray(v));
        if (isArrayBased) {
          // Show the effectLabel (already descriptive) — tooltips carry the full numbers
          return b.effectLabel ? `<div class="building-effect-label">${b.effectLabel}</div>` : '';
        }
        const parts = entries.map(([res, capPerLv]) => {
          const icon = RES_META[res]?.icon ?? res;
          const cur  = fmt(capPerLv * b.level);
          if (isMaxed_) return `${icon} +${cur}`;
          const nxt  = fmt(capPerLv * (b.level + 1));
          return `${icon} +${cur} → +${nxt}`;
        });
        return `<div class="building-effect-label">📦 ${parts.join(' · ')}</div>`;
      }
      // Fallback: static label from config
      return b.effectLabel ? `<div class="building-effect-label">${b.effectLabel}</div>` : '';
    })();

    const autoRestockActive = b.id === 'cafeteria' && (this._s.bm?.getAutomations()?.cafeteriaRestock === true);
    const automationBadge   = autoRestockActive
      ? `<div class="cafeteria-auto-badge">🤖 Auto-restock active</div>` : '';

    const cafeteriaStockHtml = (b.id === 'cafeteria' && b.level > 0) ? (() => {
      const _cfp = BUILDINGS_CONFIG['cafeteria']?.foodCapacityPerLevel  ?? 200;
      const _cwp = BUILDINGS_CONFIG['cafeteria']?.waterCapacityPerLevel ?? 200;
      const stockCap = Array.isArray(_cfp) ? (_cfp[b.level] ?? 0) : _cfp * b.level;
      const wtrCap   = Array.isArray(_cwp) ? (_cwp[b.level] ?? 0) : _cwp * b.level;
      const food  = Math.floor(b.stock?.food  ?? 0);
      const water = Math.floor(b.stock?.water ?? 0);
      const depletionStr = (() => {
        if (!b.drainRatePerSec) return '♾️ No consumption';
        if (!isFinite(b.depletionSec)) return '♾️ Stocked';
        const s = Math.max(0, Math.floor(b.depletionSec));
        if (s < 60) return `⏱️ ~${s}s until empty`;
        const m = Math.floor(s / 60), r = s % 60;
        return `⏱️ ~${m}m ${r}s until empty`;
      })();
      return `<div class="cafeteria-stock">
        <div class="cafeteria-stock-row"><span>🌾 Food stock</span><span>${food} / ${stockCap}</span></div>
        <div class="cafeteria-stock-row"><span>💧 Water stock</span><span>${water} / ${wtrCap}</span></div>
        <div class="cafeteria-stock-row cafeteria-depletion"><span>${depletionStr}</span></div>
      </div>`;
    })() : '';

    // Pre-compute restock cap for cafeteria data-cap attribute (array-safe)
    const _rcfp = BUILDINGS_CONFIG['cafeteria']?.foodCapacityPerLevel ?? 200;
    const cafRestockCap = b.id === 'cafeteria'
      ? (Array.isArray(_rcfp) ? (_rcfp[b.level] ?? 0) : _rcfp * b.level)
      : 0;

    const queueBadgeHtml = b.queuedCount > 0 && !b.isActivelyBuilding
      ? `<span class="build-queue-badge">🏗️ ×${b.queuedCount} queued</span>` : '';

    // HQ preview: show what the next level unlocks on the townhall card
    const hqPreviewHtml = b.id === 'townhall' ? this._buildHQPreview() : '';

    // HQ current benefits on townhall card
    const hqBenefitsHtml = (b.id === 'townhall' && b.level > 0) ? (() => {
      const ben = this._s.bm.getHQBenefits();
      const parts = [];
      if (ben.productionBonus > 0) parts.push(`⚒️ +${Math.round(ben.productionBonus * 100)}% Production`);
      if (ben.attackBonus > 0)     parts.push(`⚔️ +${Math.round(ben.attackBonus * 100)}% ATK`);
      if (ben.defenseBonus > 0)    parts.push(`🛡️ +${Math.round(ben.defenseBonus * 100)}% DEF`);
      if (ben.storageBonus > 0)    parts.push(`📦 +${Math.round(ben.storageBonus * 100)}% Storage`);
      if (parts.length === 0) return '';
      return `<div class="hq-benefits"><span class="hq-benefits-title">Active HQ Bonuses:</span> ${parts.join(' · ')}</div>`;
    })() : '';

    const instLabel = (showInstanceLabel && b.instanceIndex >= 0)
      ? ` <span class="instance-label">#${b.instanceIndex + 1}</span>` : '';

    const displayLevel = b.effectiveLevel > b.level
      ? `Lv.${b.level}<span style="color:var(--clr-gold);font-size:10px;margin-left:2px">+${b.effectiveLevel - b.level}</span>`
      : `Lv.${b.level}`;

    const isMaxed  = b.isMaxLevel;
    const reqText  = b.requirementsReason ?? '';
    const nextLv   = b.effectiveLevel + 1;

    // Full requirements list (all unmet, not just first)
    const requirementsListHtml = (() => {
      const missing = b.missingRequirements ?? [];
      if (missing.length <= 1) return ''; // single entry already shown in button label
      return `<ul class="requirements-list">${missing.map(r => `<li>${r}</li>`).join('')}</ul>`;
    })();

    // House: show cafeteria capacity and population headroom
    const houseInfoHtml = (b.id === 'house' && b.level > 0) ? (() => {
      const rm      = this._s.rm;
      const foodCap = rm?.getFoodCapacity?.() ?? 0;
      const pop     = rm?.getPopulation?.() ?? { current: 0, cap: 0 };
      const popPerLv = BUILDINGS_CONFIG['house']?.populationCapacityPerLevel ?? 10;
      return `<div class="building-info-row">🍽️ Cafeteria stock cap: ${foodCap} &nbsp;·&nbsp; 👥 Pop: ${Math.floor(pop.current)}/${pop.cap} (+${popPerLv} on upgrade)</div>`;
    })() : '';

    // Bank: show population requirement for next upgrade level
    const bankInfoHtml = (b.id === 'bank' && !b.isMaxLevel) ? (() => {
      const lvlReqs = BUILDINGS_CONFIG['bank']?.levelRequirements ?? {};
      const nextPopReq = lvlReqs[nextLv]?.population;
      if (!nextPopReq) return '';
      const rm  = this._s.rm;
      const pop = rm?.getPopulation?.() ?? { current: 0, cap: 0 };
      const met = pop.current >= nextPopReq;
      return `<div class="building-info-row${met ? '' : ' building-info-row--warn'}">👥 Pop for Lv.${nextLv}: ${Math.floor(pop.current)}/${nextPopReq}${met ? ' ✓' : ' ✗'}</div>`;
    })() : '';

    const timeHint = !isMaxed && !b.isActivelyBuilding && b.nextLevelBuildTime
      ? `<span class="tech-time-hint">⏱ ${fmt(b.nextLevelBuildTime)}s</span>` : '';

    let btnText, btnCls, btnDisabled;
    if (!b.requirementsMet)  { btnText = `🔒 ${reqText}`;                             btnCls = 'btn-ghost'; btnDisabled = true;  }
    else if (isMaxed)        { btnText = '⭐ Max Level';                               btnCls = 'btn-ghost'; btnDisabled = true;  }
    else if (!b.canAfford)   { btnText = b.level === 0 ? 'Build' : `→ Lv.${nextLv}`; btnCls = 'btn-ghost'; btnDisabled = true;  }
    else                     { btnText = b.level === 0 ? 'Build' : `→ Lv.${nextLv}`; btnCls = b.level === 0 ? 'btn-primary' : 'btn-ghost'; btnDisabled = false; }

    const card = document.createElement('div');
    card.className = `card building-card${isMaxed ? ' card-gold' : ''}${b.level > 0 ? ' card-primary' : ''}`;
    card.dataset.bid = b.id;
    card.innerHTML = `
      <div class="card-header">
        <div class="card-icon">${b.icon}</div>
        <div style="flex:1;min-width:0">
          <div class="card-title">${b.name}${instLabel}</div>
          <div class="card-subtitle">${b.description}</div>
        </div>
        ${b.level > 0 ? `<span class="level-badge">${displayLevel}</span>` : ''}
      </div>
      <div class="card-body">
        <div class="cost-row">${costHtml}</div>
        ${effectLabelHtml}
        ${cafeteriaStockHtml}
        ${automationBadge}
        ${requirementsListHtml}
        ${houseInfoHtml}
        ${bankInfoHtml}
        ${queueBadgeHtml}
        ${hqBenefitsHtml}
        ${hqPreviewHtml}
      </div>
      ${heroStationHtml}
      ${progressHtml}
      <div class="card-footer">
        <button class="btn btn-sm ${btnCls} btn-build" ${btnDisabled ? 'disabled' : ''}>${btnText}</button>
        ${timeHint}
        ${b.id === 'cafeteria' && b.level > 0 ? `<button class="btn btn-sm btn-primary btn-restock-cafeteria" data-instance="${b.instanceId}" data-cap="${cafRestockCap}">🔄 Restock</button>` : ''}
        ${b.level > 0 && !b.isActivelyBuilding ? `<span style="font-size:var(--text-xs);color:var(--clr-text-muted)">Lv.${b.level}/${b.maxLevel}</span>` : ''}
      </div>`;

    card.querySelector('.btn-build')?.addEventListener('click', () => {
      eventBus.emit('ui:click');
      const r = this._s.bm.build(b.id, b.instanceIndex);
      if (!r.success) {
        eventBus.emit('ui:error');
        this._s.notifications?.show('warning', 'Cannot Build', r.reason);
      }
      this.render();
    });

    card.querySelector('.btn-restock-cafeteria')?.addEventListener('click', e => {
      eventBus.emit('ui:click');
      const instanceId = e.currentTarget.dataset.instance;
      const cap = Number(e.currentTarget.dataset.cap);
      const r = this._s.bm.restockCafeteria(instanceId, cap, cap);
      if (!r.success) {
        eventBus.emit('ui:error');
        this._s.notifications?.show('warning', 'Cannot Restock', r.reason);
      } else {
        this._s.notifications?.show('success', '🍽️ Restocked', 'Cafeteria refilled from global supply.');
      }
      this.render();
    });

    card.querySelector('.btn-station-hero')?.addEventListener('click', e => {
      eventBus.emit('ui:click');
      const heroId     = e.currentTarget.dataset.hero;
      const instanceId = e.currentTarget.dataset.instance;
      const r = this._s.heroes.assignHeroToBuilding(heroId, instanceId);
      if (!r.success) {
        eventBus.emit('ui:error');
        this._s.notifications?.show('warning', 'Cannot Station', r.reason);
      }
      this.render();
    });

    card.querySelector('.btn-unstation')?.addEventListener('click', e => {
      eventBus.emit('ui:click');
      const heroId = e.currentTarget.dataset.hero;
      const r = this._s.heroes.unassignHeroFromBuilding(heroId);
      if (!r.success) {
        eventBus.emit('ui:error');
        this._s.notifications?.show('warning', 'Cannot Unstation', r.reason);
      }
      this.render();
    });

    // ── Rich tooltip on card header showing next-level stat delta + build time ──
    (() => {
      const ttParts = [];
      if (!b.isMaxLevel) {
        const numericEffects = Object.entries(b.effects ?? {}).filter(([, v]) => typeof v === 'number');
        if (numericEffects.length && b.level > 0) {
          numericEffects.forEach(([res, rate]) => {
            const icon = RES_META[res]?.icon ?? res;
            const cur  = +(rate * b.level).toFixed(1);
            const nxt  = +(rate * (b.level + 1)).toFixed(1);
            ttParts.push(`<div class="tt-row"><span class="tt-label">${icon} Rate</span><span>${cur}/s → <strong>${nxt}/s</strong></span></div>`);
          });
        }
        if (b.storageCap) {
          Object.entries(b.storageCap).forEach(([res, capPerLv]) => {
            const icon = RES_META[res]?.icon ?? res;
            const lv  = b.level;
            const cur = Array.isArray(capPerLv) ? fmt(capPerLv[lv] ?? 0) : fmt(capPerLv * lv);
            const nxt = Array.isArray(capPerLv) ? fmt(capPerLv[lv + 1] ?? 0) : fmt(capPerLv * (lv + 1));
            ttParts.push(`<div class="tt-row"><span class="tt-label">${icon} Cap</span><span>+${cur} → <strong>+${nxt}</strong></span></div>`);
          });
        }
        if (b.nextLevelBuildTime) {
          ttParts.push(`<div class="tt-row"><span class="tt-label">⏱ Build time</span><span>${fmt(b.nextLevelBuildTime)}s</span></div>`);
        }
      } else {
        ttParts.push(`<div class="tt-row tt-muted">⭐ Maximum level reached</div>`);
      }
      if (ttParts.length) {
        const head = `<div class="tt-title">${b.name}${!b.isMaxLevel ? ` → Lv.${nextLv}` : ''}</div>`;
        card.querySelector('.card-header').dataset.tooltipHtml = head + ttParts.join('');
      }
    })();

    return card;
  }

  /** Build a locked future slot indicator card. */
  _buildLockedSlotCard(bType, slot) {
    // Only show conditions that are not yet satisfied
    const unmetConditions = slot.condition
      ? Object.entries(slot.condition).filter(([bId, lv]) => (this._s.bm?.getLevelOf(bId) ?? 0) < lv)
      : [];
    const condText = unmetConditions
      .map(([bId, lv]) => `${BUILDINGS_CONFIG[bId]?.name ?? bId} Lv.${lv}`)
      .join(' + ');

    const card = document.createElement('div');
    card.className = 'card building-card building-card-locked';
    card.innerHTML = `
      <div class="card-header" style="opacity:0.45">
        <div class="card-icon">${bType.icon}</div>
        <div style="flex:1;min-width:0">
          <div class="card-title">${bType.name} <span class="instance-label">#${slot.instanceIndex + 1}</span></div>
          <div class="card-subtitle">Additional slot</div>
        </div>
      </div>
      <div class="card-body locked-slot-body">
        <div class="locked-slot-icon">🔒</div>
        ${condText ? `<div class="locked-slot-req">Requires: ${condText}</div>` : ''}
      </div>`;
    return card;
  }

  /** Build a card for a building type that is locked behind an HQ level. */
  _buildHQLockedCard(bType) {
    const card = document.createElement('div');
    card.className = 'card building-card building-card-locked';
    card.innerHTML = `
      <div class="card-header" style="opacity:0.45">
        <div class="card-icon">${bType.icon}</div>
        <div style="flex:1;min-width:0">
          <div class="card-title">${bType.name}</div>
          <div class="card-subtitle">${bType.description}</div>
        </div>
      </div>
      <div class="card-body locked-slot-body">
        <div class="locked-slot-icon">🔒</div>
        <div class="locked-slot-req">Requires HQ Lv.${bType.hqRequiredLevel}</div>
        ${bType.effectLabel ? `<div class="building-effect-label" style="opacity:0.5;margin-top:6px">${bType.effectLabel}</div>` : ''}
      </div>`;
    return card;
  }

  /**
   * Build an HTML string previewing what the next HQ level unlocks.
   * Shown inside the townhall building card.
   */
  _buildHQPreview() {
    const hqLv = this._s.bm.getHQLevel();
    const nextLv = hqLv + 1;
    const entry  = HQ_UNLOCK_TABLE[nextLv];
    if (!entry) return '';

    const parts = [];

    if (entry.buildings.length > 0) {
      const names = entry.buildings.map(id => BUILDINGS_CONFIG[id]?.name ?? id).join(', ');
      parts.push(`<div class="hq-preview-row">🏗️ <strong>Buildings:</strong> ${names}</div>`);
    }
    if (entry.units.length > 0) {
      const names = entry.units.map(id => UNITS_CONFIG[id]?.name ?? id).join(', ');
      parts.push(`<div class="hq-preview-row">⚔️ <strong>Units:</strong> ${names}</div>`);
    }
    if (entry.techs.length > 0) {
      const names = entry.techs.map(id => TECH_CONFIG[id]?.name ?? id).join(', ');
      parts.push(`<div class="hq-preview-row">🔬 <strong>Techs:</strong> ${names}</div>`);
    }

    const b = entry.benefits;
    const bonusParts = [];
    if (b.productionBonus > 0) bonusParts.push(`+${Math.round(b.productionBonus * 100)}% Production`);
    if (b.attackBonus > 0)     bonusParts.push(`+${Math.round(b.attackBonus * 100)}% ATK`);
    if (b.defenseBonus > 0)    bonusParts.push(`+${Math.round(b.defenseBonus * 100)}% DEF`);
    if (b.storageBonus > 0)    bonusParts.push(`+${Math.round(b.storageBonus * 100)}% Storage`);
    if (bonusParts.length > 0) {
      parts.push(`<div class="hq-preview-row">📈 <strong>Bonuses:</strong> ${bonusParts.join(', ')}</div>`);
    }

    if (parts.length === 0) return '';
    return `<div class="hq-preview"><div class="hq-preview-title">🔓 HQ Lv.${nextLv} Unlocks:</div>${parts.join('')}</div>`;
  }

  // ─────────────────────────────────────────────
  // Speed-Up Picker (shared pattern)
  // ─────────────────────────────────────────────

  _openSpeedupPicker(anchorEl, queueType, secsLeft) {
    // Remove any existing picker
    document.querySelector('.speedup-picker')?.remove();

    const inventory = this._s.inventory;
    if (!inventory) return;

    const owned = inventory.getOwnedItems().filter(i =>
      i.type === 'speed_boost' && (i.target === queueType || i.target === 'any')
    );

    const picker = document.createElement('div');
    picker.className = 'speedup-picker';

    if (owned.length === 0) {
      picker.innerHTML = `
        <div class="speedup-picker-empty">
          <span>No speedups available.</span>
          <button class="btn btn-xs btn-primary speedup-goto-shop">🛒 Buy from Shop</button>
        </div>`;
      picker.querySelector('.speedup-goto-shop')?.addEventListener('click', () => {
        picker.remove();
        eventBus.emit('ui:navigateTo', 'shop');
      });
    } else {
      // Find recommended: smallest skipSeconds that covers remaining time, or largest available
      const sorted = [...owned].sort((a, b) => a.skipSeconds - b.skipSeconds);
      const recommended = sorted.find(i => i.skipSeconds >= secsLeft) ?? sorted[sorted.length - 1];

      picker.innerHTML = `
        <div class="speedup-picker-title">⏩ Speed Up</div>
        ${sorted.map(item => {
          const isRec = item.id === recommended.id;
          const label = item.skipSeconds >= 999999 ? 'Instant'
            : item.skipSeconds >= 3600 ? `${Math.round(item.skipSeconds / 3600)}h`
            : `${Math.round(item.skipSeconds / 60)}m`;
          const typeTag = item.target === 'any' ? ' (Universal)' : '';
          return `
            <button class="speedup-option${isRec ? ' speedup-recommended' : ''}" data-item="${item.id}">
              <span class="speedup-option-icon">${item.icon}</span>
              <span class="speedup-option-label">${label}${typeTag}</span>
              <span class="speedup-option-qty">×${item.quantity}</span>
              ${isRec ? '<span class="speedup-rec-badge">⭐ Best</span>' : ''}
            </button>`;
        }).join('')}`;

      picker.querySelectorAll('.speedup-option').forEach(btn => {
        btn.addEventListener('click', () => {
          const itemId = btn.dataset.item;
          const r = inventory.useItem(itemId, { queueType });
          picker.remove();
          if (!r.success) {
            this._s.notifications?.show('warning', 'Cannot Speed Up', r.reason);
          } else {
            const remaining = r.completed ? 'Done!' : `${Math.ceil((r.remaining ?? 0) / 1000)}s left`;
            this._s.notifications?.show('success', '⏩ Sped Up!', remaining);
          }
        });
      });
    }

    // Close on outside click
    const closeHandler = (e) => {
      if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('pointerdown', closeHandler, true); }
    };
    setTimeout(() => document.addEventListener('pointerdown', closeHandler, true), 0);

    anchorEl.style.position = 'relative';
    anchorEl.appendChild(picker);
  }
}

