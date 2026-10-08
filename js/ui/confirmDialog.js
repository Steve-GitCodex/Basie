import { escapeHtml } from './uiUtils.js';

function dialogHtml({ title, text, confirmLabel, danger }) {
  return `
    <div class="confirm-dialog__box" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <h3 class="confirm-dialog__title" id="confirm-dialog-title">${escapeHtml(title)}</h3>
      ${text ? `<p class="confirm-dialog__text">${escapeHtml(text)}</p>` : ''}
      <div class="confirm-dialog__actions">
        <button type="button" class="confirm-dialog__btn" data-answer="cancel">Cancel</button>
        <button type="button" class="confirm-dialog__btn confirm-dialog__btn--${danger ? 'danger' : 'primary'}" data-answer="ok">${escapeHtml(confirmLabel)}</button>
      </div>
    </div>`;
}

/** @returns {Promise<boolean>} */
export function confirmDialog({ title, text = '', confirmLabel = 'Confirm', danger = false }) {
  if (document.querySelector('.confirm-dialog')) return Promise.resolve(false);
  const overlay = document.createElement('div');
  overlay.className = 'confirm-dialog';
  overlay.innerHTML = dialogHtml({ title, text, confirmLabel, danger });
  document.body.appendChild(overlay);

  return new Promise(resolve => {
    const finish = answer => {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      resolve(answer);
    };
    const onKey = e => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      finish(false);
    };
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('click', e => {
      if (e.target === overlay) finish(false);
      else if (e.target.closest('[data-answer="ok"]')) finish(true);
      else if (e.target.closest('[data-answer="cancel"]')) finish(false);
    });
    overlay.querySelector('[data-answer="cancel"]').focus();
  });
}
