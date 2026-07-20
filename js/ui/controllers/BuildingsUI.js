/**
 * BuildingsUI.js
 * Renders the Base tab: build queue strip + grouped building category sections.
 *
 * UI sections:
 *  1. Build queue strip  (#build-queue-panel) — full-width, horizontal
 *  2. Grouped buildings  (#buildings-container) — per-category sections with multi-instance cards
 */
import { eventBus }          from '../../core/EventBus.js';
import { CityRenderer }      from '../city/CityRenderer.js';
import { TileTooltip }       from '../city/TileTooltip.js';
import { BuildingCards }     from '../buildings/BuildingCards.js';
import { BuildQueueSidebar } from '../buildings/BuildQueueSidebar.js';
import { openSpeedupPicker }  from '../buildings/SpeedupPicker.js';
import { BuildablesPanel }     from '../buildings/BuildablesPanel.js';
import { BuildingInfoPanel }   from '../buildings/BuildingInfoPanel.js';

/** How long the build-queue sidebar stays open after auto-opening on activity. */
const SIDEBAR_AUTO_CLOSE_MS = 10000;

export class BuildingsUI {
  /** @param {{ rm, bm, notifications, heroes }} systems */
  constructor(systems) {
    this._s = systems;
    this._tooltip = new TileTooltip({
      bm:            systems.bm,
      rm:            systems.rm,
      notifications: systems.notifications,
      getCity:       () => this._city,
      requestRender: () => this.render(),
    });
    this._cards = new BuildingCards({
      bm:            systems.bm,
      rm:            systems.rm,
      heroes:        systems.heroes,
      notifications: systems.notifications,
      requestRender: () => this.render(),
    });
    this._sidebar = new BuildQueueSidebar({
      bm:            systems.bm,
      tm:            systems.tm,
      um:            systems.um,
      inventory:     systems.inventory,
      notifications: systems.notifications,
    });
    this._buildables = new BuildablesPanel({ bm: systems.bm, rm: systems.rm });
    this._info = new BuildingInfoPanel({ bm: systems.bm });
  }

  render() {
    this._renderBaseGrid();
    this._sidebar.render();
    this._cards.render();
  }

