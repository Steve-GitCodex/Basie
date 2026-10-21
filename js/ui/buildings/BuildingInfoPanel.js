import { eventBus }         from '../../core/EventBus.js';
import { RES_META, fmt }    from '../uiUtils.js';
import { BUILDINGS_CONFIG } from '../../entities/GAME_DATA.js';
import { upgradeCost, upgradeTime } from '../../systems/building/buildingCurve.js';
import { GRIT_BUILDING_MAP } from '../city/cityAssets.js';
import { icon, iconFromEmoji } from '../icons.js';
import { buildingIconUrl } from './buildingIcons.js';
import { levelEffectParts, hasLevelEffects } from './levelEffects.js';
import { populationInfo, populationInfoHtml } from './populationInfo.js';

export class BuildingInfoPanel {
  /** @param {{ bm }} deps */
  constructor({ bm, rm }) {
    this._bm = bm;
    this._rm = rm;
  }

  init() {
    this._overlay = document.getElementById('building-info-overlay');
    this._body    = document.getElementById('binfo-body');
    document.getElementById('binfo-close')?.addEventListener('click', () => this.close());
    // Click the dimmed backdrop (not the sheet) to dismiss
    this._overlay?.addEventListener('click', e => { if (e.target === this._overlay) this.close(); });
    eventBus.on('ui:openBuildingInfo', ({ buildingId, instanceIndex } = {}) => this.open(buildingId, instanceIndex));
  }

  open(buildingId, instanceIndex) {
    const cfg = BUILDINGS_CONFIG[buildingId];
    if (!cfg || !this._overlay || !this._body) return;

    const curLevel = this._levelFor(buildingId, instanceIndex);
    const sprite   = buildingIconUrl(buildingId) ?? GRIT_BUILDING_MAP[buildingId]?.[1] ?? '';
    const hasEffectCol = hasLevelEffects(cfg);

    const rows = [];
    for (let lvl = 1; lvl <= cfg.maxLevel; lvl++) {
      const cost = Object.entries(upgradeCost(cfg, lvl - 1))
        .map(([res, amt]) => `<span class="binfo-cost">${RES_META[res]?.icon ?? '?'} ${fmt(amt)}</span>`)
        .join(' ') || '—';
      const buildSecs = Math.round(upgradeTime(cfg, lvl));
      const cls   = lvl === curLevel ? 'binfo-row binfo-row--current' : 'binfo-row';
      const effCell = hasEffectCol ? `<td>${this._effectAt(cfg, lvl)}</td>` : '';
      rows.push(`<tr class="${cls}"><td>Lv.${lvl}</td>${effCell}<td>${cost}</td><td>${fmt(buildSecs)}s</td></tr>`);
    }

    const stats = this._statChips(cfg);
    const pop = populationInfo(buildingId, cfg, curLevel, this._rm?.getPopulation?.() ?? { current: 0, cap: 0 });

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
      ${populationInfoHtml(pop)}
      <h3 class="binfo-section">Level progression</h3>
      <div class="binfo-table-wrap">
        <table class="binfo-table">
          <thead><tr><th>Level</th>${hasEffectCol ? '<th>Effect</th>' : ''}<th>Upgrade cost</th><th>Build time</th></tr></thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>`;

    this._overlay.classList.remove('hidden');
    this._revealCurrentRow();
  }

  _revealCurrentRow() {
    const wrap = this._body.querySelector('.binfo-table-wrap');
    const row = wrap?.querySelector('.binfo-row--current');
    if (!wrap || !row) return;
    const head = wrap.querySelector('thead').offsetHeight;
    wrap.scrollTop = Math.max(0, row.offsetTop - head - (wrap.clientHeight - head - row.offsetHeight) / 2);
  }

  _levelFor(buildingId, instanceIndex) {
    if (instanceIndex == null) return this._bm.getLevelOf?.(buildingId) ?? 0;
    return this._bm.getInstanceLevelOf?.(`${buildingId}_${instanceIndex}`) ?? 0;
  }

  _effectAt(cfg, lvl) {
    const parts = levelEffectParts(cfg, lvl)
      .map(p => (p.res ? `${RES_META[p.res].icon} ${p.text}` : p.text));
    return `<span class="binfo-caps">${parts.join(' ')}</span>`;
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
