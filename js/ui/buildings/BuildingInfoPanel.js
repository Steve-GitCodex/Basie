/**
 * BuildingInfoPanel.js
 * Full-overlay "read more" page for a building (#building-info-overlay), opened
 * from a tile's ℹ️ Details button via the `ui:openBuildingInfo` event. Shows the
 * building's function, current level, signature effect, and a per-level cost /
 * time progression table. Read-only — actions stay on the tile popup.
 *
 * This is the lightweight first pass; the richer build/upgrade flow is a separate
 * future redesign.
 */
import { eventBus }         from '../../core/EventBus.js';
import { RES_META, fmt }    from '../uiUtils.js';
import { BUILDINGS_CONFIG } from '../../entities/GAME_DATA.js';
import { ISO_BUILDING_MAP } from '../city/cityAssets.js';

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

    // Per-level progression: upgrade cost = baseCost × costMultiplier^(level-1).
    const rows = [];
    for (let lvl = 1; lvl <= cfg.maxLevel; lvl++) {
      const mult = Math.pow(cfg.costMultiplier ?? 1, lvl - 1);
      const cost = Object.entries(cfg.baseCost ?? {})
        .map(([res, amt]) => `${RES_META[res]?.icon ?? '?'} ${fmt(Math.round(amt * mult))}`)
        .join(' ') || '—';
      const cls = lvl === curLevel ? 'binfo-row binfo-row--current' : 'binfo-row';
      rows.push(`<tr class="${cls}"><td>Lv.${lvl}</td><td>${cost}</td><td>${fmt(cfg.buildTime ?? 0)}s</td></tr>`);
    }

    this._body.innerHTML = `
      <div class="binfo-header">
        <div class="binfo-sprite" ${sprite ? `style="background-image:url('${sprite}')"` : ''}>${sprite ? '' : (cfg.icon ?? '🏛️')}</div>
        <div class="binfo-title-block">
          <h2 class="binfo-name">${cfg.name}</h2>
          <div class="binfo-sub">${curLevel > 0 ? `Level ${curLevel} / ${cfg.maxLevel}` : `Not built · max Lv.${cfg.maxLevel}`}${cfg.category ? ` · ${cfg.category}` : ''}</div>
        </div>
      </div>
      ${cfg.description ? `<p class="binfo-desc">${cfg.description}</p>` : ''}
      ${cfg.effectLabel ? `<div class="binfo-effect">${cfg.effectLabel}</div>` : ''}
      <h3 class="binfo-section">Level progression</h3>
      <table class="binfo-table">
        <thead><tr><th>Level</th><th>Upgrade cost</th><th>Build time</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>`;

    this._overlay.classList.remove('hidden');
  }

  close() {
    this._overlay?.classList.add('hidden');
  }
}
