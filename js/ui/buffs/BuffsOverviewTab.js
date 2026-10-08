import { BUFF_STATS, BUFF_SOURCES } from '../../entities/GAME_DATA.js';
import { layerMultiplier } from '../../systems/resource/productionLayers.js';
import { escapeHtml } from '../uiUtils.js';
import { formatPct, formatRemaining } from './buffText.js';

const GROUPS = [
  { id: 'economy', label: 'Economy' },
  { id: 'military', label: 'Military' },
  { id: 'speed', label: 'Speed' },
];

const PRODUCTION = /^production\.(?!all$)(.+)$/;

function sourceRow(entry) {
  const source = BUFF_SOURCES[entry.sourceKind];
  const clock = entry.endsAt != null
    ? `<span class="buff-src__clock"> · ${formatRemaining(entry.endsAt - Date.now())}</span>`
    : '';
  return `
    <div class="buff-src">
      <span>${escapeHtml(source?.icon ?? '')}</span>
      <span><b>${escapeHtml(entry.label)}</b> · ${escapeHtml(source?.tag ?? '')}${clock}</span>
      <span>${formatPct(entry.pct)}</span>
    </div>`;
}

function layersFooter(breakdown) {
  if (!breakdown?.layers?.length) return '';
  const factors = breakdown.layers.map(l => layerMultiplier([l]).toFixed(2)).join(' × ');
  return `
    <div class="buff-layers">
      <span>Layers multiply: ${factors}</span>
      <b>×${breakdown.multiplier.toFixed(2)}</b>
    </div>`;
}

function totalTone(pct) {
  if (Math.round(pct * 100) === 0) return ' buff-stat__total--zero';
  return pct < 0 ? ' buff-stat__total--neg' : '';
}

function statRow(statId, total, open, snapshot) {
  const stat = BUFF_STATS[statId];
  const head = `
    <div class="buff-stat${open ? ' buff-stat--open' : ''}" data-stat-toggle="${statId}" role="button" tabindex="0" aria-expanded="${open}">
      <span>${escapeHtml(stat.icon)}</span>
      <span>${escapeHtml(stat.label)}</span>
      <span class="buff-stat__total${totalTone(total.effectivePct)}">${formatPct(total.effectivePct)}</span>
      <span class="buff-stat__chev">${open ? '▾' : '▸'}</span>
    </div>`;
  if (!open) return head;
  const sources = total.entries.length
    ? total.entries.map(sourceRow).join('')
    : '<div class="buff-src buff-src--none"><span></span><span>No sources yet</span><span></span></div>';
  const resource = PRODUCTION.exec(statId)?.[1];
  const footer = resource ? layersFooter(snapshot.rateBreakdowns[resource]) : '';
  return head + sources + footer;
}

export function renderOverviewTab({ totals, expanded, snapshot }) {
  return GROUPS.map(group => {
    const rows = Object.keys(BUFF_STATS)
      .filter(id => BUFF_STATS[id].group === group.id)
      .sort((a, b) => BUFF_STATS[a].order - BUFF_STATS[b].order)
      .map(id => statRow(id, totals[id], expanded.has(id), snapshot))
      .join('');
    return `<div class="buff-group"><h4 class="buff-group__title">${group.label}</h4>${rows}</div>`;
  }).join('');
}
