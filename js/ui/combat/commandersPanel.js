import { UNITS_CONFIG } from '../../entities/GAME_DATA.js';
import { escapeHtml } from '../uiUtils.js';
import { iconFromEmoji } from '../icons.js';

const ROW_LABELS = { front: 'Front', mid: 'Mid', back: 'Back' };

function troopsHtml(slot) {
  const cfg = UNITS_CONFIG[slot.unitId];
  if (!cfg || slot.count <= 0) return '<span class="commander-row__troops--none">no troops</span>';
  const name = cfg.tiers?.[slot.tier - 1]?.name ?? cfg.name;
  return `<span class="commander-row__troops commander-row__troops--${slot.unitId}">${cfg.icon} ${escapeHtml(name)} ×${slot.count}</span>`;
}

function leadsHtml(slot, extra = '') {
  return `<div class="commander-row__leads">Slot ${slot.slotIndex + 1} · ${troopsHtml(slot)} · ${ROW_LABELS[slot.row] ?? slot.row}${extra}</div>`;
}

function chipsHtml(slot) {
  const chips = [
    ...slot.auras.map(text => `<span class="commander-chip commander-chip--aura">${escapeHtml(text)}</span>`),
    ...slot.triggers.map(text => `<span class="commander-chip commander-chip--trigger">${escapeHtml(text)}</span>`),
  ];
  return chips.length ? `<div class="commander-row__chips">${chips.join('')}</div>` : '';
}

function heroRowHtml(slot) {
  const { hero } = slot;
  return `
    <div class="commander-row commander-row--filled" data-slot="${slot.slotIndex}">
      <div class="commander-portrait commander-portrait--${hero.rarity}">${iconFromEmoji(hero.icon)}<span class="commander-portrait__lv">Lv${hero.level}</span></div>
      <div class="commander-row__body">
        <div class="commander-row__name">${escapeHtml(hero.name)}</div>
        ${leadsHtml(slot)}
        ${chipsHtml(slot)}
      </div>
    </div>`;
}

function emptyRowHtml(slot) {
  const assign = ' <button type="button" class="btn btn-secondary btn-sm commander-row__assign">Assign ›</button>';
  return `
    <div class="commander-row commander-row--empty" data-slot="${slot.slotIndex}">
      <div class="commander-portrait commander-portrait--empty">＋</div>
      <div class="commander-row__body">
        <div class="commander-row__name commander-row__name--muted">Slot ${slot.slotIndex + 1} · no hero</div>
        ${leadsHtml(slot, assign)}
      </div>
    </div>`;
}

function lockedRowHtml(slot) {
  return `
    <div class="commander-row commander-row--locked" data-slot="${slot.slotIndex}">
      <div class="commander-portrait commander-portrait--empty">🔒</div>
      <div class="commander-row__body">
        <div class="commander-row__name commander-row__name--muted">Slot ${slot.slotIndex + 1} · locked</div>
        <div class="commander-row__leads">Opens at Barracks Lv.${slot.lockedAt}</div>
      </div>
    </div>`;
}

function rowHtml(slot) {
  if (slot.lockedAt) return lockedRowHtml(slot);
  return slot.hero ? heroRowHtml(slot) : emptyRowHtml(slot);
}

function supportHtml(support) {
  if (!support.length) return '';
  const lines = support.map(s => `${escapeHtml(s.name)}${s.text ? ` · ${escapeHtml(s.text)}` : ''}`).join('<br>');
  return `
    <div class="commander-support">
      <span class="commander-support__label">Support · Hero Quarters</span>
      <div class="commander-support__heroes">${lines}</div>
    </div>`;
}

function totalsHtml({ attackPct, defensePct, strikesPerRound }) {
  return `
    <div class="commander-totals">
      <span>+${attackPct}% attack</span><span>+${defensePct}% defense</span><span>${strikesPerRound} strike${strikesPerRound === 1 ? '' : 's'} / round</span>
    </div>`;
}

export function commandersHtml(model) {
  const open = model.slots.filter(s => !s.lockedAt);
  const led = open.filter(s => s.hero).length;
  return `
    <p class="stage-panel__label">Commanders · ${led} / ${open.length}</p>
    ${model.slots.map(rowHtml).join('')}
    ${supportHtml(model.support)}
    ${totalsHtml(model.totals)}`;
}
