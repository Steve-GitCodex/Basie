import { isClaimable } from '../../systems/mail/mailCategories.js';
import { icon } from '../icons.js';
import { RES_META, escapeHtml, fmt } from '../uiUtils.js';

const SENDER = { combat: 'Battle Command', quest: 'Quest Board', achievement: 'Hall of Records' };
const TYPE_ICON = { combat: 'sword', quest: 'scroll', achievement: 'crown' };

export const senderLabel = (type) => SENDER[type] ?? 'System';

export function relativeDate(ts, now = Date.now()) {
  const min = Math.floor((now - ts) / 60_000);
  if (min < 1)  return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)  return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7)  return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function rewardEntries(attachments) {
  return Object.entries(attachments ?? {}).filter(([k]) => k !== 'xp');
}

function pillsHtml(msg) {
  if (!isClaimable(msg)) return '';
  return rewardEntries(msg.attachments)
    .map(([k, v]) => `<span class="mail-pill">${RES_META[k]?.icon ?? ''}${fmt(v)}</span>`)
    .join('');
}

function typeIconHtml(msg) {
  const tint = msg.report ? (msg.report.victory ? ' mail-row__icon--win' : ' mail-row__icon--loss') : '';
  return `<span class="mail-row__icon${tint}">${icon(TYPE_ICON[msg.type] ?? 'envelope')}</span>`;
}

export function rowHtml(msg) {
  return `
    <div class="mail-row" data-id="${msg.id}" role="listitem">
      <div class="mail-row__line">
        <button type="button" class="mail-row__head" aria-expanded="false">
          <span class="mail-row__dot"></span>
          ${typeIconHtml(msg)}
          <span class="mail-row__text">
            <span class="mail-row__subject">${escapeHtml(msg.subject ?? '')}</span>
            <span class="mail-row__meta">${senderLabel(msg.type)} · <span class="mail-row__age"></span></span>
          </span>
          <span class="mail-row__pills"></span>
        </button>
        <span class="mail-row__side">
          <span class="mail-row__claim-slot"></span>
          <button type="button" class="mail-row__star" data-row-star aria-pressed="false" aria-label="Star mail">★</button>
        </span>
      </div>
    </div>`;
}

export function createRow(msg) {
  const tpl = document.createElement('template');
  tpl.innerHTML = rowHtml(msg).trim();
  const el = tpl.content.firstElementChild;
  patchRow(el, msg);
  return el;
}

function patchClaimSlot(slot, msg) {
  const state = isClaimable(msg) ? 'claim' : msg.attachments && msg.rewardsClaimed ? 'done' : 'none';
  if (slot.dataset.state === state) return;
  slot.dataset.state = state;
  if (state === 'claim') slot.innerHTML = '<button type="button" class="mail-row__claim" data-row-claim>Claim</button>';
  else if (state === 'done') slot.innerHTML = `<span class="mail-row__done" title="Collected">${icon('check', 'icon--success')}</span>`;
  else slot.innerHTML = '';
}

export function patchRow(el, msg) {
  el.classList.toggle('mail-row--unread', !msg.isRead);
  el.querySelector('.mail-row__age').textContent = relativeDate(msg.timestamp);
  const pills = pillsHtml(msg);
  const pillsEl = el.querySelector('.mail-row__pills');
  if (pillsEl.dataset.html !== pills) { pillsEl.innerHTML = pills; pillsEl.dataset.html = pills; }
  patchClaimSlot(el.querySelector('.mail-row__claim-slot'), msg);
  const star = el.querySelector('[data-row-star]');
  star.setAttribute('aria-pressed', String(!!msg.isImportant));
  star.classList.toggle('mail-row__star--on', !!msg.isImportant);
  star.hidden = !!msg.isInTrash;
}
