/**
 * PlacementController.js
 * Placement mode for the isometric base map: highlights free same-zone plots and
 * commits either a relocate (move an existing building) or a new build (place a
 * catalog item) via BuildingManager.
 *
 * Extracted from BuildingsUI. Coordinates the city renderer (candidate
 * highlighting) and the tile tooltip — supplied by the host.
 */
import { eventBus }     from '../../core/EventBus.js';
import { plotsInZone }  from '../../entities/GAME_DATA.js';

export class PlacementController {
  /** @param {{ bm, notifications, getCity:()=>any, tooltip }} deps */
  constructor({ bm, notifications, getCity, tooltip }) {
    this._bm            = bm;
    this._notifications = notifications;
    this._getCity       = getCity;      // () => CityRenderer | null
    this._tooltip       = tooltip;
    this._instanceId    = null;         // set in relocate mode
    this._buildId       = null;         // set in build (place-new) mode
  }

  /** True while any placement mode (relocate or build) is active. */
  get isRelocating() { return this._instanceId !== null || this._buildId !== null; }

  /** Highlight free plots in `zone`; returns the free plot ids (or null if none). */
  _highlightFree(zone, label) {
    const free = plotsInZone(zone)
      .filter(p => !p.fixed && !this._bm.getInstanceAt(p.id))
      .map(p => p.id);
    if (!free.length) {
      this._notifications?.show('warning', label, `No free ${zone} plots available.`);
      return null;
    }
    this._getCity()?.setRelocateCandidates(free);
    this._tooltip.hide(true);
    return free;
  }

  enterRelocateMode(instanceId, zone) {
    if (!this._highlightFree(zone, 'Cannot Move')) return;
    this._instanceId = instanceId;
    this._notifications?.show('info', 'Relocate', 'Tap a highlighted plot to move the building. Esc cancels.');
  }

  /** Place a new building from the catalog: highlight free zone plots, tap to build. */
  enterBuildMode(buildingId) {
    const zone = this._bm.zoneOfBuilding(buildingId);
    if (!this._highlightFree(zone, 'Cannot Build')) return;
    this._buildId = buildingId;
    this._notifications?.show('info', 'Place Building', 'Tap a highlighted plot to build. Esc cancels.');
  }

  exitRelocateMode() {
    if (!this.isRelocating) return;
    this._instanceId = null;
    this._buildId    = null;
    this._getCity()?.setRelocateCandidates(null);
  }

  /** Commit a tapped plot for whichever mode is active. */
  tryRelocate(plotId) {
    if (this._buildId) {
      const r = this._bm.buildOnPlot(this._buildId, plotId);
      if (!r.success) {
        eventBus.emit('ui:error');
        this._notifications?.show('warning', 'Cannot Build', r.reason);
        return;
      }
      this.exitRelocateMode();
      return;
    }
    const r = this._bm.relocate(this._instanceId, plotId);
    if (!r.success) {
      eventBus.emit('ui:error');
      this._notifications?.show('warning', 'Cannot Move', r.reason);
      return;
    }
    this.exitRelocateMode();
  }
}
