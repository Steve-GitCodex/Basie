/**
 * BuildingInfoPanel.js
 * Full-overlay "read more" page for a building (#building-info-overlay), opened
 * from a tile's ℹ️ Details button via the `ui:openBuildingInfo` event. Shows the
 * building's function, current level, signature effect, at-a-glance stat chips
 * (instances / hero slots / unlock requirement), and a per-level progression table
 * with the concrete effect value, upgrade cost, and (correctly scaled) build time
 * at each level. Read-only — actions stay on the tile popup.
 */
import { eventBus }         from '../../core/EventBus.js';
import { RES_META, fmt }    from '../uiUtils.js';
import { BUILDINGS_CONFIG } from '../../entities/GAME_DATA.js';
import { ISO_BUILDING_MAP } from '../city/cityAssets.js';
import { icon, iconFromEmoji } from '../icons.js';

export class BuildingInfoPanel {
  /** @param {{ bm }} deps */
  constructor({ bm }) {
    this._bm = bm;
  }

  init() {
    this._overlay = document.getElementById('building-info-overlay');
    this._body    = document.getElementById('binfo-body');
    document.getElementById('binfo-close')?.addEventListener('click', () => this.close());
    // Click the dimmed backdrop (not the sheet) to dismiss
    this._overlay?.addEventListener('click', e => { if (e.target === this._overlay) this.close(); });
    eventBus.on('ui:openBuildingInfo', ({ buildingId } = {}) => this.open(buildingId));
  }

  open(buildingId) {
    const cfg = BUILDINGS_CONFIG[buildingId];
    if (!cfg || !this._overlay || !this._body) return;

    const curLevel = this._bm.getLevelOf?.(buildingId) ?? 0;
    const sprite   = ISO_BUILDING_MAP[buildingId] ?? '';
    const hasEffectCol = this._hasPerLevelEffect(cfg);

    // Per-level progression rows. Upgrade cost = baseCost × costMultiplier^(level-1);
    // build time scales the same way BuildingManager does: base × level (×1 for Lv.1).
    const rows = [];
    for (let lvl = 1; lvl <= cfg.maxLevel; lvl++) {
      const mult = Math.pow(cfg.costMultiplier ?? 1, lvl - 1);
      const cost = Object.entries(cfg.baseCost ?? {})
        .map(([res, amt]) => `<span class="binfo-cost">${RES_META[res]?.icon ?? '?'} ${fmt(Math.round(amt * mult))}</span>`)
        .join(' ') || '—';
      const buildSecs = Math.round((cfg.buildTime ?? 0) * (lvl === 1 ? 1 : lvl));
      const cls   = lvl === curLevel ? 'binfo-row binfo-row--current' : 'binfo-row';
      const effCell = hasEffectCol ? `<td>${this._effectAt(cfg, lvl)}</td>` : '';
      rows.push(`<tr class="${cls}"><td>Lv.${lvl}</td>${effCell}<td>${cost}</td><td>${fmt(buildSecs)}s</td></tr>`);
    }

    const stats = this._statChips(cfg);

    this._body.innerHTML = `
      <div class="binfo-header">
        <div class="binfo-sprite" ${sprite ? `style="background-image:url('${sprite}')"` : ''}>${sprite ? '' : iconFromEmoji(cfg.icon ?? '')}</div>
        <div class="binfo-title-block">
          <h2 class="binfo-name">${cfg.name}</h2>
          <div class="binfo-sub">${curLevel > 0 ? `Level ${curLevel} / ${cfg.maxLevel}` : `Not built · max Lv.${cfg.maxLevel}`}${cfg.category ? ` · ${cfg.category}` : ''}</div>
        </div>
      </div>
      ${cfg.description ? `<p class="binfo-desc">${cfg.description}</p>` : ''}
      ${cfg.effectLabel ? `<div class="binfo-effect">${cfg.effectLabel}</div>` : ''}
      ${stats ? `<div class="binfo-stats">${stats}</div>` : ''}
      <h3 class="binfo-section">Level progression</h3>
      <div class="binfo-table-wrap">
        <table class="binfo-table">
          <thead><tr><th>Level</th>${hasEffectCol ? '<th>Effect</th>' : ''}<th>Upgrade cost</th><th>Build time</th></tr></thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>`;

    this._overlay.classList.remove('hidden');
  }

  /** Resource keys that can appear as production rates or storage caps. */
  static get _RES() { return ['wood', 'stone', 'iron', 'food', 'water', 'money']; }

  _hasPerLevelEffect(cfg) {
    if (cfg.storageCap) return true;
    return BuildingInfoPanel._RES.some(k => typeof cfg.effects?.[k] === 'number');
  }

  /** Concrete effect value at a given level — real data, not a placeholder. */
  _effectAt(cfg, lvl) {
    const e = cfg.effects ?? {};
    const parts = BuildingInfoPanel._RES
      .filter(k => typeof e[k] === 'number')
      .map(k => `${RES_META[k]?.icon ?? '?'} +${(e[k] * lvl).toFixed(1)}/s`);
    if (parts.length) return parts.join(' ');
    if (cfg.storageCap) {
      // Show every resource cap this level unlocks (storage buildings raise all caps).
      const caps = BuildingInfoPanel._RES
        .filter(k => Array.isArray(cfg.storageCap[k]) && cfg.storageCap[k][lvl] != null)
        .map(k => `${RES_META[k]?.icon ?? '?'} ${fmt(cfg.storageCap[k][lvl])}`);
      return caps.length ? `<span class="binfo-caps">${caps.join(' ')}</span>` : '—';
    }
    return '—';
  }

  /** At-a-glance facts: instances, hero slots, unlock requirements. */
  _statChips(cfg) {
    const chips = [];
    if (cfg.maxInstances > 1) chips.push(`<span class="binfo-chip">${icon('hammer')} Up to ${cfg.maxInstances}</span>`);
    if (cfg.heroCapacity > 0) chips.push(`<span class="binfo-chip">${icon('crown')} ${cfg.heroCapacity} hero${cfg.heroCapacity > 1 ? 's' : ''}</span>`);
    if (cfg.requires && typeof cfg.requires === 'object') {
      const req = Object.entries(cfg.requires)
        .map(([id, lv]) => `${BUILDINGS_CONFIG[id]?.name ?? id} Lv.${lv}`)
        .join(' · ');
      if (req) chips.push(`<span class="binfo-chip binfo-chip--req">${icon('lock')} ${req}</span>`);
    }
    return chips.join('');
  }

  close() {
    this._overlay?.classList.add('hidden');
  }
}
