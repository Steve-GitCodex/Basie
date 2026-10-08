import { isClaimable } from '../../systems/mail/mailCategories.js';
import { icon } from '../icons.js';
import { RES_META, escapeHtml, fmt } from '../uiUtils.js';
import { battleReportHtml } from './battleReportBlock.js';
import { rewardEntries } from './mailRow.js';

function rewardsHtml(msg) {
  const entries = rewardEntries(msg.attachments);
  if (entries.length === 0) return '';
  const cells = entries.map(([k, v]) => `
    <div class="mail-reward">
      <span class="mail-reward__icon">${RES_META[k]?.icon ?? ''}</span>
      <span class="mail-reward__qty">+${fmt(v)}</span>
      <span class="mail-reward__name">${escapeHtml(RES_META[k]?.label ?? k)}</span>
    </div>`).join('');
  const note = msg.rewardsClaimed ? `<p class="mail-rewards__note">${icon('check', 'icon--success')} Collected</p>` : '';
  return `<div class="mail-rewards${msg.rewardsClaimed ? ' mail-rewards--claimed' : ''}">${cells}</div>${note}`;
}

function actionsHtml(msg) {
  if (msg.isInTrash) {
    return `
      <button type="button" class="mail-btn mail-btn--ghost" data-act="restore">Restore</button>
      <span class="mail-row__gap"></span>
      <button type="button" class="mail-btn mail-btn--danger" data-act="purge">${icon('trash')} Delete forever</button>`;
  }
  return `
    ${isClaimable(msg) ? `<button type="button" class="mail-btn" data-act="claim">${icon('gift')} Claim</button>` : ''}
    <span class="mail-row__gap"></span>
    <button type="button" class="mail-btn mail-btn--ghost" data-act="delete">${icon('trash')} Delete</button>`;
}

const stateKey = (msg) => `${!!msg.isInTrash}|${!!msg.rewardsClaimed}`;

export function expandedHtml(msg) {
  return `
    <div class="mail-row__body">
      ${msg.report ? battleReportHtml(msg.report) : ''}
      <p class="mail-row__message">${escapeHtml(msg.body ?? '').replace(/\n/g, '<br>')}</p>
      <div class="mail-row__rewards" data-state="${stateKey(msg)}">${rewardsHtml(msg)}</div>
      <div class="mail-row__actions">${actionsHtml(msg)}</div>
    </div>`;
}

export function patchExpanded(bodyEl, msg) {
  const rewards = bodyEl.querySelector('.mail-row__rewards');
  const key = stateKey(msg);
  if (rewards.dataset.state === key) return;
  rewards.dataset.state = key;
  rewards.innerHTML = rewardsHtml(msg);
  bodyEl.querySelector('.mail-row__actions').innerHTML = actionsHtml(msg);
}
