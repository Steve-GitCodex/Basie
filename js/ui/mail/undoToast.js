let current = null;

export function showUndo(hostEl, text, onUndo, ms = 5000) {
  current?.dismiss();
  const el = document.createElement('div');
  el.className = 'mail-undo';
  el.setAttribute('role', 'status');
  el.innerHTML = '<span class="mail-undo__text"></span><button type="button" class="mail-undo__btn" data-undo>Undo</button>';
  el.querySelector('.mail-undo__text').textContent = text;

  const dismiss = () => {
    clearTimeout(timer);
    el.remove();
    if (current?.el === el) current = null;
  };
  const timer = setTimeout(dismiss, ms);
  el.querySelector('[data-undo]').addEventListener('click', () => { dismiss(); onUndo(); });
  hostEl.appendChild(el);
  current = { el, dismiss };
}
