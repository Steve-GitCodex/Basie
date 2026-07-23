/**
 * DevLevelSwitcher.js
 * Dev-only floating widget (`?dev` sessions only): force any already-placed
 * building instance to any level, to eyeball a sprite's per-level anchor/scale
 * in-game without grinding a real upgrade.
 */
import { eventBus } from '../../core/EventBus.js';
import { BUILDINGS_CONFIG } from '../../entities/GAME_DATA.js';

export class DevLevelSwitcher {
  init(buildingManager) {
    this._bm = buildingManager;
    this._el = this._buildEl();
    document.body.appendChild(this._el);
    this._buildingSelect = this._el.querySelector('[data-dev-building]');
    this._levelSelect    = this._el.querySelector('[data-dev-level]');
    this._status         = this._el.querySelector('[data-dev-status]');

    this._populateBuildings();
    this._buildingSelect.addEventListener('change', () => this._populateLevels());
    this._levelSelect.addEventListener('change', () => this._apply());
    this._populateLevels();

    // Clicking a building in the base view snaps this menu to it (shared selection).
    eventBus.on('dev:buildingSelected', ({ buildingId }) => this._selectBuilding(buildingId));
  }

  _selectBuilding(buildingId) {
    if (!buildingId || this._buildingSelect.value === buildingId) return;
    if (![...this._buildingSelect.options].some(o => o.value === buildingId)) return;
    this._buildingSelect.value = buildingId;
    this._populateLevels();
  }

  _buildEl() {
    const el = document.createElement('div');
    el.className = 'dev-widget dev-level-switcher';
    el.innerHTML = `
      <strong>Dev: building level</strong>
      <select data-dev-building></select>
      <select data-dev-level></select>
      <span data-dev-status></span>
    `;
    return el;
  }

  _populateBuildings() {
    const placedIds = [...new Set(
      this._bm.getPlacementRects().map(r => r.buildingId),
    )].sort();
    this._buildingSelect.innerHTML = placedIds
      .map(id => `<option value="${id}">${BUILDINGS_CONFIG[id]?.name ?? id}</option>`)
      .join('');
  }

  _populateLevels() {
    const id = this._buildingSelect.value;
    const maxLevel = BUILDINGS_CONFIG[id]?.maxLevel ?? 1;
    const current = this._bm.getLevelOf(id);
    this._levelSelect.innerHTML = Array.from({ length: maxLevel }, (_, i) => i + 1)
      .map(lvl => `<option value="${lvl}" ${lvl === current ? 'selected' : ''}>Lv.${lvl}</option>`)
      .join('');
  }

  _apply() {
    const buildingId = this._buildingSelect.value;
    const level = Number(this._levelSelect.value);
    eventBus.emit('ui:devSetBuildingLevel', { buildingId, level });
    this._status.textContent = `set ${buildingId} → Lv.${level}`;
  }
}
