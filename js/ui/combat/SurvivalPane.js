import { icon } from '../icons.js';

export class SurvivalPane {
  constructor(el, systems, { onFight }) {
    this._el = el;
    this._s = systems;
    this._onFight = onFight;
    this._waveCount = null;
  }

  render() {
    if (!this._el) return;
    const isSurvival = (this._s.cm.getGameMode?.() ?? 'campaign') === 'survival';
    this._el.innerHTML = isSurvival ? this._arenaHtml() : this._inactiveHtml();
    this._waveCount = this._el.querySelector('#survival-wave-count');
    this._el.querySelector('#btn-survival-fight')?.addEventListener('click', () => {
      const squadId = this._el.querySelector('#survival-squad-select')?.value;
      if (squadId) this._onFight(squadId);
    });
  }

  setWave(wave) {
    if (this._waveCount) this._waveCount.textContent = wave;
  }

  _inactiveHtml() {
    return `
      <div class="card empty-state" style="padding:var(--space-6)">
        <div class="empty-state-icon">${icon('lightning', 'icon--danger')}</div>
        <p class="empty-state-title">Survival Arena</p>
        <p style="color:var(--clr-text-muted);font-size:var(--text-sm)">Start a game in Survival mode to fight endless escalating waves.</p>
      </div>`;
  }

  _arenaHtml() {
    const { wave, mult } = this._s.cm.getSurvivalState?.() ?? { wave: 0, mult: 1 };
    const squads  = this._s.um.getSquads?.() ?? [];
    const squadOptions = squads.map(sq =>
      `<option value="${sq.id}">${sq.name}</option>`
    ).join('');

    let highScore = 0;
    try { highScore = this._s.user?.getProfile()?.stats?.waveHighScore ?? 0; } catch { /* no user ref */ }

    return `
      <div class="card" style="padding:var(--space-4);margin-top:var(--space-3)">
      <div style="text-align:center;padding:var(--space-4) 0">
        <div style="font-size:3rem;margin-bottom:var(--space-2)">${icon('lightning', 'icon--xl icon--danger')}</div>
        <div style="font-size:var(--text-xl);font-weight:700;margin-bottom:var(--space-1)">Survival Arena</div>
        <div style="color:var(--clr-text-secondary);font-size:var(--text-sm)">
          Fight endless escalating waves. Enemies grow stronger by 5% each wave.
        </div>
      </div>
      <div style="display:flex;justify-content:space-around;margin:var(--space-4) 0;text-align:center">
        <div>
          <div style="font-size:1.75rem;font-weight:700;color:var(--clr-primary)">
            <span id="survival-wave-count">${wave}</span>
          </div>
          <div style="font-size:var(--text-xs);color:var(--clr-text-secondary)">Waves Survived</div>
        </div>
        <div>
          <div style="font-size:1.75rem;font-weight:700;color:var(--clr-gold)">${highScore}</div>
          <div style="font-size:var(--text-xs);color:var(--clr-text-secondary)">High Score</div>
        </div>
        <div>
          <div style="font-size:1.75rem;font-weight:700;color:var(--clr-danger)">${Math.round(mult * 100)}%</div>
          <div style="font-size:var(--text-xs);color:var(--clr-text-secondary)">Enemy Strength</div>
        </div>
      </div>
      ${squads.length === 0 ? `
        <div class="empty-state" style="padding:var(--space-4)">
          <p class="empty-state-title">No squads available</p>
          <p style="color:var(--clr-text-muted);font-size:var(--text-sm)">Create a squad in the Barracks to fight.</p>
        </div>
      ` : `
        <div style="display:flex;gap:var(--space-3);align-items:center">
          <select id="survival-squad-select" class="styled-select" style="flex:1">
            ${squadOptions}
          </select>
          <button class="btn btn-danger" id="btn-survival-fight" style="white-space:nowrap">${icon('sword')} Fight Wave ${wave + 1}</button>
        </div>
      `}
      </div>`;
  }
}
