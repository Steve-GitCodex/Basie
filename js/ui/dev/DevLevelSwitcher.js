import { eventBus } from '../../core/EventBus.js';
import { BUILDINGS_CONFIG } from '../../entities/GAME_DATA.js';

const splitInstanceId = (instanceId) => {
  const cut = instanceId.lastIndexOf('_');
  return { buildingId: instanceId.slice(0, cut), instanceIndex: Number(instanceId.slice(cut + 1)) };
};

export class DevLevelSwitcher {
  init(buildingManager, mount) {
    this._bm = buildingManager;
    this._el = this._buildEl();
    mount.appendChild(this._el);
    this._buildingSelect = this._el.querySelector('[data-dev-building]');
    this._levelSelect    = this._el.querySelector('[data-dev-level]');
    this._status         = this._el.querySelector('[data-dev-status]');

    this._refreshInstances();
    for (const evt of ['focus', 'pointerdown']) {
      this._buildingSelect.addEventListener(evt, () => this._refreshInstances());
    }
    this._buildingSelect.addEventListener('change', () => this._populateLevels());
    this._levelSelect.addEventListener('change', () => this._apply());
    this._populateLevels();

    eventBus.on('dev:buildingSelected', ({ buildingId, instanceIndex = 0 }) =>
      this._selectInstance(`${buildingId}_${instanceIndex}`));
  }

  _selectInstance(instanceId) {
    if (this._buildingSelect.value === instanceId) return;
    this._refreshInstances();
    if (!this._hasOption(instanceId)) return;
    this._buildingSelect.value = instanceId;
    this._populateLevels();
  }

  _hasOption(instanceId) {
    return [...this._buildingSelect.options].some(o => o.value === instanceId);
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

  _refreshInstances() {
    const keep = this._buildingSelect.value;
    const rects = this._bm.getPlacementRects()
      .slice()
      .sort((a, b) => a.buildingId.localeCompare(b.buildingId) || a.instanceIndex - b.instanceIndex);
    this._buildingSelect.innerHTML = rects
      .map(r => `<option value="${r.instanceId}">${BUILDINGS_CONFIG[r.buildingId]?.name ?? r.buildingId} #${r.instanceIndex + 1}</option>`)
      .join('');
    if (keep && this._hasOption(keep)) this._buildingSelect.value = keep;
  }

  _populateLevels() {
    const instanceId = this._buildingSelect.value;
    if (!instanceId) { this._levelSelect.innerHTML = ''; return; }
    const { buildingId } = splitInstanceId(instanceId);
    const maxLevel = BUILDINGS_CONFIG[buildingId]?.maxLevel ?? 1;
    const current = this._bm.getInstanceLevelOf(instanceId);
    this._levelSelect.innerHTML = Array.from({ length: maxLevel }, (_, i) => i + 1)
      .map(lvl => `<option value="${lvl}" ${lvl === current ? 'selected' : ''}>Lv.${lvl}</option>`)
      .join('');
  }

  _apply() {
    const instanceId = this._buildingSelect.value;
    const { buildingId, instanceIndex } = splitInstanceId(instanceId);
    const level = Number(this._levelSelect.value);
    eventBus.emit('ui:devSetBuildingLevel', { buildingId, instanceIndex, level });
    this._status.textContent = `set ${instanceId} → Lv.${level}`;
  }
}
