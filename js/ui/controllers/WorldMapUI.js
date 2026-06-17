/**
 * ui/controllers/WorldMapUI.js
 * Thin presenter for the world map (#view-world). Owns the WorldRenderer and the
 * three UI surfaces (PoiDetailPanel / MarchDispatchSheet / MarchPanel); routes
 * intents to MarchManager and re-renders from world/march events.
 *
 * Renderer is initialised lazily on first activation (the canvas has no size
 * while the view is display:none).
 */
import { eventBus } from '../../core/EventBus.js';
import { WORLD_MAP } from '../../entities/GAME_DATA.js';
import { marchTypeForPOI } from '../../systems/march/marchRules.js';
import { WorldRenderer } from '../world/WorldRenderer.js';
import { PoiDetailPanel } from '../world/PoiDetailPanel.js';
import { MarchDispatchSheet } from '../world/MarchDispatchSheet.js';
import { MarchPanel } from '../world/MarchPanel.js';

export class WorldMapUI {
  constructor({ worldMap, march, um, notifications }) {
    this._wm = worldMap;
    this._mm = march;
    this._um = um;
    this._notify = notifications;
    this._active = false;
    this._ticker = null;
  }

  init() {
    this._host = document.querySelector('#view-world');
    if (!this._host) return;

    this._renderer = new WorldRenderer({
      wm: this._wm, mm: this._mm, host: this._host,
      onPoiClick: (id) => this._selectPoi(id),
      onPoiHover: () => {},
      onEmptyClick: () => this._closePanels(),
    });

    this._poiPanel = new PoiDetailPanel(this._host, {
      onAction: (poiId, type) => this._openDispatch(poiId, type),
      onClose: () => this._closePanels(),
    });
    this._sheet = new MarchDispatchSheet(this._host, {
      onDispatch: (type, poiId, squadId) => this._dispatch(type, poiId, squadId),
      onClose: () => this._sheet.close(),
      previewFn: (poiId, squadId) => this._mm.previewMarch(poiId, squadId),
    });
    this._marchPanel = new MarchPanel(this._host, {
      poiName: (id) => this._wm.getPOI(id)?.name ?? id,
    });
    this._poiPanel.init();
    this._sheet.init();
    this._marchPanel.init();
    this._renderLegend();

    this._host.querySelector('#world-home-btn')?.addEventListener('click', () => this._renderer.home());

    // View lifecycle
    eventBus.on('ui:viewChanged', (v) => (v === 'world' ? this._onEnter() : this._onLeave()));

    // Reactive re-renders
    const refresh = () => { this._renderer?.syncState(); this._renderMarchPanel(); };
    eventBus.on('march:dispatched', refresh);
    eventBus.on('march:arrived', (m) => { this._announceArrival(m); refresh(); this._refreshOpenPanel(); });
    eventBus.on('march:returning', refresh);
    eventBus.on('march:completed', (m) => { this._announceComplete(m); refresh(); this._refreshOpenPanel(); });
    eventBus.on('world:poiChanged', () => { this._renderer?.syncState(); this._refreshOpenPanel(); });
    eventBus.on('world:regionCaptured', (d) => {
      this._notify?.show?.('success', '🚩 Region captured', this._wm.getRegion(d.regionId)?.name ?? '');
      this._renderer?.syncState();
      this._renderLegend();
    });
  }

  /** Territory legend: "My Territory" + each enemy faction (✓ when fully cleared). */
  _renderLegend() {
    const list = this._host?.querySelector('#world-legend-list');
    if (!list) return;
    const swatch = (c) => `<span class="world-legend__swatch" style="color:${c};background:${c}"></span>`;
    const rows = [`<div class="world-legend__row world-legend__row--owned">${swatch('#3ad17a')}My Territory</div>`];
    for (const f of Object.values(WORLD_MAP.factions)) {
      if (f.id === 'neutral') continue;
      const regions = WORLD_MAP.regions.filter(r => r.factionId === f.id);
      const cleared = regions.length > 0 && regions.every(r => this._wm.isPlayerOwned(r.id));
      rows.push(`<div class="world-legend__row">${swatch(f.color)}${f.name}${cleared ? ' ✓' : ''}</div>`);
    }
    list.innerHTML = rows.join('');
  }

  // ── View lifecycle ──────────────────────────────────────────────────────────
  _onEnter() {
    this._active = true;
    if (!this._renderer.ready) this._renderer.init();
    else this._renderer.start();
    this._renderer.syncState();
    this._renderMarchPanel();
    this._ticker = setInterval(() => { if (this._active) this._renderMarchPanel(); }, 1000);
  }

  _onLeave() {
    this._active = false;
    this._renderer?.stop();
    this._closePanels();
    if (this._ticker) { clearInterval(this._ticker); this._ticker = null; }
  }

  // ── Intents ──────────────────────────────────────────────────────────────────
  _selectPoi(poiId) {
    const poi = this._wm.getPOI(poiId);
    if (!poi) return;
    this._sheet.close();
    this._selectedPoiId = poiId;
    this._renderer.setSelected(poiId);
    this._poiPanel.open(this._poiVm(poi));
  }

  _openDispatch(poiId, type) {
    const poi = this._wm.getPOI(poiId);
    if (!poi) return;
    this._poiPanel.close();
    const squads = this._um.getSquads?.() ?? [];
    this._sheet.open(poi, type, squads);
  }

  _dispatch(type, poiId, squadId) {
    const res = this._mm.dispatch({ type, targetPoiId: poiId, squadId });
    if (res.success) {
      this._sheet.close();
      this._notify?.show?.('info', '🚶 March dispatched', this._wm.getPOI(poiId)?.name ?? '');
      this._renderMarchPanel();
    } else {
      this._notify?.show?.('warning', 'Cannot march', res.reason ?? '');
    }
  }

  _closePanels() {
    this._poiPanel?.close();
    this._sheet?.close();
    this._selectedPoiId = null;
    this._renderer?.setSelected(null);
  }

  // ── View-models / helpers ────────────────────────────────────────────────────
  _poiVm(poi) {
    const lock = this._wm.regionLock(poi.regionId);
    let lockReason = null;
    if (lock.locked) {
      const names = lock.missing.map(id => this._wm.getRegion(id)?.name ?? id);
      lockReason = `Locked — capture ${names.join(', ')} first`;
    }
    return {
      poi,
      region: this._wm.getRegion(poi.regionId),
      owned: this._wm.isPlayerOwned(poi.regionId),
      state: this._wm.getPOIState(poi.id),
      marchType: marchTypeForPOI(poi),
      slotsFree: this._mm.slotsFree(),
      locked: lock.locked,
      lockReason,
    };
  }

  _refreshOpenPanel() {
    if (this._selectedPoiId) {
      const poi = this._wm.getPOI(this._selectedPoiId);
      if (poi) this._poiPanel.open(this._poiVm(poi));
    }
  }

  _renderMarchPanel() { this._marchPanel.render(this._mm.activeMarches()); }

  _announceArrival(m) {
    if (m.outcome === 'victory') this._notify?.show?.('success', '⚔️ Victory', this._wm.getPOI(m.targetPoiId)?.name ?? '');
    else if (m.outcome === 'defeat') this._notify?.show?.('warning', '💀 Defeat', this._wm.getPOI(m.targetPoiId)?.name ?? '');
  }

  _announceComplete(m) {
    const got = Object.entries(m.payload ?? {}).map(([k, v]) => `${v} ${k}`).join(', ');
    if (got) this._notify?.show?.('success', '🎁 Army returned', got);
  }
}