  init() {
    this._unsubs = [];

    // Isometric city renderer (canvas) for the base view
    const cityHost = document.getElementById('base-grid');
    if (cityHost) {
      this._city = new CityRenderer({
        bm:   this._s.bm,
        host: cityHost,
        // Click a building → summary tooltip + anchored action buttons (the old
        // slide-up panel is retired). Hover only highlights (handled by the renderer).
        onTileClick: (bid, idx) => {
          eventBus.emit('ui:click');
          const rect = this._city?.getTileScreenRect(bid, idx);
          if (rect) this._tooltip.showTile(bid, idx, rect);
        },
        onTileHover: () => {},
        onTileLeave: () => {},
        // Tap the ⏩ badge on a building under construction → speed-up picker, anchored
        // at the badge (the active build is always queue slot 0).
        onSpeedupClick: (bid, idx, badgeRect) => {
          eventBus.emit('ui:click');
          this._tooltip.hide(true);
          this._openBuildingSpeedup(badgeRect);
        },
        // Move-placement ghost committed a new footprint.
        onGhostCommit: (instanceId, cx, cy) => {
          const r = this._s.bm.moveBuilding(instanceId, cx, cy);
          if (!r.success) { eventBus.emit('ui:error'); this._s.notifications?.show('warning', 'Cannot Move', r.reason); }
        },
        onEmptyClick: () => {
          this._tooltip.hide(true);
          this._city?.cancelGhost();
        },
        // Tap a rubble sector → clear panel pinned open (cost/time/HQ gate/Clear Rubble).
        onSectorClick: (sectorId, rect) => {
          eventBus.emit('ui:click');
          if (rect) this._tooltip.showSector(sectorId, rect, { pinned: true });
        },
        // Hover only surfaces a sector that is actively clearing (countdown ticks in
        // place); idle rubble reveals its panel on tap alone. Never steals a pinned one.
        onSectorHover: (sectorId, rect) => {
          if (!rect || this._tooltip.isSectorPinned()) return;
          if (!this._s.bm.getSectors?.().find(s => s.id === sectorId)?.clearing) return;
          this._tooltip.showSector(sectorId, rect, { pinned: false });
        },
        onSectorLeave: () => {
          if (!this._tooltip.isSectorPinned()) this._tooltip.hide();
        },
      });
      this._city.init();

      // Re-center button
      document.getElementById('city-home-btn')?.addEventListener('click', () => {
        eventBus.emit('ui:click');
        this._city?.home();
      });
    }

    // Hide tooltip on click outside the grid
    document.addEventListener('click', e => {
      if (!e.target.closest('#base-grid') && !e.target.closest('#tile-tooltip')) {
        this._tooltip.hide(true);
      }
    });

    // Keep tooltip visible when mouse re-enters it
    this._tooltip.mount();
    this._info.init();
    this._buildables.init();

    // Buildables panel intents — the packer seats the instance, then it builds.
    this._unsubs.push(eventBus.on('ui:placeBuilding', ({ buildingId } = {}) => {
      if (!buildingId) return;
      const r = this._s.bm.buildNext(buildingId);
      if (!r.success) { eventBus.emit('ui:error'); this._s.notifications?.show('warning', 'Cannot Build', r.reason); }
    }));
    this._unsubs.push(eventBus.on('ui:relocateBuilding', ({ instanceId } = {}) => {
      if (!instanceId) return;
      eventBus.emit('ui:navigateTo', 'base');
      this._city?.enterGhostMode(instanceId);
    }));

    // A migrated base wakes up already clustered — tell the player why output jumped.
    this._unsubs.push(eventBus.on('building:adjacencyDiscovered', ({ total } = {}) => {
      this._s.notifications?.show('success', 'Layout Bonus',
        `Your base layout grants +${Math.round((total ?? 0) * 100)}% total production from neighbouring buildings.`);
    }));

    // Rubble-sector clear intent + state changes (ADR 0022, Phase B).
    this._unsubs.push(eventBus.on('ui:clearSector', ({ sectorId } = {}) => {
      if (!sectorId) return;
      const r = this._s.bm.clearSector(sectorId);
      if (!r.success) { eventBus.emit('ui:error'); this._s.notifications?.show('warning', 'Cannot Clear', r.reason); }
    }));
    this._unsubs.push(eventBus.on('city:sectorsChanged', () => { this._city?.syncState(); this._tooltip.refreshSector(); }));
    // A completed clear auto-closes any tooltip still open on that sector (it is no
    // longer a rubble sector to act on); other open sector panels just refresh.
    this._unsubs.push(eventBus.on('city:sectorCleared', ({ id } = {}) => {
      this._city?.syncState();
      if (id) this._tooltip.closeSector(id);
      this._tooltip.refreshSector();
    }));

    // Build queue sidebar toggle (manual interaction cancels any pending auto-close)
    document.getElementById('bq-toggle')?.addEventListener('click', () => {
      this._cancelSidebarAutoClose();
      document.getElementById('bq-sidebar')?.classList.toggle('is-collapsed');
    });

    this._unsubs.push(eventBus.on('ui:viewChanged',             v => {
      if (v === 'base') {
        this.render(); this._city?.start(); this._city?.homeIfUntouched();
        if (typeof window !== 'undefined' && window.game) window.game.city = this._city; // debug/automation surface
      } else            { this._city?.stop(); }
    }));
    this._unsubs.push(eventBus.on('building:completed',         () => { this.render(); this._tooltip.refresh(); }));
    this._unsubs.push(eventBus.on('building:started',           () => {
      this.render();
      this._tooltip.refresh();
      this._autoOpenSidebar();
    }));
    this._unsubs.push(eventBus.on('building:queueUpdated',      () => { this.render(); this._tooltip.refresh(); }));
    this._unsubs.push(eventBus.on('building:automationEnabled', () => this.render()));
    this._unsubs.push(eventBus.on('tech:researched',            () => this.render()));
    this._unsubs.push(eventBus.on('tech:queueUpdated',          () => {
      this._sidebar.render();
      this._autoOpenSidebar();
    }));
    this._unsubs.push(eventBus.on('unit:queueUpdated',          () => {
      this._sidebar.render();
      this._autoOpenSidebar();
    }));
    this._unsubs.push(eventBus.on('heroes:updated',             () => this.render()));
    // Resources changing every tick must NOT rebuild the tooltip / sidebar / cards.
    // Live progress bars are animated in place by TimerService; here we only patch the
    // open tooltip's cost-chip affordability + upgrade button in place (throttled).
    // (`buildings:rendered`, for the tutorial spotlight ring, is emitted continuously by
    // CityRenderer's render loop, so it no longer needs a timer here.)
    this._tickThrottle = 0;
    this._unsubs.push(eventBus.on('resources:tick', () => {
      const now = Date.now();
      if (now - this._tickThrottle < 1000) return;
      this._tickThrottle = now;
      this._tooltip.patchAffordability();
      this._tooltip.patchSector();
    }));
    // Tutorial: center the camera on the focused building; the spotlight rings
    // its tile and the player taps it to open the click-popup (with Build/Upgrade).
    this._unsubs.push(eventBus.on('buildings:focusBuilding', id => {
      this._city?.centerOnTile(id, 0, true);
    }));

    // Leaving the base view cancels any in-progress move placement
    this._unsubs.push(eventBus.on('ui:viewChanged', v => {
      if (v !== 'base') this._city?.cancelGhost();
    }));
    this._unsubs.push(eventBus.on('building:relocated', () => this.render()));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this._city?.cancelGhost();
    });
  }

  destroy() {
    this._unsubs?.forEach(fn => fn());
    this._unsubs = [];
    this._cancelSidebarAutoClose();
    this._city?.destroy();
    this._city = null;
  }

  // ─────────────────────────────────────────────
  // Build queue sidebar auto open/close
  // ─────────────────────────────────────────────

  /** Open the build-queue sidebar on activity, then auto-collapse after a delay. */
  _autoOpenSidebar() {
    const el = document.getElementById('bq-sidebar');
    if (!el) return;
    el.classList.remove('is-collapsed');
    // Don't extend an already-pending auto-close: queue events (training/research
    // ticks) fire repeatedly, and resetting the timer each time would keep the
    // panel open indefinitely. Schedule once; the close fires on time.
    if (this._sidebarAutoCloseTimer) return;
    this._sidebarAutoCloseTimer = setTimeout(() => {
      document.getElementById('bq-sidebar')?.classList.add('is-collapsed');
      this._sidebarAutoCloseTimer = null;
    }, SIDEBAR_AUTO_CLOSE_MS);
  }

  _cancelSidebarAutoClose() {
    if (this._sidebarAutoCloseTimer) {
      clearTimeout(this._sidebarAutoCloseTimer);
      this._sidebarAutoCloseTimer = null;
    }
  }

  // ─────────────────────────────────────────────
  // Base Grid (isometric city map — canvas)
  // ─────────────────────────────────────────────

  _renderBaseGrid() {
    this._city?.syncState();
  }

  /** Open the shared speed-up picker for the active build, anchored at the tapped badge. */
  _openBuildingSpeedup(anchorRect) {
    if (!anchorRect) return;
    const active   = this._s.bm.getBuildQueue?.()[0];
    const secsLeft = active?.endsAt ? Math.max(0, Math.ceil((active.endsAt - Date.now()) / 1000)) : 0;
    openSpeedupPicker({
      anchorRect,
      queueType:        'building',
      secsLeft,
      targetInstanceId: active?.instanceId ?? null,
      inventory:        this._s.inventory,
      notifications:    this._s.notifications,
    });
  }
}

