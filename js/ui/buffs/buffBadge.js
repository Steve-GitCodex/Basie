import { eventBus } from '../../core/EventBus.js';
import { collect, timedEntries } from '../../systems/buffs/buffLedger.js';
import { buildSnapshot } from './buffSnapshot.js';
import { formatRemaining } from './buffText.js';
import { subscribeBuffRefresh } from './buffEvents.js';

const WARN_BELOW_MS = 300000;

export class BuffBadge {
  constructor(systems) {
    this._s = systems;
    this._timed = [];
    this._label = '';
    this._state = '';
    this._ring = '';
  }

  init() {
    this._el = document.getElementById('buff-hud-badge');
    this._labelEl = document.getElementById('buff-badge-label');
    if (!this._el || !this._labelEl) return;
    this._el.addEventListener('click', () => {
      eventBus.emit('ui:click');
      eventBus.emit('ui:openBuffs');
    });
    subscribeBuffRefresh(this._s, () => this._recompute(), ['world:buffExpired']);
    eventBus.on('tick:ui', () => this._paint());
    this._recompute();
  }

  _recompute() {
    this._timed = timedEntries(collect(buildSnapshot(this._s)));
    this._paint();
  }

  _paint() {
    if (!this._el) return;
    const now = Date.now();
    const live = this._timed.filter(e => e.endsAt > now);
    const shortest = live[0];
    const state = !shortest ? 'idle' : shortest.endsAt - now < WARN_BELOW_MS ? 'warn' : 'active';
    const label = shortest ? `${live.length} · ${formatRemaining(shortest.endsAt - now)}` : 'Buffs';
    const ring = shortest ? `${(this._ringFraction(shortest, now) * 100).toFixed(1)}%` : '0%';
    if (state !== this._state) {
      this._el.classList.remove('buff-hud-badge--idle', 'buff-hud-badge--active', 'buff-hud-badge--warn');
      this._el.classList.add(`buff-hud-badge--${state}`);
      this._state = state;
    }
    if (label !== this._label) {
      this._labelEl.textContent = label;
      this._label = label;
    }
    if (ring !== this._ring) {
      this._el.style.setProperty('--ring', ring);
      this._ring = ring;
    }
  }

  _ringFraction(entry, now) {
    const total = entry.startedAt != null ? entry.endsAt - entry.startedAt : 0;
    if (total <= 0) return 1;
    return Math.max(0, Math.min(1, (entry.endsAt - now) / total));
  }
}
