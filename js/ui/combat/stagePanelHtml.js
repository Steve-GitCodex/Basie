import { UNITS_CONFIG } from '../../entities/GAME_DATA.js';
import { RES_META, fmt, escapeHtml } from '../uiUtils.js';
import { icon, iconFromEmoji } from '../icons.js';
import { stackSummary } from './stackSummary.js';

const KIND_LABELS = { regular: 'Stage', boss: 'Boss', elite: 'Elite' };
const ROW_LABELS = { front: 'Front', mid: 'Mid', back: 'Back' };
const MAX_STARS = 3;
const REDUCED_LOOT = 0.1;

const unitCount = squad => squad.units.reduce((a, u) => a + u.count, 0);
const squadLabel = squad => `${escapeHtml(squad.name)} <span class="squad-opt-units">(${unitCount(squad)} units)</span>`;

function kindLabel(stage) {
  return stage.kind === 'regular' ? `${KIND_LABELS.regular} ${stage.index}` : KIND_LABELS[stage.kind];
}

function starsHtml(bestStars) {
  if (!bestStars) return '';
  return `<div class="stage-panel__stars" aria-label="${bestStars} of ${MAX_STARS} stars">${'★'.repeat(bestStars)}<i>${'★'.repeat(MAX_STARS - bestStars)}</i></div>`;
}

function stackHtml(stack) {
  const typeIcon = UNITS_CONFIG[stack.type]?.icon ?? '';
  const ability = stack.specialAbility
    ? `<span class="stage-tag stage-tag--ability">${escapeHtml(stack.specialAbility.replace(/_/g, ' '))}</span>` : '';
  return `
    <span class="stage-stack stage-stack--${stack.type}" title="${stackSummary(stack)}">
      <span class="stage-stack__tier">T${stack.tier}</span>
      <span class="stage-stack__name">${typeIcon} ${escapeHtml(stack.name)} ×${stack.count}</span>
      <span class="stage-stack__row">${ROW_LABELS[stack.row] ?? stack.row}</span>${ability}
    </span>`;
}

function wavesHtml(stage) {
  const waves = stage.monster.waves;
  const bossWave = stage.kind === 'regular' ? -1 : waves.length - 1;
  return waves.map((wave, i) => `
    <div class="stage-wave">
      <div class="stage-wave__name">${i + 1} · ${escapeHtml(wave.name)}${i === bossWave ? '<span class="stage-tag stage-tag--boss">boss</span>' : ''}</div>
      <div class="stage-wave__stacks">${wave.stacks.map(stackHtml).join('')}</div>
    </div>`).join('');
}

function modifierHtml(modifier) {
  if (!modifier) return '';
  return `<div class="stage-panel__modifier">${icon('lightning')} <strong>${escapeHtml(modifier.name)}</strong> — ${escapeHtml(modifier.description)}</div>`;
}

function rewardsHtml(stage, progress, loot) {
  const chips = Object.entries(stage.monster.rewards).map(([res, value]) => {
    const amount = loot.isReduced ? Math.max(1, Math.floor(value * REDUCED_LOOT)) : value;
    return `<span class="stage-reward">${RES_META[res]?.icon ?? ''} ${fmt(amount)}</span>`;
  });
  if (!progress.firstCleared) {
    chips.push(`<span class="stage-reward stage-reward--first">First clear: 💎${stage.firstClear.diamond}</span>`);
  }
  const wins = loot.victories > 0
    ? `<div class="stage-panel__wins">${loot.isReduced ? `${icon('warning')} ${loot.victories} wins · 10% loot` : `${loot.victories} win${loot.victories > 1 ? 's' : ''} · ${loot.rewardsRemaining} full rewards left`}</div>`
    : '';
  return `
    <p class="stage-panel__label">Rewards${loot.isReduced ? ' (reduced)' : ''}</p>
    <div class="stage-rewards">${chips.join('')}</div>${wins}`;
}

function squadPickerHtml(squads, squadId) {
  const selected = squads.find(s => s.id === squadId);
  const options = squads.map(s =>
    `<div class="squad-dropdown-option${s.id === squadId ? ' selected' : ''}" data-value="${s.id}">${squadLabel(s)}</div>`).join('');
  return `
    <div class="squad-dropdown stage-panel__squad" id="squad-dropdown">
      <button type="button" class="squad-dropdown-trigger" id="squad-select-trigger">
        <span class="squad-select-label">${selected ? squadLabel(selected) : 'No squads available'}</span>
        <span class="chevron">▼</span>
      </button>
      <div class="squad-dropdown-panel">${options}</div>
      <input type="hidden" id="squad-select" value="${squadId ?? ''}">
    </div>`;
}

function deployHtml({ state, squads, loot }) {
  const reason = !state.isAvailable ? state.lockReason ?? 'Locked' : squads.length === 0 ? 'No squads available' : '';
  const label = loot.victories === 0 ? 'Deploy' : loot.isReduced ? 'Re-fight (10% loot)' : 'Re-fight';
  return `
    ${reason ? `<div class="stage-panel__deploy-note">${icon('lock')} ${escapeHtml(reason)}</div>` : ''}
    <button type="button" class="btn btn-primary w-full stage-panel__deploy" id="btn-campaign-attack"${reason ? ' disabled' : ''}>
      ${icon('sword')} ${label}
    </button>`;
}

export function stagePanelHtml({ stage, state, progress, modifier, loot, squads, squadId }) {
  return `
    <div class="stage-panel__body">
      <button type="button" class="stage-panel__close" aria-label="Close">✕</button>
      <span class="stage-panel__kind stage-panel__kind--${stage.kind}">Chapter ${stage.chapter} · ${kindLabel(stage)}</span>
      <div class="stage-panel__head">
        <span class="stage-panel__icon">${iconFromEmoji(stage.icon ?? '')}</span>
        <h3 class="stage-panel__title">${escapeHtml(stage.name)}</h3>
      </div>
      ${starsHtml(progress.bestStars)}
      <p class="stage-panel__desc">${escapeHtml(stage.description ?? '')}</p>
      <p class="stage-panel__label">Waves</p>
      ${wavesHtml(stage)}
      ${modifierHtml(modifier)}
      <div class="stage-panel__commanders"></div>
      ${rewardsHtml(stage, progress, loot)}
    </div>
    <div class="stage-panel__footer">
      <div class="stage-panel__pick">
        ${squadPickerHtml(squads, squadId)}
        <div id="readiness-badge-area" class="stage-panel__estimate"></div>
      </div>
      ${deployHtml({ state, squads, loot })}
    </div>`;
}
