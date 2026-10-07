const MAX_LINES = 3;

export class RoundLogView {
  constructor(el) {
    this._el = el;
    el.classList.add('round-log');
    el.setAttribute('aria-live', 'off');
    this._lines = Array.from({ length: MAX_LINES }, () => {
      const line = document.createElement('p');
      line.className = 'round-log__line';
      el.appendChild(line);
      return line;
    });
  }

  render(lines) {
    this._lines.forEach((line, i) => {
      const text = lines[i] ?? '';
      if (line.textContent !== text) line.textContent = text;
      line.classList.toggle('hidden', !text);
    });
    this._el.classList.toggle('round-log--empty', lines.length === 0);
  }
}
