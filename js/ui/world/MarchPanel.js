/**
 * ui/world/MarchPanel.js
 * Top-right list of active marches with phase + progress. One UI surface;
 * read-only. Refreshed by WorldMapUI on march events and a 1s ticker.
 */
import { icon } from '../icons.js';

const PHASE_LABEL = { outbound: 'Marching', acting: 'On site', returning: 'Returning' };

export class MarchPanel {
  constructor(host, { poiName }) {
    this._host = host;
    this._poiName = poiName ?? ((id) => id);
  }

  init() {
    this._el = this._host.querySelector('#world-march-panel');
    this._list = this._host.querySelector('#wm-list');
  }

  render(marches) {
    if (!this._el) return;
    if (!marches.length) {
      this._el.classList.remove('hidden');
      this._list.innerHTML = '<div class="world-marches__empty">No active marches</div>';
      return;
    }
    this._el.classList.remove('hidden');
    const now = Date.now();
    this._list.innerHTML = marches.map(m => this._item(m, now)).join('');
  }

  _item(m, now) {
    const name = this._poiName(m.targetPoiId);
    const { pct, eta } = this._progress(m, now);
    const fillCls = m.type === 'attack' ? 'wm-bar__fill wm-bar__fill--attack' : 'wm-bar__fill';
    return `<div class="wm-item">
      <div class="wm-item__top"><span>${m.type === 'attack' ? icon('sword') : icon('gather')} ${name}</span>
        <span class="wm-item__phase">${PHASE_LABEL[m.phase] ?? m.phase}</span></div>
      <div class="wm-bar"><div class="${fillCls}" style="width:${Math.round(pct * 100)}%"></div></div>
      ${eta != null ? `<div class="wm-item__phase">${this._fmt(eta)}</div>` : ''}
    </div>`;
  }

  _progress(m, now) {
    if (m.phase === 'outbound') return { pct: this._c((now - m.departAt) / (m.arriveAt - m.departAt)), eta: m.arriveAt - now };
    if (m.phase === 'acting')   return { pct: this._c((now - m.arriveAt) / (m.actUntil - m.arriveAt)), eta: m.actUntil - now };
    if (m.phase === 'returning') return { pct: this._c((now - m.actUntil) / (m.returnAt - m.actUntil)), eta: m.returnAt - now };
    return { pct: 0, eta: null };
  }

  _c(v) { return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0; }
  _fmt(ms) { const s = Math.round(Math.max(0, ms) / 1000); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; }
}
