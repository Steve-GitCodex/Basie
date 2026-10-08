export function bindListMenu(headEl, { onReadAll, onDeleteRead }) {
  const btn = headEl.querySelector('[data-list-menu]');
  const menu = headEl.querySelector('.mail__menu');
  const setOpen = (open) => {
    menu.classList.toggle('hidden', !open);
    btn.setAttribute('aria-expanded', String(open));
  };
  btn.addEventListener('click', e => {
    e.stopPropagation();
    setOpen(menu.classList.contains('hidden'));
  });
  menu.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    setOpen(false);
    if (act === 'read-all') onReadAll();
    else if (act === 'delete-read') onDeleteRead();
  });
  headEl.closest('.mail').addEventListener('click', e => {
    if (!menu.contains(e.target)) setOpen(false);
  });
  return { setVisible: (visible) => { btn.hidden = !visible; if (!visible) setOpen(false); } };
}
