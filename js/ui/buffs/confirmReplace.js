import { INVENTORY_ITEMS } from '../../entities/GAME_DATA.js';
import { escapeHtml } from '../uiUtils.js';
import { formatPct, formatRemaining } from './buffText.js';

function compareMessage(current, incoming, remainingMs) {
  const weaker = incoming.value < current.value;
  const shorter = incoming.durationMs < remainingMs;
  const lost = `The remaining ${formatRemaining(remainingMs)} of the current boost is lost.`;
  if (weaker && shorter) return { warn: true, text: `Weaker and shorter. ${lost}` };
  if (weaker) return { warn: true, text: `Weaker. ${lost}` };
  if (shorter) return { warn: true, text: `Shorter than what is left. ${lost}` };
  return { warn: false, text: lost };
}

function dialogHtml(current, incoming) {
  const remainingMs = Math.max(0, current.endsAt - Date.now());
  const currentName = INVENTORY_ITEMS[current.itemId]?.name ?? 'Current boost';
  const msg = compareMessage(current, incoming, remainingMs);
  return `
    <div class="buff-confirm__dialog" role="dialog" aria-modal="true">
      <h3 class="buff-confirm__title">Replace active boost?</h3>
      <div class="buff-confirm__compare">
        <div class="buff-confirm__side buff-confirm__side--old">
          <small>Running</small>
          <div class="buff-confirm__big">${formatPct(current.value)}</div>
          <small>${escapeHtml(currentName)} · ${formatRemaining(remainingMs)} left</small>
        </div>
        <div class="buff-confirm__arrow">→</div>
        <div class="buff-confirm__side">
          <small>New</small>
          <div class="buff-confirm__big${msg.warn ? ' buff-confirm__big--warn' : ''}">${formatPct(incoming.value)}</div>
          <small>${escapeHtml(incoming.name)} · ${formatRemaining(incoming.durationMs)}</small>
        </div>
      </div>
      <div class="buff-confirm__note${msg.warn ? ' buff-confirm__note--warn' : ''}">${msg.warn ? '⚠ ' : ''}${escapeHtml(msg.text)}</div>
      <div class="buff-confirm__actions">
        <button class="buff-confirm__btn" data-answer="keep">Keep current</button>
        <button class="buff-confirm__btn buff-confirm__btn--danger" data-answer="replace">Replace</button>
      </div>
    </div>`;
}

export function confirmReplace({ current, incoming }) {
  if (document.querySelector('.buff-confirm')) return Promise.resolve(false);
  const overlay = document.createElement('div');
  overlay.className = 'buff-confirm';
  overlay.innerHTML = dialogHtml(current, incoming);
  document.body.appendChild(overlay);

  return new Promise(resolve => {
    const finish = answer => {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      resolve(answer);
    };
    const onKey = e => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      finish(false);
    };
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('click', e => {
      if (e.target === overlay) finish(false);
      else if (e.target.closest('[data-answer="replace"]')) finish(true);
      else if (e.target.closest('[data-answer="keep"]')) finish(false);
    });
    overlay.querySelector('[data-answer="keep"]').focus();
  });
}

export async function activateBoostItem(systems, itemId) {
  const preview = systems.buffs?.previewActivate(itemId);
  if (preview?.current) {
    const name = INVENTORY_ITEMS[itemId]?.name ?? itemId;
    const confirmed = await confirmReplace({
      current: preview.current,
      incoming: { ...preview.incoming, name },
    });
    if (!confirmed) return null;
  }
  return systems.inventory.useItem(itemId);
}
