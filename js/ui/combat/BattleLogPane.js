import { icon } from '../icons.js';

export class BattleLogPane {
  constructor(el) {
    this._el = el;
  }

  render(log) {
    if (!this._el) return;
    this._el.innerHTML = log.length === 0
      ? `<div class="empty-state" style="padding:var(--space-6)"><div class="empty-state-icon">${icon('sword')}</div><p class="empty-state-title">No battles yet</p></div>`
      : log.map(e => {
          const isWin = e.result === 'Victory';
          return `<div style="padding:var(--space-2) var(--space-3);background:var(--clr-bg-elevated);border-radius:var(--radius-md);border:1px solid ${isWin?'var(--clr-success)':'var(--clr-danger)'}33;display:flex;justify-content:space-between;align-items:center">
            <span>${e.icon} <strong>${e.monster}</strong></span>
            <span style="color:${isWin?'var(--clr-success)':'var(--clr-danger)'};font-weight:700">${e.result}</span>
            <span style="font-size:var(--text-xs);color:var(--clr-text-muted)">${new Date(e.timestamp).toLocaleTimeString()}</span>
          </div>`;
        }).join('');
  }
}
