/**
 * ui/world/PoiDetailPanel.js
 * Slide-up detail panel for a selected POI. Pure presenter — reads a view-model
 * passed by WorldMapUI and emits intents through callbacks. One UI surface.
 */
import { fmt } from '../uiUtils.js';

export class PoiDetailPanel {
  constructor(host, { onAction, onClose }) {
    this._host = host;
    this._onAction = onAction ?? (() => {});
    this._onClose = onClose ?? (() => {});
  }

  init() {
    const $ = (s) => this._host.querySelector(s);
    this._el = $('#world-poi-panel');
    this._icon = $('#wp-icon');
    this._name = $('#wp-name');
    this._sub = $('#wp-sub');
    this._body = $('#wp-body');
    this._actions = $('#wp-actions');
    $('#wp-close')?.addEventListener('click', () => this._onClose());
  }

  /** @param {object} vm { poi, region, owned, state, marchType, slotsFree, locked, lockReason } */
  open(vm) {
    if (!this._el) return;
    const { poi, region, owned, state, marchType, slotsFree, locked, lockReason } = vm;
    this._icon.textContent = poi.icon ?? '•';
    this._name.textContent = poi.name;
    this._sub.textContent = `${region?.name ?? ''}${owned ? ' · Yours' : ''}`;

    this._body.innerHTML = this._bodyHtml(poi, state);
    this._actions.innerHTML = '';

    if (poi.type === 'city') { this._show(); return; }

    const btn = document.createElement('button');
    if (marchType === 'gather') { btn.className = 'wp-gather'; btn.textContent = 'Gather'; }
    else { btn.className = 'wp-attack'; btn.textContent = 'Attack'; }

    const blocked = locked ? (lockReason ?? 'Locked') :
      (slotsFree <= 0 ? 'No march slots free' :
      (marchType === 'attack' && state?.respawnAt ? 'Cleared — respawning' : null));
    if (blocked) { btn.disabled = true; btn.title = blocked; }
    btn.addEventListener('click', () => this._onAction(poi.id, marchType));
    this._actions.appendChild(btn);
    this._show();
  }

  _bodyHtml(poi, state) {
    if (poi.type === 'resource_node') {
      const rem = Math.floor(state?.remaining ?? 0);
      return `<div class="world-panel__row"><span>Yields</span><b>${poi.resource}</b></div>
              <div class="world-panel__row"><span>Available</span><b>${fmt(rem)} / ${fmt(poi.capacity)}</b></div>
              <div class="world-panel__row"><span>Gather rate</span><b>${poi.gatherRate}/s</b></div>`;
    }
    if (poi.type === 'camp' || poi.type === 'stronghold') {
      const kind = poi.type === 'stronghold' ? 'Stronghold — capture to claim the region' : 'Enemy camp';
      const status = state?.respawnAt ? 'Cleared (respawning)' : 'Hostile';
      return `<div class="world-panel__row"><span>Type</span><b>${kind}</b></div>
              <div class="world-panel__row"><span>Status</span><b>${status}</b></div>`;
    }
    return '<div class="world-panel__row"><span>Your home city</span></div>';
  }

  _show() { this._el.classList.remove('hidden'); }
  close() { this._el?.classList.add('hidden'); }
}
