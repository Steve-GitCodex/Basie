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
import { BuildingDetailPanel } from '../buildings/BuildingDetailPanel.js';
import { PlacementController } from '../buildings/PlacementController.js';

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
    this._panel = new BuildingDetailPanel({
      bm:            systems.bm,
      rm:            systems.rm,
      notifications: systems.notifications,
      onRelocateRequest: (instId, zone) => this._placement.enterRelocateMode(instId, zone),
    });
    this._placement = new PlacementController({
      bm:            systems.bm,
      notifications: systems.notifications,
      getCity:       () => this._city,
      tooltip:       this._tooltip,
      closePanel:    () => this._panel.close(),
    });
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
        onTileClick: (bid, idx) => {
          eventBus.emit('ui:click');
          this._placement.exitRelocateMode();
          this._panel.openBuilding(bid, idx);
        },
        onTileHover: (bid, idx) => {
          this._tooltip.clearHide();
          const rect = this._city?.getTileScreenRect(bid, idx);
          if (rect) this._tooltip.showTile(bid, idx, rect);
        },
        onTileLeave: () => {
          this._tooltip.scheduleHide();
        },
        onPlotClick: (plotId, zone) => {
          eventBus.emit('ui:click');
          if (this._placement.isRelocating) { this._placement.tryRelocate(plotId); return; }
          this._panel.openBuildSheet(plotId, zone);
        },
        onPlotHover: (plotId, zone) => {
          if (this._placement.isRelocating) return;
          this._tooltip.clearHide();
          const rect = this._city?.getPlotScreenRect(plotId);
          if (rect) this._tooltip.showPlot(plotId, zone, rect);
        },
        onEmptyClick: () => {
          this._tooltip.hide(true);
          this._placement.exitRelocateMode();
          this._panel.close();
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

    // Build queue sidebar toggle
    document.getElementById('bq-toggle')?.addEventListener('click', () => {
      document.getElementById('bq-sidebar')?.classList.toggle('is-collapsed');
    });

    this._unsubs.push(eventBus.on('ui:viewChanged',             v => {
      if (v === 'base') { this.render(); this._city?.start(); }
      else              { this._city?.stop(); }
    }));
    this._unsubs.push(eventBus.on('building:completed',         () => { this.render(); this._tooltip.refresh(); }));
    this._unsubs.push(eventBus.on('building:started',           () => {
      this.render();
      this._tooltip.refresh();
      document.getElementById('bq-sidebar')?.classList.remove('is-collapsed');
    }));
    this._unsubs.push(eventBus.on('building:queueUpdated',      () => { this.render(); this._tooltip.refresh(); }));
    this._unsubs.push(eventBus.on('building:automationEnabled', () => this.render()));
    this._unsubs.push(eventBus.on('tech:researched',            () => this.render()));
    this._unsubs.push(eventBus.on('tech:queueUpdated',          () => {
      this._sidebar.render();
      document.getElementById('bq-sidebar')?.classList.remove('is-collapsed');
    }));
    this._unsubs.push(eventBus.on('unit:queueUpdated',          () => {
      this._sidebar.render();
      document.getElementById('bq-sidebar')?.classList.remove('is-collapsed');
    }));
    this._unsubs.push(eventBus.on('heroes:updated',             () => this.render()));
    this._tickThrottle = 0;
    this._unsubs.push(eventBus.on('resources:tick', () => {
      const now = Date.now();
      if (now - this._tickThrottle >= 2000) {
        this._tickThrottle = now;
        this.render();
        this._tooltip.refresh();
        eventBus.emit('buildings:rendered');
      }
    }));
    // Tutorial: open slide-up panel for the requested building
    this._unsubs.push(eventBus.on('buildings:focusBuilding', id => {
      this._city?.centerOnTile(id, 0, true);
      this._panel.openBuilding(id, 0);
    }));

    // Panel wiring
    document.getElementById('btp-close')?.addEventListener('click', () => this._panel.close());
    document.addEventListener('click', e => {
      if (this._panel.bid !== null &&
          !e.target.closest('#building-detail-panel') &&
          !e.target.closest('#base-grid')) {
        this._panel.close();
      }
    });
    this._unsubs.push(eventBus.on('ui:viewChanged', v => {
      if (v !== 'base') { this._panel.close(); this._placement.exitRelocateMode(); }
    }));
    this._unsubs.push(eventBus.on('building:relocated', () => this.render()));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this._placement.exitRelocateMode();
    });
    this._unsubs.push(eventBus.on('building:completed', () => {
      if (this._panel.bid !== null) this._panel.openBuilding(this._panel.bid, this._panel.idx);
    }));
    this._unsubs.push(eventBus.on('building:queueUpdated', () => {
      if (this._panel.bid !== null) this._panel.openBuilding(this._panel.bid, this._panel.idx);
    }));
    this._unsubs.push(eventBus.on('building:cafeteria:restocked', () => {
      if (this._panel.bid === 'cafeteria') this._panel.openBuilding('cafeteria', this._panel.idx);
    }));
  }

  destroy() {
    this._unsubs?.forEach(fn => fn());
    this._unsubs = [];
    this._city?.destroy();
    this._city = null;
  }

  // ─────────────────────────────────────────────
  // Base Grid (isometric city map — canvas)
  // ─────────────────────────────────────────────

  _renderBaseGrid() {
    this._city?.syncState();
  }
}

