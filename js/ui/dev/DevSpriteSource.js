/**
 * DevSpriteSource.js
 * Dev-only floating widget (`?dev` sessions only): flip building sprites between the
 * default grit set and the AI set, live, to eyeball AI renders in-game (ADR 0024).
 * Reaches into `window.game.city._assets` — acceptable for dev tooling, same as the
 * other dev widgets. Grit is the default for everyone; this toggle only affects the
 * dev session.
 */
export class DevSpriteSource {
  init() {
    this._el = this._buildEl();
    document.body.appendChild(this._el);
    this._toggle = this._el.querySelector('[data-sprite-ai]');
    this._toggle.checked = !!window.game?.city?._assets?.aiEnabled;
    this._toggle.addEventListener('change', () => this._apply());
  }

  _buildEl() {
    const el = document.createElement('div');
    el.className = 'dev-widget dev-sprite-source';
    el.innerHTML = `
      <strong>Dev: sprite source</strong>
      <label><input type="checkbox" data-sprite-ai> AI sprites (default: grit)</label>
    `;
    return el;
  }

  _apply() {
    window.game?.city?._assets?.setAiSprites(this._toggle.checked);
  }
}
