import { COMBAT_RULES } from '../../entities/data/combatRules.js';

const ROW_LABELS = { front: 'Front', mid: 'Mid', back: 'Back' };

export function createSlotRowToggle({ row, onPick, isDisabled = () => false }) {
  const el = document.createElement('div');
  el.className = 'slot-row-toggle';
  const buttons = new Map();

  for (const value of COMBAT_RULES.ROWS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot-row-toggle__btn';
    btn.textContent = ROW_LABELS[value];
    btn.dataset.row = value;
    btn.addEventListener('click', e => { e.stopPropagation(); onPick(value); });
    buttons.set(value, btn);
    el.appendChild(btn);
  }

  const setRow = current => {
    for (const [value, btn] of buttons) {
      const active = value === current;
      btn.classList.toggle('slot-row-toggle__btn--active', active);
      btn.setAttribute('aria-pressed', String(active));
    }
  };
  const refresh = () => {
    for (const [value, btn] of buttons) {
      const disabled = isDisabled(value);
      btn.disabled = disabled;
      btn.classList.toggle('slot-row-toggle__btn--disabled', disabled);
    }
  };
  setRow(row);
  refresh();

  return { el, setRow, refresh };
}
