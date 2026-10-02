// @see docs/20-decisions/0032-dev-dashboard-and-slots.md
import { eventBus } from '../../core/EventBus.js';
import { listDevSlots, deleteDevSlot, sanitizeSlotName } from '../../core/devSlots.js';
import { DevLevelSwitcher } from './DevLevelSwitcher.js';
import { DevPopupMuter } from './DevPopupMuter.js';
import { DevAnchorNudger } from './DevAnchorNudger.js';
import { DevSpriteSource } from './DevSpriteSource.js';

const OPEN_KEY = 'basie_dev_dashboard_open';
const HOTKEY = '`';
const NEW_SLOT = '__new';

export class DevDashboard {
  init({ slot, saveManager, getGameState, buildingManager }) {
    this._slot = slot;
    this._sm = saveManager;
    this._getState = getGameState;

    this._toggleBtn = this._buildToggle();
    this._panel = this._buildPanel();
    document.body.append(this._toggleBtn, this._panel);
    this._status = this._panel.querySelector('[data-dev-save-status]');
    this._slotSelect = this._panel.querySelector('[data-dev-slot-select]');

    this._wireSession();
    this._mountTools(this._panel.querySelector('[data-dev-tools]'), buildingManager);

    this._toggleBtn.addEventListener('click', () => this._setOpen(!this._open));
    document.addEventListener('keydown', (e) => this._onKey(e));
    this._setOpen(this._readOpen());
  }

  _buildToggle() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dev-dashboard__toggle';
    btn.title = `Dev dashboard (${HOTKEY})`;
    btn.textContent = '🛠';
    return btn;
  }

  _buildPanel() {
    const el = document.createElement('div');
    el.className = 'dev-dashboard';
    el.innerHTML = `
      <details class="dev-dashboard__section" open>
        <summary>Session — slot <code>${this._slot}</code></summary>
        <div class="dev-dashboard__row">
          <select data-dev-slot-select></select>
          <button type="button" data-dev-save>Save now</button>
          <button type="button" data-dev-reset>Reset slot</button>
        </div>
        <div class="dev-dashboard__status" data-dev-save-status>not saved yet</div>
      </details>
      <details class="dev-dashboard__section" open>
        <summary>Tools</summary>
        <div class="dev-dashboard__tools" data-dev-tools></div>
      </details>
    `;
    return el;
  }

  _wireSession() {
    this._populateSlots();
    this._slotSelect.addEventListener('change', () => this._onSlotChange());
    this._panel.querySelector('[data-dev-save]').addEventListener('click', () => this._sm.save(this._getState()));
    this._panel.querySelector('[data-dev-reset]').addEventListener('click', () => this._resetSlot());
    const showSaved = (timestamp) => {
      this._status.textContent = `saved ${new Date(timestamp).toLocaleTimeString()}`;
    };
    const last = this._sm.getLocalRawSave()?.lastSavedTimestamp;
    if (last) showSaved(last);
    eventBus.on('game:saved', ({ timestamp }) => showSaved(timestamp));
  }

  _populateSlots() {
    const slots = [...new Set([...listDevSlots(localStorage), this._slot])].sort();
    this._slotSelect.innerHTML = slots
      .map(s => `<option value="${s}" ${s === this._slot ? 'selected' : ''}>${s}</option>`)
      .join('') + `<option value="${NEW_SLOT}">+ New slot…</option>`;
  }

  _onSlotChange() {
    let target = this._slotSelect.value;
    if (target === NEW_SLOT) {
      const name = prompt('New dev slot name');
      if (!name) { this._slotSelect.value = this._slot; return; }
      target = sanitizeSlotName(name);
    }
    if (target !== this._slot) location.search = `?dev=${encodeURIComponent(target)}`;
  }

  _resetSlot() {
    if (!confirm(`Reset dev slot "${this._slot}"? Its save is deleted and the preset re-runs.`)) return;
    this._sm.suppressSaves();
    deleteDevSlot(localStorage, this._slot);
    location.reload();
  }

  _mountTools(mount, buildingManager) {
    new DevLevelSwitcher().init(buildingManager, mount);
    new DevPopupMuter().init(mount);
    new DevAnchorNudger().init(mount);
    new DevSpriteSource().init(mount);
  }

  _onKey(e) {
    if (e.key !== HOTKEY || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    this._setOpen(!this._open);
  }

  _setOpen(open) {
    this._open = open;
    this._panel.hidden = !open;
    this._toggleBtn.classList.toggle('dev-dashboard__toggle--active', open);
    try { localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch { /* storage blocked */ }
  }

  _readOpen() {
    try { return localStorage.getItem(OPEN_KEY) !== '0'; } catch { return true; }
  }
}
