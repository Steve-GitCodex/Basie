import { escapeHtml } from '../uiUtils.js';

const STEPS = ['summary', 'confirm', 'receipt'];
const STEP_LABEL = { summary: 'Pack', confirm: 'Confirm', receipt: 'Receipt' };

export function openCheckout(pack, { onConfirm, vipLine = null }) {
  const shade = document.createElement('div');
  shade.className = 'tp-sheet-shade';
  shade.innerHTML = `
    <div class="tp-sheet" role="dialog" aria-modal="true" aria-label="Checkout">
      <h3 class="tp-sheet__title">Checkout <button class="tp-sheet__close" aria-label="Close">✕</button></h3>
      <div class="tp-sheet__steps">${STEPS.map(s => `<span data-step="${s}">${STEP_LABEL[s]}</span>`).join('')}</div>
      <div class="tp-sheet__body"></div>
      <div class="tp-sheet__actions"></div>
    </div>`;
  const sheet = shade.querySelector('.tp-sheet');
  const body = shade.querySelector('.tp-sheet__body');
  const actions = shade.querySelector('.tp-sheet__actions');
  const lines = (rows) => rows.map(([k, v]) => `<div class="tp-sheet__line"><span>${k}</span><b>${v}</b></div>`).join('');

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => {
    document.removeEventListener('keydown', onKey);
    shade.remove();
  };

  const show = (step, html, buttons) => {
    sheet.dataset.step = step;
    shade.querySelectorAll('.tp-sheet__steps span').forEach(s =>
      s.classList.toggle('tp-sheet__step--on', s.dataset.step === step));
    body.innerHTML = html;
    actions.innerHTML = buttons;
    actions.querySelector('button:last-child').focus();
  };

  const summaryRows = [
    [escapeHtml(pack.label), `💎 ${pack.diamonds.toLocaleString()}`],
    ...(vipLine ? [['VIP progress', vipLine]] : []),
    ['Price', escapeHtml(pack.displayPrice)],
  ];
  const simulated = '<div class="tp-testmode tp-testmode--inline">Simulated: no payment is taken.</div>';

  const showSummary = () => show('summary', lines(summaryRows),
    '<button class="btn btn-ghost tp-sheet__cancel">Cancel</button><button class="btn btn-primary tp-sheet__next">Continue</button>');
  const showConfirm = (error = '') => show('confirm',
    lines(summaryRows) + simulated + (error ? `<p class="tp-sheet__error">${error}</p>` : ''),
    '<button class="btn btn-ghost tp-sheet__cancel">Cancel</button><button class="btn btn-primary tp-sheet__confirm">Confirm purchase</button>');
  const showReceipt = (result) => show('receipt',
    lines([['Purchased', escapeHtml(pack.label)], ['Diamonds received', `💎 ${result.diamonds.toLocaleString()}`]]),
    '<button class="btn btn-primary tp-sheet__done">Done</button>');

  shade.addEventListener('click', (e) => {
    if (e.target === shade || e.target.closest('.tp-sheet__close, .tp-sheet__cancel, .tp-sheet__done')) return close();
    if (e.target.closest('.tp-sheet__next')) return showConfirm();
    if (e.target.closest('.tp-sheet__confirm')) {
      const result = onConfirm();
      if (result?.success) showReceipt(result);
      else showConfirm('Purchase could not be completed.');
    }
  });

  document.addEventListener('keydown', onKey);
  document.body.appendChild(shade);
  showSummary();
}
