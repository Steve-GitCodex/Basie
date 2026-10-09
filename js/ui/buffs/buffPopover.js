import { icon } from '../icons.js';
import { escapeHtml } from '../uiUtils.js';
import { collect, timedEntries } from '../../systems/buffs/buffLedger.js';
import { buildSnapshot } from './buffSnapshot.js';
import { describeEntry, formatRemaining } from './buffText.js';

export const MAX_ROWS = 5;

export const liveBuffEntries = (systems, now = Date.now()) =>
  timedEntries(collect(buildSnapshot(systems))).filter(e => e.endsAt > now);

const entryKey = e => `${e.sourceKind}:${e.sourceId}:${e.stat}:${e.endsAt}`;

export function buffPopoverModel(entries, now = Date.now(), limit = MAX_ROWS) {
  const live = entries.filter(e => e.endsAt > now);
  const rows = live.slice(0, limit).map(e => {
    const { name, effect } = describeEntry(e);
    return { key: entryKey(e), name, effect, endsAt: e.endsAt, remaining: formatRemaining(e.endsAt - now) };
  });
  return { rows, more: Math.max(0, live.length - rows.length), signature: rows.map(r => r.key).join('|') + `+${live.length}` };
}

const rowHtml = r => `<div class="chip-popover__row chip-popover__row--buff">
  <span class="chip-popover__buff">${escapeHtml(r.name)}<em class="chip-popover__effect">${escapeHtml(r.effect)}</em></span><b class="chip-popover__time" data-buff-time="${r.endsAt}">${r.remaining}</b></div>`;

export function buffPopoverHtml(model) {
  const body = model.rows.length
    ? model.rows.map(rowHtml).join('') + (model.more ? `<div class="chip-popover__note">+${model.more} more</div>` : '')
    : '<div class="chip-popover__note">No active buffs</div>';
  return `<h5 class="chip-popover__title">${icon('flask-potion', 'icon--gold')}Active buffs</h5>${body}
    <div class="chip-popover__acts">
      <button class="btn chip-popover__btn chip-popover__btn--ghost" data-pop="buffs">Open buffs</button>
    </div>`;
}

export function patchBuffTimes(root, now = Date.now()) {
  for (const cell of root.querySelectorAll('[data-buff-time]')) {
    const text = formatRemaining(Number(cell.dataset.buffTime) - now);
    if (cell.textContent !== text) cell.textContent = text;
  }
}
