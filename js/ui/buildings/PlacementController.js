/**
 * PlacementController.js
 * Relocate mode for the isometric base map: highlights free same-zone plots,
 * tracks the building being moved, and commits the move via BuildingManager.
 *
 * Extracted from BuildingsUI. Coordinates the city renderer (candidate
 * highlighting), the tile tooltip, and the detail panel (closed on entry) — all
 * supplied by the host.
 */
import { eventBus }     from '../../core/EventBus.js';
import { plotsInZone }  from '../../entities/GAME_DATA.js';

export class PlacementController {
  /** @param {{ bm, notifications, getCity:()=>any, tooltip, closePanel:()=>void }} deps */
  constructor({ bm, notifications, getCity, tooltip, closePanel }) {
    this._bm            = bm;
    this._notifications = notifications;
    this._getCity       = getCity;      // () => CityRenderer | null
    this._tooltip       = tooltip;
    this._closePanel    = closePanel;   // () => void
    this._instanceId    = null;
  }

  get isRelocating() { return this._instanceId !== null; }

  enterRelocateMode(instanceId, zone) {
    const bm = this._bm;
    const free = plotsInZone(zone)
      .filter(p => !p.fixed && !bm.getInstanceAt(p.id))
      .map(p => p.id);
    if (!free.length) {
      this._notifications?.show('warning', 'Cannot Move', `No free ${zone} plots available.`);
      return;
    }
    this._instanceId = instanceId;
    this._getCity()?.setRelocateCandidates(free);
    this._closePanel();
    this._tooltip.hide(true);
    this._notifications?.show('info', 'Relocate', 'Tap a highlighted plot to move the building. Esc cancels.');
  }

  exitRelocateMode() {
    if (!this._instanceId) return;
    this._instanceId = null;
    this._getCity()?.setRelocateCandidates(null);
  }

  tryRelocate(plotId) {
    const r = this._bm.relocate(this._instanceId, plotId);
    if (!r.success) {
      eventBus.emit('ui:error');
      this._notifications?.show('warning', 'Cannot Move', r.reason);
      return;
    }
    this.exitRelocateMode();
  }
}
