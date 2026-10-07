import { resultsHtml } from './resultsHtml.js';

const noop = () => {};

export class ResultsView {
  constructor(el, { onReplay = noop, onBack = noop, onNext = noop, onTurningPoint = noop, onFix = noop } = {}) {
    this._el = el;
    this._actions = {
      'btn-battle-replay': () => onReplay(),
      'btn-battle-close': () => onBack(),
      'btn-battle-turning-point': () => onTurningPoint(),
      'btn-battle-next': (button) => onNext(button.dataset.stageId),
    };
    this._onFix = onFix;
    el.addEventListener('click', e => this._onClick(e));
  }

  render(model) {
    this._el.innerHTML = resultsHtml(model);
    this._animateXp();
  }

  clear() {
    this._el.replaceChildren();
  }

  _animateXp() {
    const bars = [...this._el.querySelectorAll('.results__xpbar i[data-to]')];
    if (!bars.length) return;
    void this._el.offsetWidth;
    requestAnimationFrame(() => {
      for (const bar of bars) bar.style.width = `${bar.dataset.to}%`;
    });
  }

  _onClick(e) {
    const button = e.target.closest('button');
    if (!button || !this._el.contains(button)) return;
    if (button.dataset.fix) {
      this._onFix(button.dataset.fix);
      return;
    }
    this._actions[button.id]?.(button);
  }
}
